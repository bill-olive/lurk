"""
LLM Gateway — FastAPI application.

Centralised model access service. All agent LLM calls flow through this
service, which handles model selection, token metering, budget enforcement,
retry, and TTS generation (PRD Section 5.2).
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .gateway import LLMGateway
from .metering import TokenMeter
from .models import (
    CompletionRequest,
    CompletionResponse,
    ErrorResponse,
    TTSRequest,
    TTSResponse,
    UsageResponse,
)
from .prompt_manager import PromptManager
from .tts import TTSService

logger = logging.getLogger("llm-gateway")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

# ---------------------------------------------------------------------------
# Globals initialised at startup
# ---------------------------------------------------------------------------

_gateway: LLMGateway | None = None
_tts: TTSService | None = None
_meter: TokenMeter | None = None
_prompts: PromptManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _gateway, _tts, _meter, _prompts

    _prompts = PromptManager(
        prompts_dir=os.getenv("PROMPTS_DIR", "/app/prompts"),
    )
    _meter = TokenMeter(
        firestore_project=os.getenv("GCP_PROJECT"),
    )
    _gateway = LLMGateway(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        meter=_meter,
        prompt_manager=_prompts,
    )
    _tts = TTSService(
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
    )

    logger.info("LLM Gateway started")
    yield

    await _gateway.close()
    logger.info("LLM Gateway shut down")


app = FastAPI(
    title="Lurk LLM Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "healthy",
        "service": "llm-gateway",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/v1/llm/complete", response_model=CompletionResponse)
async def complete(request: CompletionRequest) -> CompletionResponse:
    """
    Send a completion request to Claude via the Anthropic SDK.

    Model selection is automatic based on agent_type and task_type
    (see LLMGateway.select_model).
    """
    if _gateway is None:
        raise HTTPException(status_code=503, detail="Gateway not initialised")

    try:
        return await _gateway.complete(request)
    except BudgetExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail=str(exc),
        ) from exc
    except ConcurrencyExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Completion request failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/v1/llm/tts")
async def generate_tts(request: TTSRequest) -> Response:
    """
    Generate TTS audio via OpenAI tts-1-hd.

    Returns raw audio bytes with appropriate content-type.
    """
    if _tts is None:
        raise HTTPException(status_code=503, detail="TTS service not initialised")

    try:
        audio_bytes, metadata = await _tts.generate(request)
        content_type = "audio/opus" if request.output_format == "opus" else "audio/mpeg"
        return Response(
            content=audio_bytes,
            media_type=content_type,
            headers={
                "X-Audio-Size-Bytes": str(metadata.audio_size_bytes),
                "X-Voice": metadata.voice,
                "X-Model": metadata.model,
                "X-Request-Id": metadata.request_id,
            },
        )
    except Exception as exc:
        logger.exception("TTS generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/v1/llm/usage", response_model=UsageResponse)
async def get_usage(
    org_id: str = Query(..., description="Organisation ID"),
    period: str = Query(
        default="",
        description="Date period (YYYY-MM-DD). Defaults to today.",
    ),
) -> UsageResponse:
    """Get token usage stats for an organisation."""
    if _meter is None:
        raise HTTPException(status_code=503, detail="Meter not initialised")

    if not period:
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    try:
        return await _meter.get_usage(org_id, period)
    except Exception as exc:
        logger.exception("Usage query failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class BudgetExceededError(Exception):
    """Raised when org or agent token budget is exhausted."""


class ConcurrencyExceededError(Exception):
    """Raised when max concurrent calls per org is exceeded."""


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    error_type = "budget_exceeded" if exc.status_code == 429 else "error"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "detail": exc.detail,
            "error_type": error_type,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "error_type": "internal",
            "status_code": 500,
        },
    )

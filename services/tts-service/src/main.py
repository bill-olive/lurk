"""TTS Service -- FastAPI application for text-to-speech generation."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .generator import (
    DEFAULT_FORMAT,
    DEFAULT_MODEL,
    DEFAULT_VOICE,
    MAX_INPUT_LENGTH,
    TTSConfig,
    TTSGenerator,
    TTSResult,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    """Request to generate speech from text."""

    text: str = Field(..., min_length=1, max_length=MAX_INPUT_LENGTH)
    model: str = Field(default=DEFAULT_MODEL)
    voice: str = Field(default=DEFAULT_VOICE)
    format: str = Field(default=DEFAULT_FORMAT)
    speed: float = Field(default=1.0, ge=0.25, le=4.0)


class PRNarrationRequest(BaseModel):
    """Request to generate a PR voice narration."""

    pr_title: str = Field(..., min_length=1, max_length=500)
    pr_summary: str = Field(..., min_length=1, max_length=2000)
    key_changes: list[str] = Field(default_factory=list)
    author: str = Field(..., min_length=1, max_length=200)
    model: str = Field(default=DEFAULT_MODEL)
    voice: str = Field(default=DEFAULT_VOICE)
    format: str = Field(default=DEFAULT_FORMAT)
    speed: float = Field(default=1.0, ge=0.25, le=4.0)


class MeetingSummaryRequest(BaseModel):
    """Request to generate a meeting summary narration."""

    meeting_title: str = Field(..., min_length=1, max_length=500)
    summary: str = Field(..., min_length=1, max_length=2000)
    action_items: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    model: str = Field(default=DEFAULT_MODEL)
    voice: str = Field(default=DEFAULT_VOICE)
    format: str = Field(default=DEFAULT_FORMAT)
    speed: float = Field(default=1.0, ge=0.25, le=4.0)


class TTSResponse(BaseModel):
    """Response from any TTS generation endpoint."""

    audio_url: str
    duration_estimate_seconds: float
    format: str
    voice: str
    model: str
    input_length: int
    content_hash: str


class HealthResponse(BaseModel):
    service: str = "tts-service"
    status: str = "ok"
    version: str = "0.1.0"


# ---------------------------------------------------------------------------
# Singleton generator
# ---------------------------------------------------------------------------

_generator: TTSGenerator | None = None


def _get_generator() -> TTSGenerator:
    global _generator
    if _generator is None:
        _generator = TTSGenerator()
    return _generator


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("TTS service starting up")
    _get_generator()
    yield
    logger.info("TTS service shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Lurk TTS Service",
    version="0.1.0",
    description="Text-to-speech generation service for Lurk platform.",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/v1/tts/generate", response_model=TTSResponse)
async def generate_speech(request: GenerateRequest) -> TTSResponse:
    """Generate speech audio from arbitrary text."""
    try:
        config = TTSConfig(
            model=request.model,
            voice=request.voice,
            format=request.format,
            speed=request.speed,
        )
        result = await _get_generator().generate(
            request.text, config=config, path_prefix="general"
        )
        return _to_response(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="TTS generation failed"
        ) from exc


@app.post("/v1/tts/pr-narration", response_model=TTSResponse)
async def generate_pr_narration(request: PRNarrationRequest) -> TTSResponse:
    """Generate a voice narration for a pull request."""
    try:
        config = TTSConfig(
            model=request.model,
            voice=request.voice,
            format=request.format,
            speed=request.speed,
        )
        result = await _get_generator().generate_pr_narration(
            pr_title=request.pr_title,
            pr_summary=request.pr_summary,
            key_changes=request.key_changes,
            author=request.author,
            config=config,
        )
        return _to_response(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("PR narration generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="PR narration generation failed"
        ) from exc


@app.post("/v1/tts/meeting-summary", response_model=TTSResponse)
async def generate_meeting_summary(
    request: MeetingSummaryRequest,
) -> TTSResponse:
    """Generate a voice narration for a meeting summary."""
    try:
        config = TTSConfig(
            model=request.model,
            voice=request.voice,
            format=request.format,
            speed=request.speed,
        )
        result = await _get_generator().generate_meeting_summary(
            meeting_title=request.meeting_title,
            summary=request.summary,
            action_items=request.action_items,
            decisions=request.decisions,
            config=config,
        )
        return _to_response(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(
            "Meeting summary narration failed: %s", exc, exc_info=True
        )
        raise HTTPException(
            status_code=500, detail="Meeting summary narration failed"
        ) from exc


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint for Cloud Run."""
    return HealthResponse()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(result: TTSResult) -> TTSResponse:
    return TTSResponse(
        audio_url=result.audio_url,
        duration_estimate_seconds=result.duration_estimate_seconds,
        format=result.format,
        voice=result.voice,
        model=result.model,
        input_length=result.input_length,
        content_hash=result.content_hash,
    )

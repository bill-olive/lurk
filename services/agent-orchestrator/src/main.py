"""
Agent Orchestrator — FastAPI application.

Cloud Run service implementing the agent execution loop from PRD Section 5.3.
Receives trigger events via Cloud Tasks / Pub/Sub and orchestrates the full
TRIGGER -> SCOPE -> CONTEXT -> ANALYZE -> DECIDE -> GATE -> EXECUTE -> AUDIT -> NOTIFY
pipeline.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .agent_executor import AgentExecutor
from .llm_client import LLMClient
from .models import (
    AgentExecutionRequest,
    AgentExecutionResult,
    AgentType,
    BatchExecuteRequest,
    BatchExecuteResponse,
    TriggerEvent,
    TriggerType,
)
from .safety import SafetyController

logger = logging.getLogger("agent-orchestrator")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

# ---------------------------------------------------------------------------
# Globals initialised at startup
# ---------------------------------------------------------------------------

_executor: AgentExecutor | None = None
_safety: SafetyController | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise shared resources on startup, tear down on shutdown."""
    global _executor, _safety

    llm_client = LLMClient(
        gateway_url=os.getenv("LLM_GATEWAY_URL", "http://localhost:8081"),
    )
    _safety = SafetyController()
    _executor = AgentExecutor(
        llm_client=llm_client,
        safety=_safety,
        api_gateway_url=os.getenv("API_GATEWAY_URL", "http://localhost:8000"),
        firestore_project=os.getenv("GCP_PROJECT"),
    )
    logger.info("Agent Orchestrator started")
    yield
    logger.info("Agent Orchestrator shutting down")
    await llm_client.close()


app = FastAPI(
    title="Lurk Agent Orchestrator",
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
# Middleware — request timing
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
        "service": "agent-orchestrator",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/v1/agent/execute", response_model=AgentExecutionResult)
async def execute_agent(request: AgentExecutionRequest) -> AgentExecutionResult:
    """
    Execute a single agent action.

    This endpoint is the main entry point invoked by Cloud Tasks or Pub/Sub
    push subscriptions when a trigger event fires.
    """
    if _executor is None:
        raise HTTPException(status_code=503, detail="Executor not initialised")

    try:
        result = await _executor.execute(request)
        return result
    except Exception as exc:
        logger.exception("Agent execution failed for request %s", request.request_id)
        return AgentExecutionResult(
            request_id=request.request_id,
            agent_id=request.trigger_event.agent_id,
            org_id=request.trigger_event.org_id,
            trigger_type=request.trigger_event.trigger_type,
            action_taken="skip",
            confidence=0.0,
            justification="Execution failed with an internal error",
            error=str(exc),
            created_at=datetime.now(timezone.utc),
        )


@app.post("/v1/agent/batch-execute", response_model=BatchExecuteResponse)
async def batch_execute(request: BatchExecuteRequest) -> BatchExecuteResponse:
    """
    Batch-execute agents for an organisation.

    Typically invoked by Cloud Scheduler for periodic agent runs (e.g. daily
    calendar review, weekly analytics).
    """
    if _executor is None:
        raise HTTPException(status_code=503, detail="Executor not initialised")

    try:
        response = await _executor.batch_execute(request)
        return response
    except Exception as exc:
        logger.exception("Batch execution failed for org %s", request.org_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status_code": 500},
    )

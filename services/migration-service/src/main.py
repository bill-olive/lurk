"""Migration Service -- FastAPI application for data migration orchestration."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .models import (
    ExecuteRequest,
    ExecuteResponse,
    HealthResponse,
    MigrationPlan,
    MigrationPlanRequest,
    RollbackRequest,
    RollbackResponse,
    StatusResponse,
)
from .pipeline import MigrationPipeline

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton pipeline
# ---------------------------------------------------------------------------

_pipeline: MigrationPipeline | None = None


def _get_pipeline() -> MigrationPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = MigrationPipeline()
    return _pipeline


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Migration service starting up")
    _get_pipeline()
    yield
    logger.info("Migration service shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Lurk Migration Service",
    version="0.1.0",
    description="Data migration orchestration service for Lurk platform.",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/v1/migrate/plan", response_model=MigrationPlan)
async def create_plan(request: MigrationPlanRequest) -> MigrationPlan:
    """Create a new migration plan.

    Validates the source configuration and estimates the scope of the
    migration without moving any data.
    """
    try:
        plan = await _get_pipeline().create_plan(
            org_id=request.org_id,
            user_id=request.user_id,
            source_config=request.source_config,
            redaction_level=request.redaction_level,
            dry_run=request.dry_run,
        )
        return plan
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to create migration plan: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to create migration plan"
        ) from exc


@app.post("/v1/migrate/execute", response_model=ExecuteResponse)
async def execute_migration(request: ExecuteRequest) -> ExecuteResponse:
    """Execute a previously-created migration plan.

    Progresses through all remaining pipeline stages:
    AUTHENTICATE -> EXTRACT -> CLASSIFY -> REDACT -> MAP -> PREVIEW -> COMMIT -> VERIFY -> CLEANUP
    """
    try:
        result = await _get_pipeline().execute(
            plan_id=request.plan_id, confirm=request.confirm
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Migration execution failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Migration execution failed"
        ) from exc


@app.post("/v1/migrate/rollback", response_model=RollbackResponse)
async def rollback_migration(request: RollbackRequest) -> RollbackResponse:
    """Rollback a completed or failed migration (or specific batch)."""
    try:
        result = await _get_pipeline().rollback(
            plan_id=request.plan_id,
            batch_id=request.batch_id,
            reason=request.reason,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Rollback failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Rollback failed") from exc


@app.get("/v1/migrate/status/{plan_id}", response_model=StatusResponse)
async def migration_status(plan_id: str) -> StatusResponse:
    """Get the current status of a migration plan."""
    try:
        return _get_pipeline().get_status(plan_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint for Cloud Run."""
    return HealthResponse()

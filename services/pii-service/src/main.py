"""PII Service -- FastAPI application for PII detection, redaction, and validation."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .detector import PIIDetector
from .models import (
    DetectRequest,
    DetectResponse,
    HealthResponse,
    PIIEntity,
    RedactRequest,
    RedactResponse,
    ValidateRequest,
    ValidateResponse,
    ValidationIssue,
)
from .redactor import RedactionEngine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------

_detector: PIIDetector | None = None
_engine: RedactionEngine | None = None


def _get_detector() -> PIIDetector:
    global _detector
    if _detector is None:
        _detector = PIIDetector()
    return _detector


def _get_engine() -> RedactionEngine:
    global _engine
    if _engine is None:
        _engine = RedactionEngine(detector=_get_detector())
    return _engine


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up heavy dependencies on startup."""
    logger.info("PII service starting up")
    _get_detector()  # trigger Presidio model load
    yield
    logger.info("PII service shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Lurk PII Service",
    version="0.1.0",
    description="PII detection, redaction, and validation service for Lurk platform.",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/v1/pii/detect", response_model=DetectResponse)
async def detect_pii(request: DetectRequest) -> DetectResponse:
    """Detect PII entities in text."""
    try:
        entities = _get_detector().detect(
            request.text,
            entity_types=request.entity_types,
            min_score=request.min_score,
            custom_patterns=request.custom_patterns,
        )
        return DetectResponse(
            entities=entities,
            entity_count=len(entities),
            text_length=len(request.text),
        )
    except Exception as exc:
        logger.error("Detection failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="PII detection failed") from exc


@app.post("/v1/pii/redact", response_model=RedactResponse)
async def redact_pii(request: RedactRequest) -> RedactResponse:
    """Redact PII from text."""
    try:
        redacted_text, count, entity_map = _get_engine().redact(
            request.text,
            level=request.level,
            entity_types=request.entity_types,
            min_score=request.min_score,
            custom_patterns=request.custom_patterns,
            return_entity_map=request.return_entity_map,
        )
        return RedactResponse(
            redacted_text=redacted_text,
            entities_redacted=count,
            entity_map=entity_map,
        )
    except Exception as exc:
        logger.error("Redaction failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="PII redaction failed") from exc


@app.post("/v1/pii/validate", response_model=ValidateResponse)
async def validate_redaction(request: ValidateRequest) -> ValidateResponse:
    """Server-side defense-in-depth: check that redacted text has no residual PII."""
    try:
        residual = _get_engine().validate(
            request.text,
            expected_level=request.expected_level,
            custom_patterns=request.custom_patterns,
        )
        issues = [
            ValidationIssue(
                entity_type=e.entity_type,
                text=e.text,
                start=e.start,
                end=e.end,
                score=e.score,
            )
            for e in residual
        ]
        return ValidateResponse(
            is_clean=len(issues) == 0,
            issues=issues,
            issues_count=len(issues),
        )
    except Exception as exc:
        logger.error("Validation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="PII validation failed") from exc


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint for Cloud Run."""
    return HealthResponse()

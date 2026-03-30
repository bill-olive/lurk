"""
Pydantic models for the LLM Gateway service.

Defines request/response shapes for completion, TTS, and usage endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Completion
# ---------------------------------------------------------------------------

class CompletionRequest(BaseModel):
    """Request body for POST /v1/llm/complete."""
    agent_id: str
    agent_type: str  # personal | team | org | function | migration | voice | calendar
    org_id: str
    task_type: str  # artifact_analysis | conflict_detection | meeting_summary | ...
    prompt: str
    system_prompt: str | None = None
    max_tokens: int = Field(default=4096, ge=1, le=200_000)
    temperature: float = Field(default=0.3, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CompletionResponse(BaseModel):
    """Response body for POST /v1/llm/complete."""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    finish_reason: str
    request_id: str
    latency_ms: int


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------

class TTSRequest(BaseModel):
    """Request body for POST /v1/llm/tts."""
    text: str = Field(max_length=4096)
    voice: str = "nova"
    org_id: str
    output_format: str = "opus"


class TTSResponse(BaseModel):
    """Metadata returned alongside TTS audio bytes."""
    audio_size_bytes: int
    voice: str
    model: str
    duration_estimate_seconds: float
    request_id: str


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

class UsageRecord(BaseModel):
    """Token usage for a single agent or org in a time window."""
    entity_id: str  # agent_id or org_id
    entity_type: str  # "agent" | "org"
    input_tokens: int
    output_tokens: int
    total_tokens: int
    request_count: int
    period: str  # e.g. "2026-03-29"
    model_breakdown: dict[str, int] = Field(default_factory=dict)  # model -> tokens


class UsageResponse(BaseModel):
    """Response body for GET /v1/llm/usage."""
    org_id: str
    period: str
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_requests: int
    budget_limit: int | None = None
    budget_used_pct: float | None = None
    agent_usage: list[UsageRecord] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Budget alert
# ---------------------------------------------------------------------------

class BudgetAlert(BaseModel):
    """Emitted when token usage crosses a threshold."""
    org_id: str
    agent_id: str | None = None
    threshold_pct: float  # 50 | 80 | 95
    current_pct: float
    budget_limit: int
    tokens_used: int
    period: str
    timestamp: datetime


# ---------------------------------------------------------------------------
# Error
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    """Standard error shape."""
    error: str
    detail: str
    error_type: str = "unknown"
    status_code: int = 500

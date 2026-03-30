"""Pydantic models for PII detection and redaction requests/responses."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class PIIEntityType(str, Enum):
    """All supported PII entity types."""

    # Regex-detected
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    SSN = "SSN"
    CREDIT_CARD = "CREDIT_CARD"
    API_KEY = "API_KEY"
    TOKEN = "TOKEN"
    PASSWORD = "PASSWORD"
    IP_ADDRESS = "IP_ADDRESS"
    URL = "URL"
    ACCOUNT_ID = "ACCOUNT_ID"

    # NER-detected (Presidio)
    PERSON = "PERSON"
    ORGANIZATION = "ORGANIZATION"
    ADDRESS = "ADDRESS"
    DATE_OF_BIRTH = "DATE_OF_BIRTH"

    # Context-detected
    FINANCIAL_TERM = "FINANCIAL_TERM"
    HEALTH_TERM = "HEALTH_TERM"
    LEGAL_PRIVILEGED = "LEGAL_PRIVILEGED"
    COMPENSATION = "COMPENSATION"

    # Custom
    CUSTOM = "CUSTOM"


class RedactionLevel(str, Enum):
    """Redaction aggressiveness levels."""

    AGGRESSIVE = "aggressive"
    STANDARD = "standard"
    MINIMAL = "minimal"
    NONE = "none"


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

class PIIEntity(BaseModel):
    """A single detected PII entity."""

    entity_type: PIIEntityType
    text: str = Field(..., description="The matched text span")
    start: int = Field(..., ge=0, description="Start character offset")
    end: int = Field(..., ge=0, description="End character offset")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    source: str = Field(
        ...,
        description="Detection source: regex | ner | context | custom",
    )


class DetectRequest(BaseModel):
    """Request to detect PII in text."""

    text: str = Field(..., min_length=1, max_length=100_000)
    entity_types: list[PIIEntityType] | None = Field(
        default=None,
        description="Filter to these entity types. None = detect all.",
    )
    min_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum confidence score to include.",
    )
    custom_patterns: list[CustomPattern] | None = Field(
        default=None,
        description="Org-specific custom regex patterns.",
    )


class DetectResponse(BaseModel):
    """Response containing detected PII entities."""

    entities: list[PIIEntity]
    entity_count: int
    text_length: int


# ---------------------------------------------------------------------------
# Redaction
# ---------------------------------------------------------------------------

class RedactRequest(BaseModel):
    """Request to redact PII from text."""

    text: str = Field(..., min_length=1, max_length=100_000)
    level: RedactionLevel = Field(default=RedactionLevel.STANDARD)
    entity_types: list[PIIEntityType] | None = Field(
        default=None,
        description="Limit redaction to these entity types.",
    )
    min_score: float = Field(default=0.5, ge=0.0, le=1.0)
    custom_patterns: list[CustomPattern] | None = None
    return_entity_map: bool = Field(
        default=False,
        description="If true, include the entity map in the response.",
    )


class EntityMapEntry(BaseModel):
    """Maps a redaction token back to original text."""

    token: str = Field(..., description="Replacement token, e.g. [PERSON_1]")
    original: str
    entity_type: PIIEntityType


class RedactResponse(BaseModel):
    """Response containing redacted text."""

    redacted_text: str
    entities_redacted: int
    entity_map: list[EntityMapEntry] | None = Field(
        default=None,
        description="Only populated when return_entity_map=true.",
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidateRequest(BaseModel):
    """Server-side defense-in-depth validation request.

    Checks that a previously-redacted payload does not leak PII.
    """

    text: str = Field(..., min_length=1, max_length=100_000)
    expected_level: RedactionLevel = Field(default=RedactionLevel.STANDARD)
    custom_patterns: list[CustomPattern] | None = None


class ValidationIssue(BaseModel):
    """A residual PII finding in supposedly-redacted text."""

    entity_type: PIIEntityType
    text: str
    start: int
    end: int
    score: float


class ValidateResponse(BaseModel):
    """Validation result."""

    is_clean: bool
    issues: list[ValidationIssue]
    issues_count: int


# ---------------------------------------------------------------------------
# Custom patterns (org-configurable)
# ---------------------------------------------------------------------------

class CustomPattern(BaseModel):
    """An org-defined custom regex pattern for PII detection."""

    name: str = Field(..., min_length=1, max_length=128)
    pattern: str = Field(..., description="Python regex pattern string")
    entity_type: PIIEntityType = Field(default=PIIEntityType.CUSTOM)
    score: float = Field(default=0.85, ge=0.0, le=1.0)
    context_words: list[str] | None = Field(
        default=None,
        description="Nearby words that boost confidence.",
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    service: str = "pii-service"
    status: str = "ok"
    version: str = "0.1.0"


# Forward ref update (DetectRequest references CustomPattern)
DetectRequest.model_rebuild()
RedactRequest.model_rebuild()
ValidateRequest.model_rebuild()

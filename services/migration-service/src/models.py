"""Pydantic models for the migration service."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class MigrationSource(str, Enum):
    SLACK = "slack"
    GDRIVE = "gdrive"
    NOTION = "notion"


class MigrationStage(str, Enum):
    PLAN = "plan"
    AUTHENTICATE = "authenticate"
    EXTRACT = "extract"
    CLASSIFY = "classify"
    REDACT = "redact"
    MAP = "map"
    PREVIEW = "preview"
    COMMIT = "commit"
    VERIFY = "verify"
    CLEANUP = "cleanup"


class MigrationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    PAUSED = "paused"


class ArtifactType(str, Enum):
    """Content artifact types from PRD."""
    MESSAGE = "message"
    THREAD = "thread"
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    PDF = "pdf"
    IMAGE = "image"
    FILE = "file"
    PAGE = "page"
    DATABASE = "database"
    DECISION = "decision"
    ACTION_ITEM = "action_item"
    MEETING_NOTES = "meeting_notes"
    TOPIC_CLUSTER = "topic_cluster"


class SensitivityLevel(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class SlackChannelType(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    DM = "dm"
    GROUP_DM = "group_dm"


# ---------------------------------------------------------------------------
# Content classification
# ---------------------------------------------------------------------------

class ContentClassification(BaseModel):
    artifact_type: ArtifactType
    sensitivity: SensitivityLevel = SensitivityLevel.INTERNAL
    is_customer_facing: bool = False
    tags: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Migration plan
# ---------------------------------------------------------------------------

class SourceConfig(BaseModel):
    """Configuration for a migration source."""
    source: MigrationSource
    credentials_ref: str = Field(
        ..., description="Reference to stored OAuth/API credentials"
    )
    scope: dict[str, Any] = Field(
        default_factory=dict,
        description="Source-specific scope (channels, folders, pages, etc.)",
    )
    options: dict[str, Any] = Field(default_factory=dict)


class MigrationPlanRequest(BaseModel):
    """Request to create a migration plan."""
    org_id: str
    user_id: str
    source_config: SourceConfig
    redaction_level: str = "standard"
    dry_run: bool = False


class MigrationItem(BaseModel):
    """A single item to be migrated."""
    source_id: str
    source_type: str
    title: str | None = None
    size_bytes: int | None = None
    classification: ContentClassification | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MigrationPlan(BaseModel):
    """A complete migration plan."""
    plan_id: str
    org_id: str
    user_id: str
    source: MigrationSource
    status: MigrationStatus = MigrationStatus.PENDING
    items: list[MigrationItem] = Field(default_factory=list)
    total_items: int = 0
    estimated_duration_seconds: int | None = None
    redaction_level: str = "standard"
    dry_run: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    stages_completed: list[MigrationStage] = Field(default_factory=list)
    current_stage: MigrationStage | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

class ExecuteRequest(BaseModel):
    """Request to execute a migration plan."""
    plan_id: str
    confirm: bool = Field(
        default=False,
        description="Must be true to execute a non-dry-run migration.",
    )


class BatchProgress(BaseModel):
    """Progress for a single batch within a migration."""
    batch_id: str
    stage: MigrationStage
    items_total: int = 0
    items_processed: int = 0
    items_failed: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ExecuteResponse(BaseModel):
    plan_id: str
    status: MigrationStatus
    current_stage: MigrationStage | None = None
    progress: BatchProgress | None = None
    message: str = ""


# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------

class RollbackRequest(BaseModel):
    plan_id: str
    batch_id: str | None = None
    reason: str = ""


class RollbackResponse(BaseModel):
    plan_id: str
    status: MigrationStatus
    items_rolled_back: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

class StatusResponse(BaseModel):
    plan: MigrationPlan
    batches: list[BatchProgress] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Slack-specific
# ---------------------------------------------------------------------------

class SlackChannel(BaseModel):
    channel_id: str
    name: str
    channel_type: SlackChannelType
    member_count: int = 0
    message_count: int = 0
    is_archived: bool = False


class SlackMessage(BaseModel):
    message_id: str
    channel_id: str
    user_id: str
    text: str
    timestamp: str
    thread_ts: str | None = None
    reactions: list[dict[str, Any]] = Field(default_factory=list)
    files: list[dict[str, Any]] = Field(default_factory=list)
    classification: ContentClassification | None = None


# ---------------------------------------------------------------------------
# Intelligence layer
# ---------------------------------------------------------------------------

class TopicCluster(BaseModel):
    cluster_id: str
    topic: str
    message_ids: list[str]
    confidence: float = 0.0


class ExtractedDecision(BaseModel):
    decision_id: str
    summary: str
    source_message_ids: list[str]
    participants: list[str] = Field(default_factory=list)
    timestamp: datetime | None = None


class DeduplicationResult(BaseModel):
    original_count: int
    deduplicated_count: int
    duplicates_removed: int
    duplicate_pairs: list[tuple[str, str]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    service: str = "migration-service"
    status: str = "ok"
    version: str = "0.1.0"

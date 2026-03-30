"""
Pydantic models for the Agent Orchestrator service.

Mirrors the TypeScript types from packages/shared-types and the PRD
primitives (Sections 4.1 - 4.6, 5.3, 5.4).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ArtifactType(str, Enum):
    # Documents
    DOCUMENT_GDOC = "document:gdoc"
    DOCUMENT_NOTION = "document:notion"
    DOCUMENT_MARKDOWN = "document:markdown"
    DOCUMENT_PDF = "document:pdf"
    DOCUMENT_WORD = "document:word"
    DOCUMENT_NOTE = "document:note"
    DOCUMENT_WIKI = "document:wiki"
    # Code
    CODE_COMMIT = "code:commit"
    CODE_PR = "code:pr"
    CODE_FILE = "code:file"
    CODE_SNIPPET = "code:snippet"
    CODE_REVIEW = "code:review"
    # Communication
    COMM_EMAIL_SENT = "comm:email_sent"
    COMM_EMAIL_RECEIVED = "comm:email_received"
    COMM_CALL_RECORDING = "comm:call_recording"
    COMM_CALL_TRANSCRIPT = "comm:call_transcript"
    COMM_CALL_SUMMARY = "comm:call_summary"
    COMM_CHAT_THREAD = "comm:chat_thread"
    # Data
    DATA_SPREADSHEET = "data:spreadsheet"
    DATA_CSV = "data:csv"
    DATA_DASHBOARD = "data:dashboard"
    DATA_REPORT = "data:report"
    DATA_CRM_RECORD = "data:crm_record"
    DATA_ISSUE_TRACKER = "data:issue_tracker"
    # Design
    DESIGN_FIGMA = "design:figma"
    DESIGN_SKETCH = "design:sketch"
    DESIGN_SCREENSHOT = "design:screenshot"
    # Meta (agent-generated)
    META_SYNTHESIS = "meta:synthesis"
    META_STATUS = "meta:status"
    META_CONFLICT = "meta:conflict"
    META_RECOMMENDATION = "meta:recommendation"
    META_CUSTOMER_HEALTH = "meta:customer_health"
    META_ANALYTICS_REPORT = "meta:analytics_report"
    META_CALENDAR_REVIEW = "meta:calendar_review"
    # Migration
    MIGRATION_SLACK_MESSAGE = "migration:slack_message"
    MIGRATION_SLACK_FILE = "migration:slack_file"
    MIGRATION_DRIVE_FILE = "migration:drive_file"
    MIGRATION_NOTION_PAGE = "migration:notion_page"
    MIGRATION_EMAIL_ARCHIVE = "migration:email_archive"
    MIGRATION_JIRA_ISSUE = "migration:jira_issue"


class CaptureMethod(str, Enum):
    CHROME_DOM = "chrome_dom"
    CHROME_API = "chrome_api"
    MAC_AUDIO = "mac_audio"
    MAC_FILESYSTEM = "mac_filesystem"
    MAC_IDE = "mac_ide"
    IOS_VOICE = "ios_voice"
    IOS_PHOTO = "ios_photo"
    MIGRATION_IMPORT = "migration_import"
    API_INGEST = "api_ingest"
    AGENT_GENERATED = "agent_generated"


class SensitivityLevel(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class AgentType(str, Enum):
    PERSONAL = "personal"
    TEAM = "team"
    ORG = "org"
    FUNCTION = "function"
    MIGRATION = "migration"
    VOICE = "voice"
    CALENDAR = "calendar"


class ForkStatus(str, Enum):
    ACTIVE = "active"
    MERGED = "merged"
    ABANDONED = "abandoned"
    REJECTED = "rejected"


class PRStatus(str, Enum):
    OPEN = "open"
    APPROVED = "approved"
    MERGED = "merged"
    REJECTED = "rejected"
    CLOSED = "closed"
    AUTO_MERGED = "auto_merged"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_CHANGES = "request_changes"
    COMMENT = "comment"


class TriggerType(str, Enum):
    ARTIFACT_COMMITTED = "artifact_committed"
    ARTIFACT_MODIFIED = "artifact_modified"
    SCHEDULE = "schedule"
    PR_OPENED = "pr_opened"
    PR_MERGED = "pr_merged"
    KEYWORD_DETECTED = "keyword_detected"
    CONFLICT_DETECTED = "conflict_detected"
    STALENESS_THRESHOLD = "staleness_threshold"
    CUSTOMER_EVENT = "customer_event"
    MEETING_ENDED = "meeting_ended"
    CALENDAR_EVENT = "calendar_event"
    MIGRATION_BATCH = "migration_batch"
    MANUAL = "manual"


class AgentActionType(str, Enum):
    FORK = "fork"
    PR = "pr"
    SYNTHESIZE = "synthesize"
    NOTIFY = "notify"
    SKIP = "skip"


class AgentCapability(str, Enum):
    READ_ARTIFACTS = "read_artifacts"
    FORK_ARTIFACTS = "fork_artifacts"
    OPEN_PRS = "open_prs"
    SYNTHESIZE = "synthesize"
    SUMMARIZE = "summarize"
    DETECT_CONFLICTS = "detect_conflicts"
    RECOMMEND = "recommend"
    NOTIFY = "notify"
    AUTO_MERGE = "auto_merge"
    SCORE_CUSTOMER_HEALTH = "score_customer_health"
    ANALYZE_ARTIFACTS = "analyze_artifacts"
    REVIEW_CALENDAR = "review_calendar"
    VOICE_NARRATE = "voice_narrate"
    MIGRATE_DATA = "migrate_data"
    BROWSE_WEB = "browse_web"


# ---------------------------------------------------------------------------
# Supporting models
# ---------------------------------------------------------------------------

class FeatureBundle(BaseModel):
    topic_vectors: list[float] = Field(default_factory=list)
    entity_counts: dict[str, int] = Field(default_factory=dict)
    key_phrases: list[str] = Field(default_factory=list)
    language: str = "en"
    word_count: int = 0
    section_headers: list[str] = Field(default_factory=list)
    custom_features: dict[str, Any] = Field(default_factory=dict)


class ArtifactMetadata(BaseModel):
    page_count: int | None = None
    duration_seconds: float | None = None
    speaker_count: int | None = None
    sheet_count: int | None = None
    slide_count: int | None = None
    participants: list[str] | None = None
    calendar_event_id: str | None = None
    meeting_platform: str | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class CustomerRef(BaseModel):
    customer_id: str
    customer_name: str
    context: str
    detected_at: datetime


class ForkRef(BaseModel):
    fork_id: str
    upstream_artifact_id: str
    upstream_version: int
    upstream_ledger_id: str


class MergeRef(BaseModel):
    pr_id: str
    target_artifact_id: str
    target_ledger_id: str
    merged_at: datetime


class RelationRef(BaseModel):
    artifact_id: str
    ledger_id: str
    relation_type: str
    confidence: float
    discovered_by: str
    discovered_at: datetime


class CustomerHealthSignal(BaseModel):
    customer_id: str
    health_score: float = Field(ge=0, le=100)
    trend: str  # improving | stable | declining | critical
    signals: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    alert_level: str = "none"  # none | watch | action_required | escalation


# ---------------------------------------------------------------------------
# Core domain models
# ---------------------------------------------------------------------------

class Artifact(BaseModel):
    id: str
    ledger_id: str
    org_id: str
    type: ArtifactType
    title: str
    source_url: str | None = None
    source_app: str
    mime_type: str
    capture_method: CaptureMethod
    content_hash: str
    redacted_content: str | None = None
    feature_bundle: FeatureBundle
    metadata: ArtifactMetadata
    tags: list[str] = Field(default_factory=list)
    customer_facing: bool = False
    customer_refs: list[CustomerRef] = Field(default_factory=list)
    sensitivity: SensitivityLevel = SensitivityLevel.INTERNAL
    customer_health: CustomerHealthSignal | None = None
    author_id: str
    owner_ids: list[str] = Field(default_factory=list)
    team_ids: list[str] = Field(default_factory=list)
    version: int = 1
    parent_version: int | None = None
    commit_hash: str = ""
    commit_message: str = ""
    branch_id: str | None = None
    captured_at: datetime
    modified_at: datetime
    committed_at: datetime
    access_tier: str = "owner"
    acl_overrides: list[dict[str, Any]] = Field(default_factory=list)
    forked_from: ForkRef | None = None
    merged_into: MergeRef | None = None
    related_artifacts: list[RelationRef] = Field(default_factory=list)
    quality_score: float | None = None
    staleness_score: float | None = None
    coverage_gaps: list[str] | None = None


class Agent(BaseModel):
    id: str
    org_id: str
    name: str
    type: AgentType
    description: str = ""
    owner_id: str
    owner_type: str = "user"  # user | team | org
    read_scope: dict[str, Any] = Field(default_factory=dict)
    write_scope: dict[str, Any] = Field(default_factory=dict)
    action_budget: ActionBudget | None = None
    triggers: list[TriggerConfig] = Field(default_factory=list)
    capabilities: list[AgentCapability] = Field(default_factory=list)
    model_config_data: dict[str, Any] = Field(default_factory=dict, alias="model_config")
    template_id: str | None = None
    custom_prompts: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "active"
    last_run_at: datetime | None = None
    total_actions: int = 0
    acceptance_rate: float = 0.0
    created_by: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"populate_by_name": True}


class ActionBudget(BaseModel):
    max_forks_per_hour: int = 20
    max_prs_per_day: int = 50
    max_tokens_per_day: int = 500_000
    require_approval_above: float = 0.7
    cost_cap_per_month: float = 100.0


class TriggerConfig(BaseModel):
    type: TriggerType
    filter: dict[str, Any] = Field(default_factory=dict)
    debounce_ms: int = 5000
    enabled: bool = True


class Fork(BaseModel):
    id: str
    org_id: str
    upstream_artifact_id: str
    upstream_version: int
    upstream_ledger_id: str
    fork_ledger_id: str
    fork_branch_id: str
    artifact_id: str
    agent_id: str
    agent_type: AgentType
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)
    status: ForkStatus = ForkStatus.ACTIVE
    created_at: datetime
    updated_at: datetime


class DiffHunk(BaseModel):
    old_start: int
    old_lines: int
    new_start: int
    new_lines: int
    content: str


class Diff(BaseModel):
    type: str = "text"  # text | structured | binary | multimodal
    hunks: list[DiffHunk] = Field(default_factory=list)
    summary: str = ""
    added_lines: int = 0
    removed_lines: int = 0
    changed_sections: list[str] = Field(default_factory=list)
    voice_narration: str | None = None


class PullRequest(BaseModel):
    id: str
    org_id: str
    fork_id: str
    source_artifact_id: str
    target_artifact_id: str
    target_ledger_id: str
    title: str
    description: str = ""
    diff: Diff
    change_summary: str = ""
    agent_id: str
    agent_type: AgentType
    confidence: float = Field(ge=0.0, le=1.0)
    justification: str = ""
    source_refs: list[dict[str, Any]] = Field(default_factory=list)
    status: PRStatus = PRStatus.OPEN
    reviewer_id: str | None = None
    review_action: ReviewAction | None = None
    review_comment: str | None = None
    reviewed_at: datetime | None = None
    auto_merge_eligible: bool = False
    auto_merged_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    merged_at: datetime | None = None
    closed_at: datetime | None = None


# ---------------------------------------------------------------------------
# Execution request/response models (PRD Section 5.3)
# ---------------------------------------------------------------------------

class TriggerEvent(BaseModel):
    """Event that triggers agent execution."""
    trigger_type: TriggerType
    agent_id: str
    org_id: str
    artifact_id: str | None = None
    artifact_ids: list[str] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime
    source: str = "system"
    chain_depth: int = 0  # for cascade protection


class AgentAction(BaseModel):
    """Structured decision returned by the LLM analysis step."""
    action: AgentActionType
    confidence: float = Field(ge=0.0, le=1.0)
    justification: str
    target_artifact_id: str | None = None
    proposed_changes: str | None = None
    proposed_title: str | None = None
    synthesis_content: str | None = None
    notification_message: str | None = None
    source_refs: list[dict[str, Any]] = Field(default_factory=list)


class AgentExecutionRequest(BaseModel):
    """Request to execute an agent action, typically from Cloud Tasks / Pub/Sub."""
    request_id: str
    trigger_event: TriggerEvent
    agent: Agent | None = None  # optionally included; otherwise loaded from Firestore
    priority: int = 0  # 0 = normal, 1 = high
    retry_count: int = 0
    max_retries: int = 3
    idempotency_key: str | None = None


class AgentExecutionResult(BaseModel):
    """Result of an agent execution cycle."""
    request_id: str
    agent_id: str
    org_id: str
    trigger_type: TriggerType
    action_taken: AgentActionType
    confidence: float
    justification: str
    artifacts_read: int = 0
    artifacts_created: int = 0
    prs_opened: int = 0
    tokens_used: int = 0
    duration_ms: int = 0
    gated: bool = False
    gate_reason: str | None = None
    error: str | None = None
    created_at: datetime


class BatchExecuteRequest(BaseModel):
    """Request to batch-execute agents, typically for scheduled runs."""
    org_id: str
    agent_type: AgentType | None = None
    agent_ids: list[str] = Field(default_factory=list)
    trigger_type: TriggerType = TriggerType.SCHEDULE


class BatchExecuteResponse(BaseModel):
    """Response from batch execution."""
    org_id: str
    total_agents: int
    executed: int
    skipped: int
    errors: int
    results: list[AgentExecutionResult] = Field(default_factory=list)

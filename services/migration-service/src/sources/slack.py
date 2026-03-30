"""Slack migration source implementation.

Implements PRD Section 7.3:
  - Channel migration (public, private, DMs, group DMs)
  - Message classification
  - File migration
  - Relationship mapping
  - Intelligence layer (dedup, topic clustering, decision extraction)
"""

from __future__ import annotations

import hashlib
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx

from ..classifier import ContentClassifier
from ..models import (
    ArtifactType,
    ContentClassification,
    DeduplicationResult,
    ExtractedDecision,
    MigrationItem,
    MigrationSource,
    SlackChannel,
    SlackChannelType,
    SlackMessage,
    TopicCluster,
)
from .base import BaseMigrationSource, ExtractionResult, MappedItem

logger = logging.getLogger(__name__)

_SLACK_API_BASE = "https://slack.com/api"


@dataclass
class SlackIntelligenceResults:
    """Aggregated intelligence layer results."""

    dedup: DeduplicationResult | None = None
    topic_clusters: list[TopicCluster] = field(default_factory=list)
    decisions: list[ExtractedDecision] = field(default_factory=list)


class SlackMigrationSource(BaseMigrationSource):
    """Migrates Slack workspace data into Lurk.

    Scope options:
      - channel_ids: list[str] -- specific channels to migrate
      - channel_types: list[str] -- filter by type (public, private, dm, group_dm)
      - include_archived: bool -- include archived channels (default False)
      - include_files: bool -- include file attachments (default True)
      - since: str -- ISO datetime; only messages after this date
      - intelligence: bool -- run intelligence layer (default True)
    """

    def __init__(self, credentials_ref: str, options: dict[str, Any] | None = None):
        super().__init__(credentials_ref, options)
        self._token: str | None = None
        self._client: httpx.AsyncClient | None = None
        self._intelligence_results: SlackIntelligenceResults | None = None

    @property
    def source_type(self) -> MigrationSource:
        return MigrationSource.SLACK

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def authenticate(self) -> bool:
        """Authenticate with Slack using the stored Bot/User OAuth token."""
        # In production, resolve credentials_ref from a secret manager.
        # Here we assume the token is stored and retrievable.
        self._token = self.credentials_ref  # placeholder resolution
        self._client = httpx.AsyncClient(
            base_url=_SLACK_API_BASE,
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=30.0,
        )

        resp = await self._client.post("auth.test")
        data = resp.json()
        if not data.get("ok"):
            raise ConnectionError(f"Slack auth failed: {data.get('error')}")

        self._authenticated = True
        logger.info("Slack authenticated as team=%s", data.get("team"))
        return True

    # ------------------------------------------------------------------
    # Extraction
    # ------------------------------------------------------------------

    async def extract_items(
        self,
        scope: dict[str, Any],
    ) -> AsyncIterator[ExtractionResult]:
        """Extract messages and files from Slack channels."""
        assert self._client is not None, "Must authenticate before extraction"

        channels = await self._resolve_channels(scope)

        for channel in channels:
            logger.info(
                "Extracting channel %s (%s)", channel.name, channel.channel_id
            )
            async for message in self._extract_channel_messages(
                channel, scope.get("since")
            ):
                yield message

            if scope.get("include_files", True):
                async for file_item in self._extract_channel_files(channel):
                    yield file_item

    async def _resolve_channels(
        self, scope: dict[str, Any]
    ) -> list[SlackChannel]:
        """Resolve which channels to migrate based on scope filters."""
        assert self._client is not None

        explicit_ids: list[str] | None = scope.get("channel_ids")
        type_filter: list[str] | None = scope.get("channel_types")
        include_archived: bool = scope.get("include_archived", False)

        channels: list[SlackChannel] = []
        cursor: str | None = None

        while True:
            params: dict[str, Any] = {"limit": 200}
            if type_filter:
                params["types"] = ",".join(
                    self._lurk_to_slack_channel_type(t) for t in type_filter
                )
            else:
                params["types"] = "public_channel,private_channel,mpim,im"
            if cursor:
                params["cursor"] = cursor

            resp = await self._client.get("conversations.list", params=params)
            data = resp.json()
            if not data.get("ok"):
                logger.error("conversations.list error: %s", data.get("error"))
                break

            for ch in data.get("channels", []):
                if not include_archived and ch.get("is_archived", False):
                    continue
                if explicit_ids and ch["id"] not in explicit_ids:
                    continue

                channel_type = self._detect_channel_type(ch)
                channels.append(
                    SlackChannel(
                        channel_id=ch["id"],
                        name=ch.get("name", ch["id"]),
                        channel_type=channel_type,
                        member_count=ch.get("num_members", 0),
                        is_archived=ch.get("is_archived", False),
                    )
                )

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

        logger.info("Resolved %d channels for migration", len(channels))
        return channels

    async def _extract_channel_messages(
        self,
        channel: SlackChannel,
        since: str | None = None,
    ) -> AsyncIterator[ExtractionResult]:
        """Paginate through channel history and yield messages."""
        assert self._client is not None

        cursor: str | None = None
        while True:
            params: dict[str, Any] = {
                "channel": channel.channel_id,
                "limit": 200,
            }
            if since:
                params["oldest"] = since
            if cursor:
                params["cursor"] = cursor

            resp = await self._client.get("conversations.history", params=params)
            data = resp.json()
            if not data.get("ok"):
                logger.error(
                    "conversations.history error for %s: %s",
                    channel.channel_id,
                    data.get("error"),
                )
                break

            for msg in data.get("messages", []):
                text = msg.get("text", "")
                yield ExtractionResult(
                    source_id=f"{channel.channel_id}:{msg.get('ts', '')}",
                    source_type="message",
                    title=None,
                    content=text,
                    size_bytes=len(text.encode("utf-8")),
                    metadata={
                        "channel_id": channel.channel_id,
                        "channel_name": channel.name,
                        "channel_type": channel.channel_type.value,
                        "user_id": msg.get("user"),
                        "timestamp": msg.get("ts"),
                        "thread_ts": msg.get("thread_ts"),
                        "reactions": msg.get("reactions", []),
                        "has_files": bool(msg.get("files")),
                    },
                    raw=msg,
                )

                # Extract thread replies
                if msg.get("reply_count", 0) > 0:
                    async for reply in self._extract_thread_replies(
                        channel.channel_id, msg["ts"]
                    ):
                        yield reply

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor or not data.get("has_more", False):
                break

    async def _extract_thread_replies(
        self,
        channel_id: str,
        thread_ts: str,
    ) -> AsyncIterator[ExtractionResult]:
        """Extract replies in a thread."""
        assert self._client is not None

        cursor: str | None = None
        while True:
            params: dict[str, Any] = {
                "channel": channel_id,
                "ts": thread_ts,
                "limit": 200,
            }
            if cursor:
                params["cursor"] = cursor

            resp = await self._client.get("conversations.replies", params=params)
            data = resp.json()
            if not data.get("ok"):
                break

            for msg in data.get("messages", []):
                # Skip the parent message (already extracted)
                if msg.get("ts") == thread_ts and not msg.get("parent_user_id"):
                    continue

                text = msg.get("text", "")
                yield ExtractionResult(
                    source_id=f"{channel_id}:{msg.get('ts', '')}",
                    source_type="message",
                    content=text,
                    size_bytes=len(text.encode("utf-8")),
                    metadata={
                        "channel_id": channel_id,
                        "user_id": msg.get("user"),
                        "timestamp": msg.get("ts"),
                        "thread_ts": thread_ts,
                        "is_reply": True,
                    },
                    raw=msg,
                )

            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor or not data.get("has_more", False):
                break

    async def _extract_channel_files(
        self,
        channel: SlackChannel,
    ) -> AsyncIterator[ExtractionResult]:
        """Extract files shared in a channel."""
        assert self._client is not None

        page = 1
        while True:
            params: dict[str, Any] = {
                "channel": channel.channel_id,
                "page": page,
                "count": 100,
            }
            resp = await self._client.get("files.list", params=params)
            data = resp.json()
            if not data.get("ok"):
                break

            for f in data.get("files", []):
                yield ExtractionResult(
                    source_id=f"file:{f['id']}",
                    source_type="file",
                    title=f.get("title", f.get("name", "")),
                    content="",  # binary content handled separately
                    size_bytes=f.get("size", 0),
                    metadata={
                        "channel_id": channel.channel_id,
                        "filename": f.get("name"),
                        "mime_type": f.get("mimetype"),
                        "file_type": f.get("filetype"),
                        "url_private_download": f.get("url_private_download"),
                        "user_id": f.get("user"),
                        "created": f.get("created"),
                    },
                    raw=f,
                )

            paging = data.get("paging", {})
            if page >= paging.get("pages", 1):
                break
            page += 1

    # ------------------------------------------------------------------
    # Mapping
    # ------------------------------------------------------------------

    def _map_to_lurk(
        self,
        extraction: ExtractionResult,
        migration_item: MigrationItem,
        classification: ContentClassification,
    ) -> MappedItem:
        """Map a Slack extraction to the Lurk data model."""
        lurk_id = self._generate_lurk_id(MigrationSource.SLACK, extraction.source_id)
        collection = self._collection_for_type(classification.artifact_type)

        relationships: dict[str, list[str]] = {}

        # Thread relationship
        thread_ts = extraction.metadata.get("thread_ts")
        if thread_ts:
            parent_source_id = (
                f"{extraction.metadata.get('channel_id', '')}:{thread_ts}"
            )
            parent_lurk_id = self._generate_lurk_id(
                MigrationSource.SLACK, parent_source_id
            )
            relationships["parent_thread"] = [parent_lurk_id]

        # Channel relationship
        channel_id = extraction.metadata.get("channel_id")
        if channel_id:
            channel_lurk_id = self._generate_lurk_id(
                MigrationSource.SLACK, f"channel:{channel_id}"
            )
            relationships["channel"] = [channel_lurk_id]

        return MappedItem(
            migration_item=migration_item,
            content=extraction.content,
            lurk_collection=collection,
            lurk_document_id=lurk_id,
            relationships=relationships,
        )

    # ------------------------------------------------------------------
    # Intelligence layer
    # ------------------------------------------------------------------

    async def run_intelligence(
        self, items: list[ExtractionResult]
    ) -> SlackIntelligenceResults:
        """Run the intelligence layer: dedup, topic clustering, decision extraction."""
        results = SlackIntelligenceResults()
        results.dedup = self._deduplicate_messages(items)
        results.topic_clusters = self._cluster_topics(items)
        results.decisions = self._extract_decisions(items)
        self._intelligence_results = results
        return results

    def _deduplicate_messages(
        self, items: list[ExtractionResult]
    ) -> DeduplicationResult:
        """Detect and flag duplicate messages across channels."""
        fingerprints: dict[str, list[str]] = defaultdict(list)
        for item in items:
            if item.source_type != "message" or not item.content.strip():
                continue
            fp = hashlib.md5(
                item.content.strip().lower().encode("utf-8")
            ).hexdigest()
            fingerprints[fp].append(item.source_id)

        duplicate_pairs: list[tuple[str, str]] = []
        duplicates_removed = 0
        for fp, ids in fingerprints.items():
            if len(ids) > 1:
                for dup_id in ids[1:]:
                    duplicate_pairs.append((ids[0], dup_id))
                    duplicates_removed += 1

        return DeduplicationResult(
            original_count=len(items),
            deduplicated_count=len(items) - duplicates_removed,
            duplicates_removed=duplicates_removed,
            duplicate_pairs=duplicate_pairs,
        )

    def _cluster_topics(
        self, items: list[ExtractionResult]
    ) -> list[TopicCluster]:
        """Basic keyword-based topic clustering.

        In production this would use an LLM or embeddings-based approach.
        """
        topic_keywords: dict[str, set[str]] = {
            "engineering": {
                "deploy",
                "release",
                "bug",
                "fix",
                "feature",
                "pr",
                "merge",
                "build",
                "ci",
                "cd",
                "pipeline",
                "test",
                "code review",
            },
            "product": {
                "roadmap",
                "spec",
                "prd",
                "requirement",
                "user story",
                "epic",
                "milestone",
                "launch",
                "beta",
            },
            "design": {
                "figma",
                "mockup",
                "wireframe",
                "prototype",
                "ui",
                "ux",
                "design review",
                "component",
            },
            "operations": {
                "incident",
                "outage",
                "alert",
                "monitor",
                "sla",
                "runbook",
                "on-call",
                "pager",
            },
            "hiring": {
                "candidate",
                "interview",
                "offer",
                "hire",
                "recruiting",
                "headcount",
                "job description",
                "jd",
            },
        }

        clusters: dict[str, list[str]] = defaultdict(list)
        for item in items:
            if item.source_type != "message":
                continue
            text_lower = item.content.lower()
            for topic, keywords in topic_keywords.items():
                if any(kw in text_lower for kw in keywords):
                    clusters[topic].append(item.source_id)

        return [
            TopicCluster(
                cluster_id=hashlib.md5(topic.encode()).hexdigest()[:16],
                topic=topic,
                message_ids=ids,
                confidence=min(1.0, len(ids) * 0.05 + 0.3),
            )
            for topic, ids in clusters.items()
            if ids
        ]

    def _extract_decisions(
        self, items: list[ExtractionResult]
    ) -> list[ExtractedDecision]:
        """Extract decision-like messages.

        In production this would use an LLM for semantic extraction.
        """
        decision_signals = {
            "decided",
            "decision",
            "agreed",
            "approved",
            "go with",
            "final call",
            "green light",
            "sign off",
        }

        decisions: list[ExtractedDecision] = []
        for item in items:
            if item.source_type != "message":
                continue
            text_lower = item.content.lower()
            if any(signal in text_lower for signal in decision_signals):
                decisions.append(
                    ExtractedDecision(
                        decision_id=hashlib.md5(
                            item.source_id.encode()
                        ).hexdigest()[:16],
                        summary=item.content[:200],
                        source_message_ids=[item.source_id],
                        participants=[item.metadata.get("user_id", "unknown")],
                    )
                )

        return decisions

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_channel_type(ch: dict[str, Any]) -> SlackChannelType:
        if ch.get("is_im"):
            return SlackChannelType.DM
        if ch.get("is_mpim"):
            return SlackChannelType.GROUP_DM
        if ch.get("is_private"):
            return SlackChannelType.PRIVATE
        return SlackChannelType.PUBLIC

    @staticmethod
    def _lurk_to_slack_channel_type(t: str) -> str:
        mapping = {
            "public": "public_channel",
            "private": "private_channel",
            "dm": "im",
            "group_dm": "mpim",
        }
        return mapping.get(t, t)

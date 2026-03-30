"""
Migration agent — PRD Section 7.

Scope:  Migration batches from external platforms.
Model:  Sonnet 4.6 (high volume, needs speed).
Purpose: Classify imported content, map relationships, and ensure clean import.

Handles:
- Slack-specific migration logic (PRD 7.3)
- Content classification into ArtifactType
- Relationship mapping across imported items
- Deduplication and topic clustering
- Decision/action item extraction from message threads
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..llm_client import LLMClient
from ..models import (
    Agent,
    AgentAction,
    AgentActionType,
    Artifact,
    ArtifactType,
    TriggerEvent,
    TriggerType,
)

logger = logging.getLogger("agent-orchestrator.agents.migration")

_CLASSIFY_PROMPT = """\
You are a migration agent classifying imported content from {platform}.

Items to classify:
{items_text}

For each item, determine:
1. **ArtifactType**: The most appropriate Lurk artifact type.
2. **Sensitivity**: public | internal | confidential | restricted.
3. **Customer-facing**: Is this customer-facing content?
4. **Tags**: Relevant tags for organisation within Lurk.
5. **Relationships**: References to other items in this batch.

Valid ArtifactType values:
- document:gdoc, document:notion, document:markdown, document:pdf, document:word, document:note, document:wiki
- code:commit, code:pr, code:file, code:snippet, code:review
- comm:email_sent, comm:email_received, comm:call_transcript, comm:call_summary, comm:chat_thread
- data:spreadsheet, data:csv, data:dashboard, data:report, data:crm_record, data:issue_tracker
- design:figma, design:sketch, design:screenshot
- migration:slack_message, migration:slack_file, migration:drive_file, migration:notion_page, migration:email_archive, migration:jira_issue

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.9,
  "justification": "Classified {item_count} items from {platform}",
  "proposed_title": "Migration Classification — {platform} Batch",
  "classifications": [
    {{
      "source_id": "...",
      "artifact_type": "...",
      "title": "suggested title",
      "sensitivity": "internal",
      "customer_facing": false,
      "tags": ["..."],
      "relationships": [
        {{"target_source_id": "...", "relation_type": "references|parent_of|child_of|related_to"}}
      ]
    }}
  ],
  "duplicates": [
    {{"source_ids": ["id1", "id2"], "reason": "..."}}
  ],
  "source_refs": []
}}
Return ONLY the JSON object.
"""

_SLACK_MIGRATION_PROMPT = """\
You are a migration agent processing imported Slack data.

Slack workspace: {workspace_name}
Channel: {channel_name} ({channel_type})

Messages to process:
{messages_text}

Slack-specific mapping rules (PRD 7.3):
- Text messages -> document:note artifacts (grouped by thread/day)
- File shares -> appropriate artifact type based on file type
- Code snippets -> code:snippet artifacts
- Thread replies -> parent-child artifact links
- Cross-channel links -> artifact relationship refs
- @mentions -> owner/stakeholder metadata
- Pinned messages -> high-priority tag
- Channel topics -> artifact tags

Intelligence tasks:
1. Group related messages into coherent artifact clusters (don't create one artifact per message).
2. Identify and merge duplicate discussions across the batch.
3. Extract decisions buried in threads — create separate decision artifacts.
4. Extract action items — flag for PR suggestions on relevant artifacts.
5. Identify tribal knowledge — suggest document:wiki artifacts.
6. Tag customer mentions with customerRefs.

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.85,
  "justification": "Processed {message_count} Slack messages from #{channel_name}",
  "proposed_title": "Migration: Slack #{channel_name}",
  "synthesis_content": "Migration report content...",
  "artifact_groups": [
    {{
      "title": "suggested artifact title",
      "artifact_type": "...",
      "source_message_ids": ["..."],
      "content_summary": "merged content summary",
      "sensitivity": "internal",
      "customer_facing": false,
      "tags": ["slack-import", "..."],
      "customer_refs": [
        {{"customer_name": "...", "context": "..."}}
      ]
    }}
  ],
  "decisions_extracted": [
    {{"decision": "...", "context": "...", "source_message_ids": ["..."]}}
  ],
  "action_items_extracted": [
    {{"task": "...", "assignee": "...", "source_message_ids": ["..."]}}
  ],
  "knowledge_articles": [
    {{"title": "...", "content_summary": "...", "source_message_ids": ["..."]}}
  ],
  "source_refs": []
}}
Return ONLY the JSON object.
"""

_RELATIONSHIP_MAP_PROMPT = """\
You are a migration agent building a relationship graph across imported artifacts.

Imported artifacts:
{artifacts_text}

Tasks:
1. Identify cross-references between artifacts (mentions, links, shared topics).
2. Build parent-child relationships (threads, responses, updates).
3. Detect duplicates that should be merged.
4. Map dependencies (artifact A depends on artifact B).
5. Identify superseded content (artifact A replaces artifact B).

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.85,
  "justification": "Mapped relationships for {artifact_count} artifacts",
  "proposed_title": "Migration Relationship Map",
  "synthesis_content": "Relationship mapping report...",
  "relationships": [
    {{
      "source_id": "...",
      "target_id": "...",
      "relation_type": "references|contradicts|supersedes|derived_from|related_to|parent_of|child_of|duplicate_of",
      "confidence": 0.0,
      "reason": "..."
    }}
  ],
  "merge_suggestions": [
    {{"artifact_ids": ["..."], "reason": "...", "suggested_title": "..."}}
  ],
  "source_refs": []
}}
Return ONLY the JSON object.
"""


class MigrationAgent:
    """
    Migration agent using Sonnet 4.6 for high-volume classification.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Route based on migration task type."""
        task = trigger.payload.get("task", "classify")
        platform = trigger.payload.get("platform", "unknown")

        if task == "classify":
            if platform == "slack":
                return await self._process_slack(agent, trigger, artifacts)
            return await self._classify(agent, platform, trigger, artifacts)

        if task == "map_relationships":
            return await self._map_relationships(agent, artifacts)

        # Default: classify
        return await self._classify(agent, platform, trigger, artifacts)

    async def _classify(
        self,
        agent: Agent,
        platform: str,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Classify imported items into Lurk artifact types."""
        items = trigger.payload.get("items", [])
        if not items and artifacts:
            items = [
                {
                    "source_id": a.id,
                    "title": a.title,
                    "type": a.type.value,
                    "content": (a.redacted_content or "")[:500],
                }
                for a in artifacts
            ]

        if not items:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No items to classify",
            )

        items_text = "\n\n".join(
            f"Item {i+1} (source_id: {item.get('source_id', 'unknown')}):\n"
            f"  Original type: {item.get('type', 'unknown')}\n"
            f"  Title: {item.get('title', 'Untitled')}\n"
            f"  Content preview: {item.get('content', '(none)')[:500]}"
            for i, item in enumerate(items[:30])
        )

        prompt = _CLASSIFY_PROMPT.format(
            platform=platform,
            items_text=items_text,
            item_count=len(items),
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="migration_classify",
            prompt=prompt,
            system_prompt="You are a migration agent for Lurk. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))

    async def _process_slack(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Slack-specific migration logic (PRD 7.3)."""
        workspace_name = trigger.payload.get("workspace_name", "Unknown Workspace")
        channel_name = trigger.payload.get("channel_name", "unknown")
        channel_type = trigger.payload.get("channel_type", "public")
        messages = trigger.payload.get("messages", [])

        if not messages and artifacts:
            messages = [
                {
                    "id": a.id,
                    "text": a.redacted_content or "",
                    "user": a.author_id,
                    "timestamp": str(a.captured_at),
                    "thread_ts": a.metadata.custom_fields.get("thread_ts"),
                }
                for a in artifacts
            ]

        if not messages:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification=f"No messages to process for #{channel_name}",
            )

        messages_text = "\n\n".join(
            f"[{m.get('timestamp', '?')}] {m.get('user', 'unknown')}: "
            f"{m.get('text', '')[:500]}"
            + (f"\n  (thread reply to {m.get('thread_ts', '')})" if m.get("thread_ts") else "")
            + (f"\n  (files: {m.get('files', [])})" if m.get("files") else "")
            + (f"\n  (reactions: {m.get('reactions', [])})" if m.get("reactions") else "")
            for m in messages[:50]
        )

        prompt = _SLACK_MIGRATION_PROMPT.format(
            workspace_name=workspace_name,
            channel_name=channel_name,
            channel_type=channel_type,
            messages_text=messages_text,
            message_count=len(messages),
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="migration_classify",
            prompt=prompt,
            system_prompt=(
                "You are a Slack migration agent for Lurk. Apply intelligent "
                "grouping — do NOT create one artifact per message. "
                "Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.3,
        )

        return _parse_response(response.get("content", ""))

    async def _map_relationships(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Build relationship graph across imported artifacts."""
        if len(artifacts) < 2:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="Need at least 2 artifacts for relationship mapping",
            )

        artifacts_text = "\n\n".join(
            f"[{a.id}] {a.title} ({a.type.value}):\n"
            f"  Tags: {', '.join(a.tags)}\n"
            f"  Content: {(a.redacted_content or '')[:500]}"
            for a in artifacts[:30]
        )

        prompt = _RELATIONSHIP_MAP_PROMPT.format(
            artifacts_text=artifacts_text,
            artifact_count=len(artifacts),
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="migration_classify",
            prompt=prompt,
            system_prompt="You are a migration agent for Lurk. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))


def _parse_response(text: str) -> AgentAction:
    """Parse LLM JSON response into an AgentAction."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_nl = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_nl:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        data = json.loads(cleaned)
        return AgentAction(
            action=data.get("action", "synthesize"),
            confidence=float(data.get("confidence", 0.8)),
            justification=data.get("justification", ""),
            target_artifact_id=data.get("target_artifact_id"),
            proposed_changes=data.get("proposed_changes"),
            proposed_title=data.get("proposed_title"),
            synthesis_content=data.get("synthesis_content"),
            notification_message=data.get("notification_message"),
            source_refs=data.get("source_refs", []),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse migration agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

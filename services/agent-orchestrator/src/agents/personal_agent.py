"""
Personal agent — PRD Section 6.1.

Scope:  One user's ledger.
Model:  Sonnet 4.6 (default), Opus 4.6 for complex analysis.
Purpose: Keep the user's own work consistent, up-to-date, and conflict-free.

Capabilities:
- Detect stale references (e.g. outdated pricing in a sales deck)
- Detect deprecated APIs in code artifacts
- Cross-reference meeting action items with existing artifacts
- Open PRs with suggested fixes
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
    AgentType,
    Artifact,
    ArtifactType,
    TriggerEvent,
    TriggerType,
)

logger = logging.getLogger("agent-orchestrator.agents.personal")

# Prompt template for stale reference detection
_STALE_REFERENCE_PROMPT = """\
You are a personal agent analysing a user's artifact for stale or outdated references.

Artifact title: {title}
Artifact type: {artifact_type}
Last modified: {modified_at}
Content:
{content}

Related artifacts for cross-reference:
{related_artifacts}

Tasks:
1. Identify any references to data, APIs, people, dates, or facts that appear outdated.
2. For each stale reference, explain what is outdated and what the correct/current value likely is.
3. If action items from meetings are referenced, check whether they have been addressed.

Return a JSON object:
{{
  "action": "fork" | "pr" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "{artifact_id}",
  "proposed_changes": "description of all changes",
  "proposed_title": "PR title",
  "stale_references": [
    {{"location": "...", "current_value": "...", "suggested_value": "...", "reason": "..."}}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

# Prompt template for deprecated API detection
_DEPRECATED_API_PROMPT = """\
You are a personal agent checking code artifacts for deprecated API usage.

Artifact title: {title}
Artifact type: {artifact_type}
Content:
{content}

Known deprecations and replacements from related artifacts:
{deprecation_context}

Tasks:
1. Identify any deprecated API calls, library versions, or patterns.
2. Suggest specific replacements with code examples.
3. Assess the urgency (breaking change, performance, security, cosmetic).

Return a JSON object:
{{
  "action": "fork" | "pr" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "{artifact_id}",
  "proposed_changes": "description of changes with code",
  "proposed_title": "PR title",
  "deprecated_apis": [
    {{"api": "...", "replacement": "...", "urgency": "high|medium|low", "reason": "..."}}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

# Prompt for meeting action item cross-reference
_MEETING_XREF_PROMPT = """\
You are a personal agent cross-referencing meeting action items with existing artifacts.

Meeting transcript summary:
{meeting_summary}

Action items extracted:
{action_items}

User's existing artifacts:
{existing_artifacts}

Tasks:
1. For each action item, identify which existing artifacts are affected.
2. Determine if any artifact needs updating based on meeting decisions.
3. Flag any commitments or deadlines that should be tracked.

Return a JSON object:
{{
  "action": "fork" | "pr" | "synthesize" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "most important artifact to update, or null",
  "proposed_changes": "...",
  "proposed_title": "...",
  "action_item_mapping": [
    {{
      "action_item": "...",
      "affected_artifact_ids": ["..."],
      "status": "needs_update | already_addressed | new_work",
      "suggested_change": "..."
    }}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class PersonalAgent:
    """
    Personal agent implementation.

    Uses Sonnet 4.6 for routine analysis. Delegates to the LLM Gateway
    which handles model selection.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """
        Run personal agent analysis based on trigger type.
        """
        if trigger.trigger_type == TriggerType.MEETING_ENDED:
            return await self._cross_reference_meeting(agent, trigger, artifacts)

        # Default: stale reference + deprecated API scan
        code_artifacts = [
            a for a in artifacts if a.type.value.startswith("code:")
        ]
        if code_artifacts:
            return await self._check_deprecated_apis(agent, code_artifacts, artifacts)

        return await self._check_stale_references(agent, artifacts)

    async def _check_stale_references(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Scan artifacts for stale references."""
        if not artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No artifacts to analyse",
            )

        # Analyse the most recently modified artifact with others as context
        target = max(artifacts, key=lambda a: a.modified_at)
        related = [a for a in artifacts if a.id != target.id]

        related_text = "\n".join(
            f"- {a.title} [{a.type.value}] (modified {a.modified_at}): "
            f"{(a.redacted_content or '')[:500]}"
            for a in related[:10]
        )

        prompt = _STALE_REFERENCE_PROMPT.format(
            title=target.title,
            artifact_type=target.type.value,
            modified_at=target.modified_at,
            content=target.redacted_content or "(content unavailable)",
            related_artifacts=related_text or "(none)",
            artifact_id=target.id,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="artifact_analysis",
            prompt=prompt,
            system_prompt="You are a personal Lurk agent. Respond with JSON only.",
            max_tokens=2048,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))

    async def _check_deprecated_apis(
        self,
        agent: Agent,
        code_artifacts: list[Artifact],
        all_artifacts: list[Artifact],
    ) -> AgentAction:
        """Scan code artifacts for deprecated API usage."""
        target = code_artifacts[0]

        deprecation_context = "\n".join(
            f"- {a.title}: {(a.redacted_content or '')[:300]}"
            for a in all_artifacts
            if a.type in (ArtifactType.DOCUMENT_WIKI, ArtifactType.DOCUMENT_MARKDOWN)
        )

        prompt = _DEPRECATED_API_PROMPT.format(
            title=target.title,
            artifact_type=target.type.value,
            content=target.redacted_content or "(content unavailable)",
            deprecation_context=deprecation_context or "(no deprecation docs found)",
            artifact_id=target.id,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="artifact_analysis",
            prompt=prompt,
            system_prompt="You are a personal Lurk agent. Respond with JSON only.",
            max_tokens=2048,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))

    async def _cross_reference_meeting(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Cross-reference meeting action items with existing artifacts."""
        # Find the meeting transcript / summary
        meeting_artifacts = [
            a for a in artifacts
            if a.type in (
                ArtifactType.COMM_CALL_TRANSCRIPT,
                ArtifactType.COMM_CALL_SUMMARY,
            )
        ]
        other_artifacts = [a for a in artifacts if a not in meeting_artifacts]

        if not meeting_artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No meeting transcript found in scope",
            )

        meeting_text = "\n\n".join(
            a.redacted_content or "" for a in meeting_artifacts
        )
        action_items = trigger.payload.get("action_items", "Not extracted yet")

        existing_text = "\n".join(
            f"- [{a.id}] {a.title} [{a.type.value}]: {(a.redacted_content or '')[:300]}"
            for a in other_artifacts[:15]
        )

        prompt = _MEETING_XREF_PROMPT.format(
            meeting_summary=meeting_text[:4000],
            action_items=json.dumps(action_items) if isinstance(action_items, list) else str(action_items),
            existing_artifacts=existing_text or "(none)",
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="meeting_summary",
            prompt=prompt,
            system_prompt="You are a personal Lurk agent. Respond with JSON only.",
            max_tokens=3072,
            temperature=0.3,
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
            action=data.get("action", "skip"),
            confidence=float(data.get("confidence", 0.0)),
            justification=data.get("justification", ""),
            target_artifact_id=data.get("target_artifact_id"),
            proposed_changes=data.get("proposed_changes"),
            proposed_title=data.get("proposed_title"),
            synthesis_content=data.get("synthesis_content"),
            notification_message=data.get("notification_message"),
            source_refs=data.get("source_refs", []),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse personal agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

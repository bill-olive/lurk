"""
Team agent — PRD Section 6.2.

Scope:  All ledgers of team members (redacted per policy).
Model:  Sonnet 4.6.
Purpose: Maintain consistency within a functional team.

Capabilities:
- Cross-artifact conflict detection
- Weekly synthesis reports
- Standard enforcement (team conventions)
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

logger = logging.getLogger("agent-orchestrator.agents.team")

_CONFLICT_DETECTION_PROMPT = """\
You are a team agent detecting conflicts and contradictions across team artifacts.

Team: {team_name}
Agent: {agent_name}

Artifacts to analyse for conflicts:
{artifacts_text}

Tasks:
1. Compare claims, data points, timelines, and commitments across artifacts.
2. Identify any contradictions, inconsistencies, or misalignment.
3. For each conflict, identify the two (or more) artifacts involved and explain the discrepancy.
4. Recommend resolution.

Return a JSON object:
{{
  "action": "synthesize" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "overall assessment",
  "conflicts": [
    {{
      "artifact_ids": ["id1", "id2"],
      "description": "what contradicts what",
      "severity": "high|medium|low",
      "resolution": "recommended fix"
    }}
  ],
  "synthesis_content": "formatted conflict report if action is synthesize",
  "proposed_title": "Team Conflict Report — {team_name}",
  "notification_message": "summary if action is notify",
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_WEEKLY_SYNTHESIS_PROMPT = """\
You are a team agent generating a weekly synthesis report.

Team: {team_name}
Period: {period}

Artifacts committed this period:
{artifacts_text}

Tasks:
1. Summarise the team's work output for the period.
2. Highlight key decisions, deliverables, and milestones.
3. Identify any blockers or risks visible in the artifacts.
4. Note cross-team dependencies if referenced.

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.9,
  "justification": "Weekly synthesis report for {team_name}",
  "synthesis_content": "# Weekly Synthesis — {team_name}\\n\\n## Summary\\n...\\n## Key Decisions\\n...\\n## Risks & Blockers\\n...\\n## Cross-team Dependencies\\n...",
  "proposed_title": "Weekly Synthesis — {team_name} — {period}",
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_STANDARD_ENFORCEMENT_PROMPT = """\
You are a team agent checking an artifact against team standards and conventions.

Team: {team_name}
Team standards:
{standards}

Artifact to check:
Title: {title}
Type: {artifact_type}
Content:
{content}

Tasks:
1. Check the artifact against each applicable team standard.
2. Identify violations with specific locations and corrections.
3. If violations exist, propose a PR with fixes.

Return a JSON object:
{{
  "action": "fork" | "pr" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "{artifact_id}",
  "proposed_changes": "description of corrections",
  "proposed_title": "Standards fix: {title}",
  "violations": [
    {{"standard": "...", "location": "...", "current": "...", "expected": "...", "severity": "high|medium|low"}}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class TeamAgent:
    """Team agent implementation using Sonnet 4.6."""

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Route to the appropriate analysis based on trigger type."""
        if trigger.trigger_type == TriggerType.SCHEDULE:
            # Scheduled run — generate weekly synthesis or run conflict detection
            if trigger.payload.get("task") == "weekly_synthesis":
                return await self._weekly_synthesis(agent, artifacts, trigger)
            return await self._detect_conflicts(agent, artifacts)

        if trigger.trigger_type == TriggerType.CONFLICT_DETECTED:
            return await self._detect_conflicts(agent, artifacts)

        if trigger.trigger_type in (
            TriggerType.ARTIFACT_COMMITTED,
            TriggerType.ARTIFACT_MODIFIED,
        ):
            return await self._enforce_standards(agent, trigger, artifacts)

        # Default: conflict detection
        return await self._detect_conflicts(agent, artifacts)

    async def _detect_conflicts(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Detect contradictions across team artifacts."""
        if len(artifacts) < 2:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="Need at least 2 artifacts for conflict detection",
            )

        artifacts_text = "\n\n".join(
            f"--- [{a.id}] {a.title} [{a.type.value}] ---\n"
            f"Author: {a.author_id} | Modified: {a.modified_at}\n"
            f"{(a.redacted_content or '(no content)')[:1500]}"
            for a in artifacts[:20]
        )

        team_name = agent.name.replace("-team", "").replace("_team", "").title()
        prompt = _CONFLICT_DETECTION_PROMPT.format(
            team_name=team_name,
            agent_name=agent.name,
            artifacts_text=artifacts_text,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="conflict_detection",
            prompt=prompt,
            system_prompt="You are a team-level Lurk agent. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.3,
        )

        return _parse_response(response.get("content", ""))

    async def _weekly_synthesis(
        self,
        agent: Agent,
        artifacts: list[Artifact],
        trigger: TriggerEvent,
    ) -> AgentAction:
        """Generate a weekly team synthesis report."""
        period = trigger.payload.get("period", "this week")

        artifacts_text = "\n\n".join(
            f"- [{a.id}] {a.title} [{a.type.value}] by {a.author_id} "
            f"(committed {a.committed_at})\n  {(a.redacted_content or '')[:500]}"
            for a in artifacts[:30]
        )

        team_name = agent.name.replace("-team", "").replace("_team", "").title()
        prompt = _WEEKLY_SYNTHESIS_PROMPT.format(
            team_name=team_name,
            period=period,
            artifacts_text=artifacts_text or "(no artifacts this period)",
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="artifact_analysis",
            prompt=prompt,
            system_prompt="You are a team-level Lurk agent. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.4,
        )

        return _parse_response(response.get("content", ""))

    async def _enforce_standards(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Check a newly committed artifact against team standards."""
        target_id = trigger.artifact_id
        target = next((a for a in artifacts if a.id == target_id), None)
        if target is None and artifacts:
            target = artifacts[0]
        if target is None:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No target artifact found",
            )

        # Extract team standards from agent configuration or wiki artifacts
        standards_artifacts = [
            a for a in artifacts
            if a.type in (ArtifactType.DOCUMENT_WIKI, ArtifactType.DOCUMENT_MARKDOWN)
            and any(t in a.tags for t in ("standards", "conventions", "guidelines"))
        ]
        standards_text = "\n".join(
            f"- {a.title}: {(a.redacted_content or '')[:500]}"
            for a in standards_artifacts
        ) or "(no explicit team standards found — use general best practices)"

        team_name = agent.name.replace("-team", "").replace("_team", "").title()
        prompt = _STANDARD_ENFORCEMENT_PROMPT.format(
            team_name=team_name,
            standards=standards_text,
            title=target.title,
            artifact_type=target.type.value,
            content=(target.redacted_content or "(no content)")[:4000],
            artifact_id=target.id,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="artifact_analysis",
            prompt=prompt,
            system_prompt="You are a team-level Lurk agent. Respond with JSON only.",
            max_tokens=2048,
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
        logger.warning("Failed to parse team agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

"""
Analytics agent — PRD Section 6.8.

Scope:  All artifacts the agent has permission to read.
Model:  Sonnet 4.6 for individual analysis, Opus 4.6 for org-wide synthesis.
Purpose: Measure artifact quality, staleness, and coverage gaps.

Pipeline:
1. Agent runs on schedule (weekly) or triggered by admin
2. Scores each artifact on quality, staleness, coverage
3. Generates meta:analytics_report with dashboard data
4. Opens PRs on stale artifacts with suggested updates
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
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

logger = logging.getLogger("agent-orchestrator.agents.analytics")

_QUALITY_SCORE_PROMPT = """\
You are an analytics agent scoring artifact quality.

Artifact:
Title: {title}
Type: {artifact_type}
Author: {author_id}
Last modified: {modified_at}
Tags: {tags}
Content:
{content}

Related artifacts for context:
{related_text}

Score this artifact on three dimensions (each 0.0 to 1.0):

1. **Quality** (completeness, consistency, accuracy):
   - Is the content complete for its type?
   - Is it internally consistent?
   - Does it align with related artifacts?

2. **Staleness** (0.0 = fresh, 1.0 = very stale):
   - How long since last update?
   - Have related artifacts been updated more recently?
   - Does it reference outdated information?

3. **Coverage** (what is missing):
   - What sections or information are expected but absent?
   - Are there gaps compared to similar artifacts?

Return a JSON object:
{{
  "quality_score": 0.0,
  "staleness_score": 0.0,
  "coverage_gaps": ["gap1", "gap2"],
  "issues": [
    {{"type": "quality|staleness|coverage", "description": "...", "severity": "high|medium|low"}}
  ],
  "needs_update": true,
  "suggested_changes": "description of recommended updates"
}}
Return ONLY the JSON object.
"""

_ANALYTICS_REPORT_PROMPT = """\
You are an analytics agent generating an org-wide analytics report.

Artifact scores:
{scores_text}

Summary statistics:
- Total artifacts: {total}
- Average quality: {avg_quality:.2f}
- Average staleness: {avg_staleness:.2f}
- Artifacts needing update: {needs_update}

Tasks:
1. Identify the most concerning quality and staleness trends.
2. Break down by team if team information is available.
3. Highlight the top 10 artifacts most urgently needing attention.
4. Provide recommendations for improving overall artifact health.

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.9,
  "justification": "Analytics report for {total} artifacts",
  "proposed_title": "Artifact Analytics Report — {date}",
  "synthesis_content": "# Artifact Analytics Report\\n\\n## Executive Summary\\n...\\n## Quality Distribution\\n...\\n## Staleness Heatmap\\n...\\n## Top Priority Updates\\n...\\n## Team Breakdown\\n...\\n## Recommendations\\n...",
  "stale_artifacts_for_pr": [
    {{"artifact_id": "...", "title": "...", "staleness": 0.0, "suggested_changes": "..."}}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class AnalyticsAgent:
    """
    Analytics agent implementation.

    Uses Sonnet 4.6 for individual artifact scoring and Opus 4.6
    for org-wide synthesis.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Score artifacts and generate analytics report."""
        if not artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No artifacts to analyse",
            )

        # Step 1: Score individual artifacts
        scores = await self._score_artifacts(agent, artifacts)

        # Step 2: Generate report
        return await self._generate_report(agent, artifacts, scores)

    async def _score_artifacts(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> list[dict[str, Any]]:
        """Score each artifact on quality, staleness, and coverage."""
        scores: list[dict[str, Any]] = []

        # Batch scoring — score up to 20 artifacts
        for artifact in artifacts[:20]:
            related = [a for a in artifacts if a.id != artifact.id]
            related_text = "\n".join(
                f"- {a.title} [{a.type.value}] (modified {a.modified_at})"
                for a in related[:5]
            )

            prompt = _QUALITY_SCORE_PROMPT.format(
                title=artifact.title,
                artifact_type=artifact.type.value,
                author_id=artifact.author_id,
                modified_at=artifact.modified_at,
                tags=", ".join(artifact.tags),
                content=(artifact.redacted_content or "(no content)")[:3000],
                related_text=related_text or "(none)",
            )

            try:
                response = await self._llm.complete(
                    agent_id=agent.id,
                    agent_type=agent.type.value,
                    org_id=agent.org_id,
                    task_type="quality_score",
                    prompt=prompt,
                    system_prompt="You are an analytics agent. Respond with JSON only.",
                    max_tokens=1024,
                    temperature=0.2,
                )

                score_data = json.loads(
                    _strip_fences(response.get("content", "{}"))
                )
                score_data["artifact_id"] = artifact.id
                score_data["artifact_title"] = artifact.title
                score_data["artifact_type"] = artifact.type.value
                scores.append(score_data)

            except Exception:
                logger.exception(
                    "Failed to score artifact %s", artifact.id
                )
                scores.append({
                    "artifact_id": artifact.id,
                    "artifact_title": artifact.title,
                    "artifact_type": artifact.type.value,
                    "quality_score": None,
                    "staleness_score": None,
                    "coverage_gaps": [],
                    "error": True,
                })

        return scores

    async def _generate_report(
        self,
        agent: Agent,
        artifacts: list[Artifact],
        scores: list[dict[str, Any]],
    ) -> AgentAction:
        """Generate the full analytics report and identify PRs to open."""
        valid_scores = [s for s in scores if s.get("quality_score") is not None]

        if not valid_scores:
            return AgentAction(
                action=AgentActionType.SYNTHESIZE,
                confidence=0.5,
                justification="Scoring failed for all artifacts",
                proposed_title="Artifact Analytics Report (incomplete)",
                synthesis_content="# Analytics Report\n\nScoring failed. Please retry.",
            )

        avg_quality = sum(s["quality_score"] for s in valid_scores) / len(valid_scores)
        avg_staleness = sum(s["staleness_score"] for s in valid_scores) / len(valid_scores)
        needs_update = sum(1 for s in valid_scores if s.get("needs_update", False))

        scores_text = "\n".join(
            f"- [{s['artifact_id']}] {s['artifact_title']} ({s['artifact_type']}): "
            f"quality={s['quality_score']:.2f}, staleness={s['staleness_score']:.2f}, "
            f"gaps={s.get('coverage_gaps', [])}"
            for s in valid_scores
        )

        prompt = _ANALYTICS_REPORT_PROMPT.format(
            scores_text=scores_text,
            total=len(artifacts),
            avg_quality=avg_quality,
            avg_staleness=avg_staleness,
            needs_update=needs_update,
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        )

        # Use deep_analysis for org-wide synthesis (triggers Opus 4.6)
        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="deep_analysis",
            prompt=prompt,
            system_prompt=(
                "You are an analytics agent for Lurk. Provide data-driven insights. "
                "Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.3,
        )

        action = _parse_response(response.get("content", ""))

        # If there are stale artifacts, indicate PRs should be opened
        stale = [
            s for s in valid_scores
            if s.get("staleness_score", 0) >= 0.7 and s.get("needs_update")
        ]
        if stale and action.action == AgentActionType.SYNTHESIZE:
            most_stale = max(stale, key=lambda s: s["staleness_score"])
            action.target_artifact_id = most_stale["artifact_id"]
            action.proposed_changes = most_stale.get("suggested_changes", "Update stale content")
            action.proposed_title = f"Stale artifact update: {most_stale['artifact_title']}"
            # Change to PR so the executor opens a PR on the most stale artifact
            action.action = AgentActionType.PR

        return action


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_nl = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_nl:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _parse_response(text: str) -> AgentAction:
    """Parse LLM JSON response into an AgentAction."""
    cleaned = _strip_fences(text)
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
        logger.warning("Failed to parse analytics agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

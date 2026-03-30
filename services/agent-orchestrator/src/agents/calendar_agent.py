"""
Calendar agent — PRD Section 6.6.

Scope:  User's calendar (via Google Calendar API) + related meeting artifacts.
Model:  Sonnet 4.6.
Purpose: Eliminate unnecessary meetings by analysing whether they are needed.

Pipeline:
1. Agent runs on schedule (daily at configured time, e.g. 7 AM)
2. Reviews upcoming meetings for next 3 days
3. For each meeting, checks:
   - Are there recent artifacts that address the meeting's stated purpose?
   - Were action items from last occurrence completed?
   - Is there new information since the meeting was scheduled?
   - How many participants? (large meetings are lower ROI)
4. Generates meta:calendar_review with recommendations (cancel/shorten/keep)
5. User reviews on iOS/Mac and cancels directly
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

logger = logging.getLogger("agent-orchestrator.agents.calendar")

_CALENDAR_REVIEW_PROMPT = """\
You are a calendar intelligence agent. Your goal is to eliminate unnecessary meetings
by analysing whether upcoming meetings are still needed.

Upcoming meetings (next 3 days):
{meetings_text}

Recent artifacts that may address meeting purposes:
{artifacts_text}

Previous meeting summaries and action items:
{previous_meetings_text}

For each meeting, evaluate:
1. Purpose fulfilment: Have recent artifacts already addressed this meeting's purpose?
2. Action item status: Were action items from the last occurrence completed?
3. New information: Is there new information since the meeting was scheduled that changes its necessity?
4. Participant count: Meetings with many participants are lower ROI per person.
5. Recurrence: Is this a recurring meeting that has outlived its usefulness?

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.85,
  "justification": "Calendar review completed for {meeting_count} meetings",
  "proposed_title": "Calendar Review — {date_range}",
  "synthesis_content": "# Calendar Review\\n\\n{review_placeholder}",
  "recommendations": [
    {{
      "meeting_title": "...",
      "meeting_time": "...",
      "participant_count": 0,
      "recommendation": "cancel|shorten|keep|reschedule",
      "reason": "...",
      "time_saved_minutes": 0,
      "confidence": 0.0
    }}
  ],
  "total_time_saveable_minutes": 0,
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class CalendarAgent:
    """
    Calendar agent implementation using Sonnet 4.6.

    Analyses upcoming meetings against artifact state and recommends
    cancellations/shortenings.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Review upcoming calendar events against artifact context."""
        # Extract calendar data from trigger payload
        upcoming_meetings = trigger.payload.get("meetings", [])
        if not upcoming_meetings:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No upcoming meetings to review",
            )

        # Build meeting text
        meetings_text = "\n\n".join(
            f"Meeting: {m.get('title', 'Untitled')}\n"
            f"  Time: {m.get('start_time', 'Unknown')} — {m.get('end_time', 'Unknown')}\n"
            f"  Duration: {m.get('duration_minutes', '?')} minutes\n"
            f"  Participants: {', '.join(m.get('participants', []))}\n"
            f"  Description: {m.get('description', '(none)')[:500]}\n"
            f"  Recurring: {m.get('recurring', False)}\n"
            f"  Organiser: {m.get('organiser', 'Unknown')}"
            for m in upcoming_meetings
        )

        # Separate meeting-related artifacts from general artifacts
        meeting_summaries = [
            a for a in artifacts
            if a.type in (
                ArtifactType.COMM_CALL_SUMMARY,
                ArtifactType.COMM_CALL_TRANSCRIPT,
            )
        ]
        other_artifacts = [a for a in artifacts if a not in meeting_summaries]

        previous_meetings_text = "\n\n".join(
            f"- {a.title} ({a.modified_at}): {(a.redacted_content or '')[:500]}"
            for a in meeting_summaries[:10]
        ) or "(no previous meeting summaries found)"

        artifacts_text = "\n".join(
            f"- [{a.id}] {a.title} [{a.type.value}] (modified {a.modified_at}): "
            f"{(a.redacted_content or '')[:300]}"
            for a in other_artifacts[:20]
        ) or "(no recent artifacts)"

        date_range = trigger.payload.get("date_range", "next 3 days")

        prompt = _CALENDAR_REVIEW_PROMPT.format(
            meetings_text=meetings_text,
            artifacts_text=artifacts_text,
            previous_meetings_text=previous_meetings_text,
            meeting_count=len(upcoming_meetings),
            date_range=date_range,
            review_placeholder="(see recommendations below)",
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="calendar_review",
            prompt=prompt,
            system_prompt=(
                "You are a calendar intelligence agent for Lurk. "
                "Be objective and data-driven. Only recommend cancelling meetings "
                "when you have strong evidence the meeting is unnecessary. "
                "Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.3,
        )

        action = _parse_response(response.get("content", ""))

        # Enrich synthesis content with formatted recommendations
        if action.synthesis_content and isinstance(
            response.get("content"), str
        ):
            try:
                raw = json.loads(_strip_fences(response["content"]))
                recs = raw.get("recommendations", [])
                total_saved = sum(
                    r.get("time_saved_minutes", 0)
                    for r in recs
                    if r.get("recommendation") in ("cancel", "shorten")
                )
                formatted = self._format_review(recs, total_saved)
                action.synthesis_content = formatted
            except Exception:
                pass  # keep original synthesis_content

        return action

    @staticmethod
    def _format_review(
        recommendations: list[dict[str, Any]],
        total_saved: int,
    ) -> str:
        """Format recommendations into a readable report."""
        lines = ["# Calendar Review\n"]
        if total_saved > 0:
            lines.append(
                f"**Potential time savings: {total_saved} minutes "
                f"({total_saved // 60}h {total_saved % 60}m)**\n"
            )

        for rec in recommendations:
            emoji_map = {
                "cancel": "CANCEL",
                "shorten": "SHORTEN",
                "keep": "KEEP",
                "reschedule": "RESCHEDULE",
            }
            label = emoji_map.get(rec.get("recommendation", ""), "REVIEW")
            lines.append(
                f"\n## [{label}] {rec.get('meeting_title', 'Untitled')}\n"
                f"- **Time:** {rec.get('meeting_time', 'TBD')}\n"
                f"- **Participants:** {rec.get('participant_count', '?')}\n"
                f"- **Reason:** {rec.get('reason', 'N/A')}\n"
                f"- **Confidence:** {rec.get('confidence', 0):.0%}\n"
            )
            if rec.get("time_saved_minutes"):
                lines.append(
                    f"- **Time saved:** {rec['time_saved_minutes']} min\n"
                )

        return "\n".join(lines)


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
        logger.warning("Failed to parse calendar agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

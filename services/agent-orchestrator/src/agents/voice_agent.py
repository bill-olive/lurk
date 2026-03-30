"""
Voice agent — PRD Section 6.5.

Scope:  Meeting transcripts across permitted ledgers.
Model:  Sonnet 4.6 for transcription processing, Opus 4.6 for multi-meeting synthesis.
TTS:    OpenAI tts-1-hd for voice narration.
Trigger: meeting_ended

Pipeline:
1. Meeting ends -> Mac app creates comm:call_transcript artifact
2. Voice agent triggers on meeting_ended
3. Agent generates comm:call_summary with structured summary
4. Agent opens PRs on affected artifacts
5. Agent generates voice narration of summary via OpenAI TTS
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

logger = logging.getLogger("agent-orchestrator.agents.voice")

_MEETING_SUMMARY_PROMPT = """\
You are a voice agent processing a meeting transcript.

Meeting info:
- Platform: {platform}
- Duration: {duration}
- Participants: {participants}

Transcript:
{transcript}

Tasks:
1. Generate a structured meeting summary with:
   - Key decisions made
   - Action items (who, what, by when)
   - Follow-ups needed
   - Open questions remaining
   - Customer references (names, accounts, concerns)
2. Identify which existing artifacts are affected by meeting outcomes.
3. For each affected artifact, describe what needs to change.

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.9,
  "justification": "Meeting summary generated",
  "proposed_title": "Meeting Summary — {meeting_title}",
  "synthesis_content": "# Meeting Summary\\n\\n## Decisions\\n...\\n## Action Items\\n...\\n## Follow-ups\\n...\\n## Open Questions\\n...\\n## Customer References\\n...",
  "affected_artifacts": [
    {{
      "artifact_id": "...",
      "artifact_title": "...",
      "change_needed": "description of what needs updating",
      "priority": "high|medium|low"
    }}
  ],
  "action_items": [
    {{"assignee": "...", "task": "...", "deadline": "...", "related_artifact_id": "..."}}
  ],
  "customer_mentions": [
    {{"customer_name": "...", "context": "...", "sentiment": "positive|neutral|negative|concern"}}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_MULTI_MEETING_SYNTHESIS_PROMPT = """\
You are a voice agent synthesising insights across multiple meeting transcripts.

Meeting summaries to synthesise:
{meeting_summaries}

Related non-meeting artifacts:
{related_artifacts}

Tasks:
1. Identify recurring themes, escalating concerns, and evolving decisions.
2. Track action item completion across meetings.
3. Surface patterns in customer mentions.
4. Generate a unified synthesis covering all meetings.

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.85,
  "justification": "Multi-meeting synthesis covering {meeting_count} meetings",
  "proposed_title": "Meeting Synthesis — {period}",
  "synthesis_content": "# Multi-Meeting Synthesis\\n\\n## Recurring Themes\\n...\\n## Action Item Tracker\\n...\\n## Customer Patterns\\n...\\n## Recommendations\\n...",
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_VOICE_NARRATION_PROMPT = """\
Condense this meeting summary into a concise spoken narration (under 4000 characters)
suitable for audio playback. Use natural conversational language. Start with the most
important points. Skip formatting markers.

Summary:
{summary}
"""


class VoiceAgent:
    """
    Voice agent implementation.

    Processes meeting transcripts, generates summaries, opens PRs on
    affected artifacts, and generates TTS narration.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Process meeting transcripts and generate summary."""
        transcripts = [
            a for a in artifacts
            if a.type in (
                ArtifactType.COMM_CALL_TRANSCRIPT,
                ArtifactType.COMM_CALL_RECORDING,
            )
        ]

        if not transcripts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No meeting transcripts found in scope",
            )

        # Multi-meeting synthesis if more than one transcript
        if len(transcripts) > 1:
            return await self._multi_meeting_synthesis(agent, transcripts, artifacts)

        # Single meeting processing
        return await self._process_single_meeting(agent, transcripts[0], artifacts)

    async def _process_single_meeting(
        self,
        agent: Agent,
        transcript: Artifact,
        all_artifacts: list[Artifact],
    ) -> AgentAction:
        """Process a single meeting transcript into a summary."""
        metadata = transcript.metadata
        platform = metadata.meeting_platform or "Unknown"
        duration = (
            f"{int(metadata.duration_seconds // 60)}m"
            if metadata.duration_seconds
            else "Unknown"
        )
        participants = ", ".join(metadata.participants or ["Unknown"])
        meeting_title = transcript.title or "Untitled Meeting"

        # Build list of related non-meeting artifacts for cross-reference
        related = [
            a for a in all_artifacts
            if a.id != transcript.id
            and a.type not in (
                ArtifactType.COMM_CALL_TRANSCRIPT,
                ArtifactType.COMM_CALL_RECORDING,
                ArtifactType.COMM_CALL_SUMMARY,
            )
        ]
        related_text = "\n".join(
            f"- [{a.id}] {a.title} [{a.type.value}]: {(a.redacted_content or '')[:300]}"
            for a in related[:15]
        )

        prompt = _MEETING_SUMMARY_PROMPT.format(
            platform=platform,
            duration=duration,
            participants=participants,
            transcript=(transcript.redacted_content or "(no content)")[:8000],
            meeting_title=meeting_title,
        )

        # Add related artifacts context if available
        if related_text:
            prompt += f"\n\nRelated artifacts for cross-reference:\n{related_text}"

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="meeting_summary",
            prompt=prompt,
            system_prompt="You are a voice agent for Lurk. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.3,
        )

        action = _parse_response(response.get("content", ""))

        # Generate voice narration if we have a synthesis
        if action.synthesis_content:
            try:
                narration = await self._generate_narration(agent, action.synthesis_content)
                # Store narration text as part of the action for later TTS generation
                action.notification_message = narration
            except Exception:
                logger.exception("Failed to generate voice narration text")

        return action

    async def _multi_meeting_synthesis(
        self,
        agent: Agent,
        transcripts: list[Artifact],
        all_artifacts: list[Artifact],
    ) -> AgentAction:
        """Synthesise insights across multiple meetings."""
        meeting_summaries = "\n\n".join(
            f"--- Meeting: {t.title} ({t.modified_at}) ---\n"
            f"{(t.redacted_content or '(no content)')[:3000]}"
            for t in transcripts[:10]
        )

        related = [
            a for a in all_artifacts
            if a not in transcripts
        ]
        related_text = "\n".join(
            f"- [{a.id}] {a.title}: {(a.redacted_content or '')[:200]}"
            for a in related[:10]
        )

        prompt = _MULTI_MEETING_SYNTHESIS_PROMPT.format(
            meeting_summaries=meeting_summaries,
            related_artifacts=related_text or "(none)",
            meeting_count=len(transcripts),
            period="recent meetings",
        )

        # Use deep analysis for multi-meeting synthesis (triggers Opus 4.6)
        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="deep_analysis",
            prompt=prompt,
            system_prompt="You are a voice agent for Lurk. Respond with JSON only.",
            max_tokens=4096,
            temperature=0.3,
        )

        return _parse_response(response.get("content", ""))

    async def _generate_narration(
        self,
        agent: Agent,
        summary_content: str,
    ) -> str:
        """
        Generate a spoken narration script from the meeting summary.

        The actual TTS audio generation happens in the LLM Gateway's
        /v1/llm/tts endpoint; this method produces the text script.
        """
        prompt = _VOICE_NARRATION_PROMPT.format(
            summary=summary_content[:6000],
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="artifact_analysis",
            prompt=prompt,
            system_prompt="Generate natural spoken text. No formatting markers.",
            max_tokens=1024,
            temperature=0.5,
        )

        narration = response.get("content", "")
        # Enforce TTS max length (4096 chars per PRD)
        if len(narration) > 4096:
            narration = narration[:4090] + "..."
        return narration

    async def generate_tts_audio(
        self,
        agent: Agent,
        narration_text: str,
        voice: str = "nova",
    ) -> bytes:
        """
        Generate TTS audio bytes via the LLM Gateway.

        Returns Opus-encoded audio bytes.
        """
        return await self._llm.tts(
            text=narration_text[:4096],
            voice=voice,
            org_id=agent.org_id,
        )


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
        logger.warning("Failed to parse voice agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

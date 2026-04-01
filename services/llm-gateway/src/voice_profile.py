"""
Voice Profile — Extraction, refinement, and prompt generation pipeline.

This module implements the voice profile system that powers the Digital Twin:
1. extract()       — Analyze writing samples → StyleDimensions
2. refine()        — Merge new data into existing profile
3. generate_prompt() — Convert profile into agent system prompt fragment

All calls go through the LLM Gateway's Anthropic client.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic

logger = logging.getLogger("llm-gateway.voice_profile")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_EXTRACTION = "claude-opus-4-6-20250514"       # Deep analysis needs Opus
MODEL_REFINEMENT = "claude-sonnet-4-6-20250514"     # Refinement is lighter
MODEL_PROMPT_GEN = "claude-sonnet-4-6-20250514"     # Prompt generation is lighter

PROMPTS_DIR = Path(__file__).resolve().parents[3] / "prompts" / "voice_profile"

MAX_SAMPLES_PER_EXTRACTION = 15
MAX_SAMPLE_LENGTH = 3000  # chars per sample


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class WritingSample:
    content: str
    source_type: str  # e.g. "document:gdoc", "comm:email_sent", ".md"
    artifact_id: str | None = None
    audience: str | None = None


@dataclass
class ExtractionResult:
    style_dimensions: dict[str, Any]
    exemplars: list[dict[str, str]]
    confidence: float
    confidence_notes: str
    raw_response: str = ""


@dataclass
class RefinementResult:
    updated_dimensions: dict[str, Any]
    new_exemplars: list[dict[str, str]]
    updated_confidence: float
    changes: list[dict[str, str]]
    drift: dict[str, Any]
    corrections_applied: list[dict[str, str]]
    raw_response: str = ""


@dataclass
class VoiceCorrection:
    id: str
    agent_output: str
    user_correction: str
    dimensions: list[str] = field(default_factory=list)
    context: str = ""


# ---------------------------------------------------------------------------
# Voice Profile Pipeline
# ---------------------------------------------------------------------------

class VoiceProfilePipeline:
    """
    Orchestrates voice profile extraction, refinement, and prompt generation.
    """

    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        self._client = client
        self._prompts: dict[str, str] = {}
        self._load_prompts()

    def _load_prompts(self) -> None:
        """Load prompt templates from disk."""
        for name in ("extract_v1", "refine_v1", "generate_prompt_v1"):
            path = PROMPTS_DIR / f"{name}.txt"
            if path.exists():
                self._prompts[name] = path.read_text()
                logger.info(f"Loaded prompt template: {name}")
            else:
                logger.warning(f"Prompt template not found: {path}")

    # -----------------------------------------------------------------------
    # Extract — Analyze writing samples → StyleDimensions
    # -----------------------------------------------------------------------

    async def extract(
        self,
        samples: list[WritingSample],
        *,
        user_id: str | None = None,
    ) -> ExtractionResult:
        """
        Analyze a batch of writing samples and extract a structured voice profile.

        Args:
            samples: Writing samples from the user's artifacts.
            user_id: Optional user ID for logging.

        Returns:
            ExtractionResult with style dimensions, exemplars, and confidence.
        """
        template = self._prompts.get("extract_v1")
        if not template:
            raise RuntimeError("extract_v1 prompt template not loaded")

        # Prepare samples text
        truncated = samples[:MAX_SAMPLES_PER_EXTRACTION]
        samples_text = self._format_samples(truncated)
        prompt = template.replace("{{SAMPLES}}", samples_text)

        logger.info(
            f"Extracting voice profile from {len(truncated)} samples"
            f" for user={user_id or 'unknown'}"
        )

        response = await self._client.messages.create(
            model=MODEL_EXTRACTION,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # Low temp for analytical extraction
        )

        raw = response.content[0].text
        parsed = self._parse_json_response(raw)

        return ExtractionResult(
            style_dimensions=parsed.get("styleDimensions", {}),
            exemplars=parsed.get("exemplars", []),
            confidence=parsed.get("confidence", 0.5),
            confidence_notes=parsed.get("confidenceNotes", ""),
            raw_response=raw,
        )

    # -----------------------------------------------------------------------
    # Refine — Merge new data into existing profile
    # -----------------------------------------------------------------------

    async def refine(
        self,
        existing_profile: dict[str, Any],
        new_samples: list[WritingSample],
        corrections: list[VoiceCorrection] | None = None,
        *,
        user_id: str | None = None,
    ) -> RefinementResult:
        """
        Incrementally update an existing voice profile with new writing samples
        and user corrections.

        Args:
            existing_profile: Current StyleDimensions as dict.
            new_samples: New writing samples since last analysis.
            corrections: User corrections to agent outputs.
            user_id: Optional user ID for logging.

        Returns:
            RefinementResult with updated dimensions and drift detection.
        """
        template = self._prompts.get("refine_v1")
        if not template:
            raise RuntimeError("refine_v1 prompt template not loaded")

        samples_text = self._format_samples(new_samples[:MAX_SAMPLES_PER_EXTRACTION])
        corrections_text = self._format_corrections(corrections or [])

        prompt = (
            template
            .replace("{{EXISTING_PROFILE}}", json.dumps(existing_profile, indent=2))
            .replace("{{NEW_SAMPLES}}", samples_text)
            .replace("{{CORRECTIONS}}", corrections_text or "No corrections.")
        )

        logger.info(
            f"Refining voice profile with {len(new_samples)} new samples"
            f" and {len(corrections or [])} corrections"
            f" for user={user_id or 'unknown'}"
        )

        response = await self._client.messages.create(
            model=MODEL_REFINEMENT,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )

        raw = response.content[0].text
        parsed = self._parse_json_response(raw)

        return RefinementResult(
            updated_dimensions=parsed.get("updatedDimensions", {}),
            new_exemplars=parsed.get("newExemplars", []),
            updated_confidence=parsed.get("updatedConfidence", 0.5),
            changes=parsed.get("changes", []),
            drift=parsed.get("drift", {"detected": False}),
            corrections_applied=parsed.get("correctionsApplied", []),
            raw_response=raw,
        )

    # -----------------------------------------------------------------------
    # Generate Prompt — Convert profile into agent system prompt fragment
    # -----------------------------------------------------------------------

    async def generate_prompt(
        self,
        voice_profile: dict[str, Any],
        *,
        user_name: str = "User",
    ) -> str:
        """
        Convert a voice profile into a system prompt fragment that can be
        injected into any agent's instructions.

        Args:
            voice_profile: Full VoiceProfile dict (or just StyleDimensions).
            user_name: The user's display name for the prompt.

        Returns:
            System prompt fragment text.
        """
        template = self._prompts.get("generate_prompt_v1")
        if not template:
            raise RuntimeError("generate_prompt_v1 prompt template not loaded")

        profile_text = json.dumps(voice_profile, indent=2)
        prompt = template.replace("{{VOICE_PROFILE}}", profile_text)

        response = await self._client.messages.create(
            model=MODEL_PROMPT_GEN,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,  # Slightly higher for creative prompt writing
        )

        fragment = response.content[0].text.strip()

        # Replace placeholder name if present
        if "{User Name}" in fragment:
            fragment = fragment.replace("{User Name}", user_name)
        if "{Name}" in fragment:
            fragment = fragment.replace("{Name}", user_name)

        logger.info(f"Generated voice prompt fragment ({len(fragment)} chars)")
        return fragment

    # -----------------------------------------------------------------------
    # Ghost Preview — Generate speculative improvement for an artifact
    # -----------------------------------------------------------------------

    async def ghost_preview(
        self,
        artifact_content: str,
        voice_profile: dict[str, Any],
        *,
        context: str = "",
    ) -> dict[str, Any]:
        """
        Generate a speculative improvement diff for an artifact, written in
        the user's voice. Used for the Ghost Writer Preview overlay.

        Args:
            artifact_content: The current artifact text.
            voice_profile: The user's voice profile.
            context: Additional context (related artifacts, recent changes).

        Returns:
            Dict with suggestedContent, diffHunks, confidence.
        """
        system_prompt = await self.generate_prompt(voice_profile)

        user_prompt = f"""You are reviewing the following artifact. Suggest improvements
that the user would make — corrections, clarifications, better phrasing — all written
in their voice and style.

## Artifact Content

{artifact_content[:8000]}

{f"## Additional Context\n\n{context}" if context else ""}

## Instructions

1. Only suggest changes the user would actually make (based on the voice profile).
2. Return a JSON object with:
   - "suggestedContent": the full improved text
   - "diffHunks": array of {{ "startLine": N, "endLine": N, "original": "...", "suggested": "...", "rationale": "..." }}
   - "confidence": 0.0-1.0 that the user would accept these changes
3. If the artifact is already well-written in the user's voice, return minimal changes with high confidence.
4. Never change meaning or add new information — only improve expression and style.
"""

        response = await self._client.messages.create(
            model=MODEL_REFINEMENT,  # Sonnet for speed
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.4,
        )

        raw = response.content[0].text
        return self._parse_json_response(raw)

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _format_samples(samples: list[WritingSample]) -> str:
        """Format writing samples for prompt injection."""
        parts = []
        for i, sample in enumerate(samples, 1):
            content = sample.content[:MAX_SAMPLE_LENGTH]
            header = f"### Sample {i}"
            if sample.source_type:
                header += f" (source: {sample.source_type})"
            if sample.audience:
                header += f" (audience: {sample.audience})"
            parts.append(f"{header}\n\n{content}")
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _format_corrections(corrections: list[VoiceCorrection]) -> str:
        """Format user corrections for prompt injection."""
        if not corrections:
            return ""
        parts = []
        for c in corrections:
            parts.append(
                f"### Correction {c.id}\n"
                f"**Agent wrote:** {c.agent_output[:500]}\n"
                f"**User wanted:** {c.user_correction[:500]}\n"
                f"**Dimensions:** {', '.join(c.dimensions) if c.dimensions else 'unspecified'}\n"
                f"**Context:** {c.context or 'none'}"
            )
        return "\n\n".join(parts)

    @staticmethod
    def _parse_json_response(raw: str) -> dict[str, Any]:
        """Extract JSON from an LLM response that may contain markdown fences."""
        text = raw.strip()

        # Try to extract JSON from code fences
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.index("```") + 3
            end = text.index("```", start)
            text = text[start:end].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON from LLM response, returning raw")
            return {"raw": raw, "parse_error": True}

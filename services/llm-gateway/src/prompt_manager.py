"""
PromptManager — loads and manages versioned prompt templates.

Supports the following template types (PRD Section 5.2):
- artifact_analysis
- conflict_detection
- meeting_summary
- pr_description
- customer_health
- calendar_review
- migration_classify
- quality_score

Templates are loaded from the filesystem (prompts/ directory) with version
suffixes (e.g. artifact_analysis_v1.txt). The manager tracks the current
active version for each template and supports rollback.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("llm-gateway.prompt_manager")


# ---------------------------------------------------------------------------
# Default embedded templates (used when filesystem templates are not found)
# ---------------------------------------------------------------------------

_DEFAULT_TEMPLATES: dict[str, str] = {
    "artifact_analysis": (
        "You are an AI agent analysing a Lurk artifact.\n\n"
        "Artifact context:\n{context}\n\n"
        "Analyse this artifact for issues, staleness, and improvement opportunities.\n"
        "Return a structured JSON decision with action, confidence, justification, "
        "and proposed changes if applicable."
    ),
    "conflict_detection": (
        "You are an AI agent detecting conflicts between Lurk artifacts.\n\n"
        "Artifacts:\n{artifacts}\n\n"
        "Compare these artifacts for contradictions, inconsistencies, and misalignment.\n"
        "Return a structured JSON report listing each conflict with severity and "
        "recommended resolution."
    ),
    "meeting_summary": (
        "You are an AI agent summarising a meeting transcript.\n\n"
        "Transcript:\n{transcript}\n\n"
        "Generate a structured summary including:\n"
        "- Key decisions\n"
        "- Action items (who, what, by when)\n"
        "- Follow-ups needed\n"
        "- Open questions\n"
        "- Customer references\n"
        "Return as structured JSON."
    ),
    "pr_description": (
        "You are an AI agent generating a pull request description.\n\n"
        "Diff summary:\n{diff}\n\n"
        "Original artifact:\n{original}\n\n"
        "Agent justification: {justification}\n\n"
        "Generate a clear, concise PR description explaining what changed and why.\n"
        "Include a human-readable change summary."
    ),
    "customer_health": (
        "You are an AI agent computing customer health scores.\n\n"
        "Customer: {customer_name}\n"
        "Touchpoints:\n{touchpoints}\n\n"
        "Analyse all touchpoints and compute a health score (0-100) with:\n"
        "- Trend: improving | stable | declining | critical\n"
        "- Supporting signals with weights\n"
        "- Actionable recommendations\n"
        "- Alert level: none | watch | action_required | escalation\n"
        "Return as structured JSON."
    ),
    "calendar_review": (
        "You are an AI agent reviewing calendar events.\n\n"
        "Upcoming meetings:\n{meetings}\n\n"
        "Recent artifacts:\n{artifacts}\n\n"
        "For each meeting, assess whether it is still necessary based on "
        "artifact state. Recommend: cancel, shorten, keep, or reschedule.\n"
        "Return as structured JSON with recommendations and time savings."
    ),
    "migration_classify": (
        "You are an AI agent classifying imported content for migration.\n\n"
        "Platform: {platform}\n"
        "Items:\n{items}\n\n"
        "Classify each item into the appropriate Lurk ArtifactType.\n"
        "Assess sensitivity, customer-facing status, and relationships.\n"
        "Group related messages into coherent artifacts.\n"
        "Return as structured JSON."
    ),
    "quality_score": (
        "You are an AI agent scoring artifact quality.\n\n"
        "Artifact:\n{artifact}\n\n"
        "Related artifacts:\n{related}\n\n"
        "Score on three dimensions (0.0-1.0):\n"
        "1. Quality: completeness, consistency, accuracy\n"
        "2. Staleness: 0.0 = fresh, 1.0 = very stale\n"
        "3. Coverage gaps: what is missing?\n"
        "Return as structured JSON."
    ),
}


class PromptManager:
    """
    Manages versioned prompt templates.

    Templates are loaded from the filesystem if available, with fallback
    to embedded defaults. Supports version pinning and rollback.
    """

    def __init__(self, prompts_dir: str | None = None) -> None:
        self._prompts_dir = Path(prompts_dir) if prompts_dir else None
        # Active version per template name
        self._active_versions: dict[str, int] = {}
        # Cache: (name, version) -> template string
        self._cache: dict[tuple[str, int], str] = {}

        self._load_templates()

    def _load_templates(self) -> None:
        """Discover and load templates from the filesystem."""
        if self._prompts_dir is None or not self._prompts_dir.exists():
            logger.info(
                "Prompts directory not found (%s); using default embedded templates",
                self._prompts_dir,
            )
            # Load defaults as version 1
            for name, template in _DEFAULT_TEMPLATES.items():
                self._cache[(name, 1)] = template
                self._active_versions[name] = 1
            return

        for subdir in sorted(self._prompts_dir.iterdir()):
            if not subdir.is_dir():
                continue
            name = subdir.name  # e.g. "artifact_analysis"
            max_version = 0
            for file in sorted(subdir.iterdir()):
                if not file.is_file():
                    continue
                # Parse version from filename: artifact_analysis_v1.txt
                stem = file.stem
                if "_v" in stem:
                    try:
                        version = int(stem.split("_v")[-1])
                        content = file.read_text(encoding="utf-8")
                        self._cache[(name, version)] = content
                        max_version = max(max_version, version)
                    except (ValueError, IOError) as exc:
                        logger.warning("Failed to load template %s: %s", file, exc)
                elif file.suffix == ".txt":
                    # Non-versioned file treated as v1
                    content = file.read_text(encoding="utf-8")
                    self._cache[(name, 1)] = content
                    max_version = max(max_version, 1)

            if max_version > 0:
                self._active_versions[name] = max_version
                logger.info("Loaded template '%s' v%d", name, max_version)

        # Backfill any missing templates with defaults
        for name, template in _DEFAULT_TEMPLATES.items():
            if name not in self._active_versions:
                self._cache[(name, 1)] = template
                self._active_versions[name] = 1
                logger.info("Using default template for '%s'", name)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_template(
        self,
        name: str,
        version: int | None = None,
    ) -> str:
        """
        Get a prompt template by name.

        If version is None, returns the active (latest) version.
        Raises KeyError if the template/version is not found.
        """
        if version is None:
            version = self._active_versions.get(name)
            if version is None:
                raise KeyError(f"Unknown template: {name}")

        key = (name, version)
        if key not in self._cache:
            raise KeyError(f"Template '{name}' version {version} not found")

        return self._cache[key]

    def render(
        self,
        name: str,
        *,
        version: int | None = None,
        **kwargs: Any,
    ) -> str:
        """
        Get and render a prompt template with the given variables.

        Uses str.format_map with a defaultdict to leave unknown
        placeholders intact rather than raising.
        """
        template = self.get_template(name, version)
        from collections import defaultdict
        safe_kwargs = defaultdict(lambda: "{unknown}", kwargs)
        return template.format_map(safe_kwargs)

    def get_active_version(self, name: str) -> int | None:
        """Get the active version number for a template."""
        return self._active_versions.get(name)

    def set_active_version(self, name: str, version: int) -> None:
        """Pin a template to a specific version (rollback support)."""
        key = (name, version)
        if key not in self._cache:
            raise KeyError(f"Template '{name}' version {version} not found")
        self._active_versions[name] = version
        logger.info("Template '%s' pinned to version %d", name, version)

    def list_templates(self) -> dict[str, int]:
        """Return a dict of template_name -> active_version."""
        return dict(self._active_versions)

    def list_versions(self, name: str) -> list[int]:
        """Return all available versions for a template."""
        versions = [v for (n, v) in self._cache.keys() if n == name]
        return sorted(versions)

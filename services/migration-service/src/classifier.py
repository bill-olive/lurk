"""Content classifier that assigns ArtifactType, sensitivity, customer-facing status, and tags.

Used during the CLASSIFY stage of the migration pipeline to categorise
every extracted item before redaction and mapping.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from .models import (
    ArtifactType,
    ContentClassification,
    SensitivityLevel,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keyword / heuristic catalogues
# ---------------------------------------------------------------------------

_DECISION_KEYWORDS = {
    "decided",
    "decision",
    "agreed",
    "approved",
    "go with",
    "going with",
    "let's do",
    "we will",
    "final call",
    "sign off",
    "green light",
}

_ACTION_ITEM_KEYWORDS = {
    "action item",
    "todo",
    "to-do",
    "follow up",
    "follow-up",
    "assigned to",
    "owner:",
    "due date",
    "deadline",
    "next step",
}

_MEETING_KEYWORDS = {
    "meeting notes",
    "standup",
    "stand-up",
    "retro",
    "retrospective",
    "sync",
    "all-hands",
    "kickoff",
    "agenda",
    "minutes",
    "attendees",
}

_CUSTOMER_FACING_KEYWORDS = {
    "customer",
    "client",
    "external",
    "public",
    "partner",
    "vendor",
    "prospect",
    "user-facing",
    "support ticket",
    "helpdesk",
}

_CONFIDENTIAL_KEYWORDS = {
    "confidential",
    "restricted",
    "internal only",
    "do not share",
    "nda",
    "privileged",
    "sensitive",
    "under embargo",
    "pre-release",
}

_RESTRICTED_KEYWORDS = {
    "top secret",
    "restricted",
    "classified",
    "board only",
    "executive only",
    "legal hold",
    "attorney-client",
}

# File extension -> artifact type
_EXTENSION_MAP: dict[str, ArtifactType] = {
    ".doc": ArtifactType.DOCUMENT,
    ".docx": ArtifactType.DOCUMENT,
    ".txt": ArtifactType.DOCUMENT,
    ".md": ArtifactType.DOCUMENT,
    ".rtf": ArtifactType.DOCUMENT,
    ".xls": ArtifactType.SPREADSHEET,
    ".xlsx": ArtifactType.SPREADSHEET,
    ".csv": ArtifactType.SPREADSHEET,
    ".ppt": ArtifactType.PRESENTATION,
    ".pptx": ArtifactType.PRESENTATION,
    ".key": ArtifactType.PRESENTATION,
    ".pdf": ArtifactType.PDF,
    ".png": ArtifactType.IMAGE,
    ".jpg": ArtifactType.IMAGE,
    ".jpeg": ArtifactType.IMAGE,
    ".gif": ArtifactType.IMAGE,
    ".svg": ArtifactType.IMAGE,
    ".webp": ArtifactType.IMAGE,
}

# MIME type prefix -> artifact type
_MIME_MAP: dict[str, ArtifactType] = {
    "application/vnd.google-apps.document": ArtifactType.DOCUMENT,
    "application/vnd.google-apps.spreadsheet": ArtifactType.SPREADSHEET,
    "application/vnd.google-apps.presentation": ArtifactType.PRESENTATION,
    "application/pdf": ArtifactType.PDF,
    "image/": ArtifactType.IMAGE,
}


@dataclass
class ContentClassifier:
    """Classifies content items during the migration CLASSIFY stage."""

    def classify_text(
        self,
        text: str,
        *,
        source_type: str = "message",
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> ContentClassification:
        """Classify a text-based content item.

        Returns a ContentClassification with artifact_type, sensitivity,
        customer-facing flag, tags, and confidence.
        """
        text_lower = text.lower()
        tags: list[str] = []
        confidence = 0.6  # baseline

        # --- Determine artifact type ---
        artifact_type = self._infer_artifact_type(
            text_lower, source_type, filename, mime_type
        )

        # --- Tags based on keyword matches ---
        if self._keyword_hit(text_lower, _DECISION_KEYWORDS):
            tags.append("decision")
            if artifact_type == ArtifactType.MESSAGE:
                artifact_type = ArtifactType.DECISION
            confidence = min(1.0, confidence + 0.1)

        if self._keyword_hit(text_lower, _ACTION_ITEM_KEYWORDS):
            tags.append("action_item")
            if artifact_type == ArtifactType.MESSAGE:
                artifact_type = ArtifactType.ACTION_ITEM
            confidence = min(1.0, confidence + 0.1)

        if self._keyword_hit(text_lower, _MEETING_KEYWORDS):
            tags.append("meeting")
            if artifact_type in (ArtifactType.MESSAGE, ArtifactType.DOCUMENT):
                artifact_type = ArtifactType.MEETING_NOTES
            confidence = min(1.0, confidence + 0.1)

        # --- Customer facing ---
        is_customer_facing = self._keyword_hit(text_lower, _CUSTOMER_FACING_KEYWORDS)
        if is_customer_facing:
            tags.append("customer_facing")

        # --- Sensitivity ---
        sensitivity = self._classify_sensitivity(text_lower)

        return ContentClassification(
            artifact_type=artifact_type,
            sensitivity=sensitivity,
            is_customer_facing=is_customer_facing,
            tags=tags,
            confidence=round(confidence, 2),
        )

    def classify_file(
        self,
        filename: str,
        mime_type: str | None = None,
        *,
        description: str = "",
    ) -> ContentClassification:
        """Classify a file-based content item."""
        artifact_type = self._type_from_filename(filename)
        if artifact_type is None and mime_type:
            artifact_type = self._type_from_mime(mime_type)
        if artifact_type is None:
            artifact_type = ArtifactType.FILE

        tags: list[str] = []
        desc_lower = description.lower()

        is_customer_facing = self._keyword_hit(desc_lower, _CUSTOMER_FACING_KEYWORDS)
        if is_customer_facing:
            tags.append("customer_facing")

        sensitivity = self._classify_sensitivity(desc_lower)

        return ContentClassification(
            artifact_type=artifact_type,
            sensitivity=sensitivity,
            is_customer_facing=is_customer_facing,
            tags=tags,
            confidence=0.7,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _infer_artifact_type(
        self,
        text_lower: str,
        source_type: str,
        filename: str | None,
        mime_type: str | None,
    ) -> ArtifactType:
        # From filename
        if filename:
            at = self._type_from_filename(filename)
            if at:
                return at

        # From MIME
        if mime_type:
            at = self._type_from_mime(mime_type)
            if at:
                return at

        # From source_type hint
        source_map: dict[str, ArtifactType] = {
            "message": ArtifactType.MESSAGE,
            "thread": ArtifactType.THREAD,
            "document": ArtifactType.DOCUMENT,
            "page": ArtifactType.PAGE,
            "database": ArtifactType.DATABASE,
            "spreadsheet": ArtifactType.SPREADSHEET,
            "presentation": ArtifactType.PRESENTATION,
        }
        return source_map.get(source_type, ArtifactType.MESSAGE)

    @staticmethod
    def _type_from_filename(filename: str) -> ArtifactType | None:
        for ext, at in _EXTENSION_MAP.items():
            if filename.lower().endswith(ext):
                return at
        return None

    @staticmethod
    def _type_from_mime(mime_type: str) -> ArtifactType | None:
        for prefix, at in _MIME_MAP.items():
            if mime_type.startswith(prefix):
                return at
        return None

    @staticmethod
    def _keyword_hit(text: str, keywords: set[str]) -> bool:
        return any(kw in text for kw in keywords)

    @staticmethod
    def _classify_sensitivity(text: str) -> SensitivityLevel:
        if any(kw in text for kw in _RESTRICTED_KEYWORDS):
            return SensitivityLevel.RESTRICTED
        if any(kw in text for kw in _CONFIDENTIAL_KEYWORDS):
            return SensitivityLevel.CONFIDENTIAL
        return SensitivityLevel.INTERNAL

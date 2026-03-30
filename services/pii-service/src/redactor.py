"""RedactionEngine -- multi-level PII redaction with typed token replacement.

Implements the redaction pipeline from PRD Section 8.2:
  - Four levels: aggressive, standard, minimal, none
  - Entity map generation for reversible redaction
  - Typed token replacement: [PERSON_1], [ORG_1], [FINANCIAL_TERM_1], etc.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field

from .detector import PIIDetector
from .models import (
    CustomPattern,
    EntityMapEntry,
    PIIEntity,
    PIIEntityType,
    RedactionLevel,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Level definitions -- which entity types each level redacts
# ---------------------------------------------------------------------------

_AGGRESSIVE_TYPES: set[PIIEntityType] = set(PIIEntityType)

_STANDARD_TYPES: set[PIIEntityType] = {
    PIIEntityType.EMAIL,
    PIIEntityType.PHONE,
    PIIEntityType.SSN,
    PIIEntityType.CREDIT_CARD,
    PIIEntityType.API_KEY,
    PIIEntityType.TOKEN,
    PIIEntityType.PASSWORD,
    PIIEntityType.IP_ADDRESS,
    PIIEntityType.ACCOUNT_ID,
    PIIEntityType.PERSON,
    PIIEntityType.ADDRESS,
    PIIEntityType.DATE_OF_BIRTH,
    PIIEntityType.COMPENSATION,
    PIIEntityType.HEALTH_TERM,
    PIIEntityType.CUSTOM,
}

_MINIMAL_TYPES: set[PIIEntityType] = {
    PIIEntityType.SSN,
    PIIEntityType.CREDIT_CARD,
    PIIEntityType.API_KEY,
    PIIEntityType.TOKEN,
    PIIEntityType.PASSWORD,
    PIIEntityType.ACCOUNT_ID,
}

_LEVEL_MAP: dict[RedactionLevel, set[PIIEntityType]] = {
    RedactionLevel.AGGRESSIVE: _AGGRESSIVE_TYPES,
    RedactionLevel.STANDARD: _STANDARD_TYPES,
    RedactionLevel.MINIMAL: _MINIMAL_TYPES,
    RedactionLevel.NONE: set(),
}

# ---------------------------------------------------------------------------
# Token label mapping for friendly names
# ---------------------------------------------------------------------------

_TOKEN_LABELS: dict[PIIEntityType, str] = {
    PIIEntityType.EMAIL: "EMAIL",
    PIIEntityType.PHONE: "PHONE",
    PIIEntityType.SSN: "SSN",
    PIIEntityType.CREDIT_CARD: "CREDIT_CARD",
    PIIEntityType.API_KEY: "API_KEY",
    PIIEntityType.TOKEN: "TOKEN",
    PIIEntityType.PASSWORD: "PASSWORD",
    PIIEntityType.IP_ADDRESS: "IP_ADDRESS",
    PIIEntityType.URL: "URL",
    PIIEntityType.ACCOUNT_ID: "ACCOUNT_ID",
    PIIEntityType.PERSON: "PERSON",
    PIIEntityType.ORGANIZATION: "ORG",
    PIIEntityType.ADDRESS: "ADDRESS",
    PIIEntityType.DATE_OF_BIRTH: "DOB",
    PIIEntityType.FINANCIAL_TERM: "FINANCIAL_TERM",
    PIIEntityType.HEALTH_TERM: "HEALTH_TERM",
    PIIEntityType.LEGAL_PRIVILEGED: "LEGAL_PRIVILEGED",
    PIIEntityType.COMPENSATION: "COMPENSATION",
    PIIEntityType.CUSTOM: "CUSTOM",
}


# ---------------------------------------------------------------------------
# RedactionEngine
# ---------------------------------------------------------------------------

@dataclass
class RedactionEngine:
    """Applies configurable redaction to text based on detected PII entities."""

    detector: PIIDetector = field(default_factory=PIIDetector)

    def redact(
        self,
        text: str,
        *,
        level: RedactionLevel = RedactionLevel.STANDARD,
        entity_types: list[PIIEntityType] | None = None,
        min_score: float = 0.5,
        custom_patterns: list[CustomPattern] | None = None,
        return_entity_map: bool = False,
    ) -> tuple[str, int, list[EntityMapEntry] | None]:
        """Redact PII from *text* and return (redacted_text, count, entity_map).

        Parameters
        ----------
        text:
            The source text to redact.
        level:
            Redaction aggressiveness.
        entity_types:
            Optional explicit filter (overrides level-based filtering).
        min_score:
            Minimum confidence threshold for including an entity.
        custom_patterns:
            Org-specific custom patterns forwarded to the detector.
        return_entity_map:
            Whether to build and return the entity map.

        Returns
        -------
        tuple of (redacted_text, entities_redacted_count, entity_map_or_None)
        """
        if level == RedactionLevel.NONE:
            return text, 0, [] if return_entity_map else None

        # 1. Detect all entities
        entities = self.detector.detect(
            text,
            entity_types=entity_types,
            min_score=min_score,
            custom_patterns=custom_patterns,
        )

        # 2. Filter by redaction level
        allowed_types = _LEVEL_MAP[level]
        if entity_types:
            allowed_types = allowed_types & set(entity_types)

        filtered = [e for e in entities if e.entity_type in allowed_types]

        if not filtered:
            return text, 0, [] if return_entity_map else None

        # 3. Build token assignments (consistent within a single call)
        token_map = self._build_token_map(filtered)

        # 4. Replace spans (process right-to-left to preserve offsets)
        filtered.sort(key=lambda e: e.start, reverse=True)
        redacted = text
        entity_map: list[EntityMapEntry] = []

        for entity in filtered:
            token = token_map[(entity.entity_type, entity.text)]
            redacted = redacted[: entity.start] + token + redacted[entity.end :]
            if return_entity_map:
                entity_map.append(
                    EntityMapEntry(
                        token=token,
                        original=entity.text,
                        entity_type=entity.entity_type,
                    )
                )

        # Deduplicate entity_map (same token may appear multiple times)
        if return_entity_map:
            seen: set[str] = set()
            unique_map: list[EntityMapEntry] = []
            for entry in entity_map:
                key = f"{entry.token}:{entry.original}"
                if key not in seen:
                    seen.add(key)
                    unique_map.append(entry)
            entity_map = unique_map

        return (
            redacted,
            len(filtered),
            entity_map if return_entity_map else None,
        )

    # ------------------------------------------------------------------
    # Validation helper
    # ------------------------------------------------------------------

    def validate(
        self,
        text: str,
        *,
        expected_level: RedactionLevel = RedactionLevel.STANDARD,
        custom_patterns: list[CustomPattern] | None = None,
    ) -> list[PIIEntity]:
        """Check that *text* contains no residual PII for the given level.

        Returns a list of any PII entities that should have been redacted.
        """
        entities = self.detector.detect(
            text,
            min_score=0.4,  # slightly lower threshold for safety
            custom_patterns=custom_patterns,
        )
        allowed_types = _LEVEL_MAP.get(expected_level, _STANDARD_TYPES)
        return [e for e in entities if e.entity_type in allowed_types]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_token_map(
        entities: list[PIIEntity],
    ) -> dict[tuple[PIIEntityType, str], str]:
        """Assign consistent typed tokens like [PERSON_1], [ORG_2], etc.

        The same (entity_type, text) pair always gets the same token within
        a single redaction call.
        """
        counters: dict[PIIEntityType, int] = defaultdict(int)
        mapping: dict[tuple[PIIEntityType, str], str] = {}

        for entity in entities:
            key = (entity.entity_type, entity.text)
            if key not in mapping:
                counters[entity.entity_type] += 1
                label = _TOKEN_LABELS.get(entity.entity_type, entity.entity_type.value)
                mapping[key] = f"[{label}_{counters[entity.entity_type]}]"

        return mapping

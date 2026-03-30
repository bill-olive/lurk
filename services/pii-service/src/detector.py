"""PIIDetector -- multi-strategy PII detection engine.

Implements the detection pipeline from PRD Section 8.2:
  1. Regex detectors (high-precision patterns)
  2. NER detectors via Presidio (PERSON, ORGANIZATION, ADDRESS, DATE_OF_BIRTH)
  3. Context detectors (domain-specific keyword/phrase matching)
  4. Custom org-configurable detectors
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Sequence

from presidio_analyzer import AnalyzerEngine, RecognizerResult

from .models import CustomPattern, PIIEntity, PIIEntityType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regex catalogue
# ---------------------------------------------------------------------------

_REGEX_PATTERNS: dict[PIIEntityType, list[re.Pattern[str]]] = {
    PIIEntityType.EMAIL: [
        re.compile(
            r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
        ),
    ],
    PIIEntityType.PHONE: [
        # US/international formats
        re.compile(
            r"(?<!\d)(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}(?!\d)"
        ),
    ],
    PIIEntityType.SSN: [
        re.compile(r"\b\d{3}[\s\-]?\d{2}[\s\-]?\d{4}\b"),
    ],
    PIIEntityType.CREDIT_CARD: [
        # Visa, MC, Amex, Discover (with optional separators)
        re.compile(
            r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
            r"[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}\b"
        ),
    ],
    PIIEntityType.API_KEY: [
        # Generic API key patterns (sk-..., ak-..., key-..., etc.)
        re.compile(
            r"\b(?:sk|ak|pk|key|api[_\-]?key)[_\-][A-Za-z0-9]{20,}\b",
            re.IGNORECASE,
        ),
        # AWS-style access key IDs
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    ],
    PIIEntityType.TOKEN: [
        # Bearer tokens, JWT-like strings
        re.compile(r"\b(?:bearer\s+)?[A-Za-z0-9\-_]{40,}\.[A-Za-z0-9\-_]{6,}\b"),
        # GitHub PATs
        re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b"),
    ],
    PIIEntityType.PASSWORD: [
        # password=..., passwd=..., secret=... in config-like text
        re.compile(
            r"(?:password|passwd|secret|pwd)\s*[:=]\s*['\"]?(\S{6,})['\"]?",
            re.IGNORECASE,
        ),
    ],
    PIIEntityType.IP_ADDRESS: [
        # IPv4
        re.compile(
            r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
            r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
        ),
        # IPv6 (simplified)
        re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b"),
    ],
    PIIEntityType.URL: [
        re.compile(
            r"https?://[^\s\"'<>\]\)]{4,}",
            re.IGNORECASE,
        ),
    ],
    PIIEntityType.ACCOUNT_ID: [
        # Generic numeric IDs that look like account numbers
        re.compile(
            r"\b(?:account|acct|acc)[_\-\s#:]*\d{6,}\b",
            re.IGNORECASE,
        ),
    ],
}

# ---------------------------------------------------------------------------
# Context keyword catalogue
# ---------------------------------------------------------------------------

_FINANCIAL_TERMS = {
    "revenue",
    "profit",
    "loss",
    "ebitda",
    "margin",
    "valuation",
    "runway",
    "burn rate",
    "arr",
    "mrr",
    "gmv",
    "cac",
    "ltv",
    "arpu",
    "earnings",
    "dividend",
    "capitalization",
    "funding round",
    "series a",
    "series b",
    "series c",
    "ipo",
    "balance sheet",
    "cash flow",
    "p&l",
    "income statement",
}

_HEALTH_TERMS = {
    "diagnosis",
    "prescription",
    "patient",
    "treatment",
    "medication",
    "symptoms",
    "medical record",
    "hipaa",
    "health insurance",
    "medical history",
    "blood pressure",
    "cholesterol",
    "disability",
    "mental health",
    "therapy",
    "clinical trial",
}

_LEGAL_PRIVILEGED = {
    "attorney-client",
    "attorney client",
    "privileged and confidential",
    "legal hold",
    "litigation",
    "settlement",
    "deposition",
    "subpoena",
    "under seal",
    "work product",
    "privileged communication",
    "nda",
    "non-disclosure",
    "confidential",
}

_COMPENSATION = {
    "salary",
    "compensation",
    "bonus",
    "equity",
    "stock options",
    "vesting",
    "total comp",
    "base pay",
    "pay band",
    "pay grade",
    "signing bonus",
    "retention bonus",
    "rsu",
    "restricted stock",
    "offer letter",
}

_CONTEXT_CATALOGUES: dict[PIIEntityType, set[str]] = {
    PIIEntityType.FINANCIAL_TERM: _FINANCIAL_TERMS,
    PIIEntityType.HEALTH_TERM: _HEALTH_TERMS,
    PIIEntityType.LEGAL_PRIVILEGED: _LEGAL_PRIVILEGED,
    PIIEntityType.COMPENSATION: _COMPENSATION,
}

# ---------------------------------------------------------------------------
# Presidio entity-type mapping
# ---------------------------------------------------------------------------

_PRESIDIO_TO_LURK: dict[str, PIIEntityType] = {
    "PERSON": PIIEntityType.PERSON,
    "ORG": PIIEntityType.ORGANIZATION,
    "ORGANIZATION": PIIEntityType.ORGANIZATION,
    "LOCATION": PIIEntityType.ADDRESS,
    "ADDRESS": PIIEntityType.ADDRESS,
    "DATE_TIME": PIIEntityType.DATE_OF_BIRTH,
}


# ---------------------------------------------------------------------------
# PIIDetector
# ---------------------------------------------------------------------------

@dataclass
class PIIDetector:
    """Multi-strategy PII detection engine.

    Combines regex, NER (via Presidio), and context-based detectors
    to identify PII entities in arbitrary text.
    """

    _analyzer: AnalyzerEngine | None = field(default=None, init=False, repr=False)
    _custom_patterns: list[CustomPattern] = field(default_factory=list)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _get_analyzer(self) -> AnalyzerEngine:
        """Lazy-load the Presidio analyzer (heavy init)."""
        if self._analyzer is None:
            try:
                self._analyzer = AnalyzerEngine()
                logger.info("Presidio AnalyzerEngine initialised")
            except Exception:
                logger.warning(
                    "Presidio AnalyzerEngine failed to initialise; "
                    "NER detection will be unavailable",
                    exc_info=True,
                )
        return self._analyzer  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(
        self,
        text: str,
        *,
        entity_types: Sequence[PIIEntityType] | None = None,
        min_score: float = 0.5,
        custom_patterns: Sequence[CustomPattern] | None = None,
    ) -> list[PIIEntity]:
        """Run all detection strategies and return merged, de-duped results."""
        allowed = set(entity_types) if entity_types else None
        results: list[PIIEntity] = []

        results.extend(self._detect_regex(text, allowed, min_score))
        results.extend(self._detect_ner(text, allowed, min_score))
        results.extend(self._detect_context(text, allowed, min_score))

        all_custom = list(self._custom_patterns)
        if custom_patterns:
            all_custom.extend(custom_patterns)
        if all_custom:
            results.extend(
                self._detect_custom(text, all_custom, allowed, min_score)
            )

        results = self._deduplicate(results)
        results.sort(key=lambda e: e.start)
        return results

    def register_custom_patterns(self, patterns: Sequence[CustomPattern]) -> None:
        """Register org-level custom patterns that persist across calls."""
        self._custom_patterns.extend(patterns)

    # ------------------------------------------------------------------
    # Regex detection
    # ------------------------------------------------------------------

    def _detect_regex(
        self,
        text: str,
        allowed: set[PIIEntityType] | None,
        min_score: float,
    ) -> list[PIIEntity]:
        entities: list[PIIEntity] = []
        for entity_type, patterns in _REGEX_PATTERNS.items():
            if allowed and entity_type not in allowed:
                continue
            for pattern in patterns:
                for match in pattern.finditer(text):
                    # For PASSWORD, capture group 1 is the actual secret
                    if entity_type == PIIEntityType.PASSWORD and match.lastindex:
                        span_text = match.group(1)
                        start = match.start(1)
                        end = match.end(1)
                    else:
                        span_text = match.group(0)
                        start = match.start()
                        end = match.end()

                    score = 0.95  # regex = high confidence
                    if score >= min_score:
                        entities.append(
                            PIIEntity(
                                entity_type=entity_type,
                                text=span_text,
                                start=start,
                                end=end,
                                score=score,
                                source="regex",
                            )
                        )
        return entities

    # ------------------------------------------------------------------
    # NER detection (Presidio)
    # ------------------------------------------------------------------

    def _detect_ner(
        self,
        text: str,
        allowed: set[PIIEntityType] | None,
        min_score: float,
    ) -> list[PIIEntity]:
        analyzer = self._get_analyzer()
        if analyzer is None:
            return []

        presidio_entities = [
            "PERSON",
            "ORG",
            "ORGANIZATION",
            "LOCATION",
            "ADDRESS",
            "DATE_TIME",
        ]

        try:
            results: list[RecognizerResult] = analyzer.analyze(
                text=text,
                language="en",
                entities=presidio_entities,
            )
        except Exception:
            logger.error("Presidio analysis failed", exc_info=True)
            return []

        entities: list[PIIEntity] = []
        for r in results:
            lurk_type = _PRESIDIO_TO_LURK.get(r.entity_type)
            if lurk_type is None:
                continue
            if allowed and lurk_type not in allowed:
                continue
            if r.score < min_score:
                continue
            entities.append(
                PIIEntity(
                    entity_type=lurk_type,
                    text=text[r.start : r.end],
                    start=r.start,
                    end=r.end,
                    score=round(r.score, 4),
                    source="ner",
                )
            )
        return entities

    # ------------------------------------------------------------------
    # Context detection
    # ------------------------------------------------------------------

    def _detect_context(
        self,
        text: str,
        allowed: set[PIIEntityType] | None,
        min_score: float,
    ) -> list[PIIEntity]:
        entities: list[PIIEntity] = []
        text_lower = text.lower()

        for entity_type, terms in _CONTEXT_CATALOGUES.items():
            if allowed and entity_type not in allowed:
                continue
            for term in terms:
                idx = 0
                while True:
                    pos = text_lower.find(term, idx)
                    if pos == -1:
                        break
                    score = 0.75
                    if score >= min_score:
                        entities.append(
                            PIIEntity(
                                entity_type=entity_type,
                                text=text[pos : pos + len(term)],
                                start=pos,
                                end=pos + len(term),
                                score=score,
                                source="context",
                            )
                        )
                    idx = pos + len(term)
        return entities

    # ------------------------------------------------------------------
    # Custom pattern detection
    # ------------------------------------------------------------------

    def _detect_custom(
        self,
        text: str,
        patterns: Sequence[CustomPattern],
        allowed: set[PIIEntityType] | None,
        min_score: float,
    ) -> list[PIIEntity]:
        entities: list[PIIEntity] = []
        for cp in patterns:
            if allowed and cp.entity_type not in allowed:
                continue
            try:
                compiled = re.compile(cp.pattern, re.IGNORECASE)
            except re.error:
                logger.warning("Invalid custom regex pattern: %s", cp.pattern)
                continue

            base_score = cp.score
            for match in compiled.finditer(text):
                score = base_score

                # Boost if context words are nearby
                if cp.context_words:
                    window = text[
                        max(0, match.start() - 100) : match.end() + 100
                    ].lower()
                    hits = sum(1 for w in cp.context_words if w.lower() in window)
                    if hits > 0:
                        score = min(1.0, score + 0.05 * hits)

                if score >= min_score:
                    entities.append(
                        PIIEntity(
                            entity_type=cp.entity_type,
                            text=match.group(0),
                            start=match.start(),
                            end=match.end(),
                            score=round(score, 4),
                            source="custom",
                        )
                    )
        return entities

    # ------------------------------------------------------------------
    # De-duplication
    # ------------------------------------------------------------------

    @staticmethod
    def _deduplicate(entities: list[PIIEntity]) -> list[PIIEntity]:
        """Remove overlapping entities, keeping the highest-scoring one."""
        if not entities:
            return entities

        entities.sort(key=lambda e: (-e.score, e.start))
        kept: list[PIIEntity] = []
        occupied: list[tuple[int, int]] = []

        for entity in entities:
            overlaps = any(
                not (entity.end <= s or entity.start >= e) for s, e in occupied
            )
            if not overlaps:
                kept.append(entity)
                occupied.append((entity.start, entity.end))

        return kept

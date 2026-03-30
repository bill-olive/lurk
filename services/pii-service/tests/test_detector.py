"""Tests for PIIDetector — multi-strategy PII detection engine."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.detector import PIIDetector
from src.models import CustomPattern, PIIEntity, PIIEntityType


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def detector() -> PIIDetector:
    """Create a fresh PIIDetector instance with NER mocked out."""
    d = PIIDetector()
    # Mock the Presidio analyzer to avoid heavy NLP model loading in tests
    d._analyzer = MagicMock()
    d._analyzer.analyze.return_value = []
    return d


@pytest.fixture
def detector_no_ner() -> PIIDetector:
    """Create a detector that returns no NER results."""
    d = PIIDetector()
    d._analyzer = None  # Will fall through gracefully
    return d


# ---------------------------------------------------------------------------
# Regex detection tests
# ---------------------------------------------------------------------------


class TestRegexDetection:
    def test_detects_email_addresses(self, detector: PIIDetector) -> None:
        text = "Contact us at john.doe@example.com for more info."
        entities = detector.detect(text, entity_types=[PIIEntityType.EMAIL])
        assert len(entities) >= 1
        email_entity = next(e for e in entities if e.entity_type == PIIEntityType.EMAIL)
        assert "john.doe@example.com" in email_entity.text
        assert email_entity.source == "regex"
        assert email_entity.score >= 0.9

    def test_detects_phone_numbers(self, detector: PIIDetector) -> None:
        text = "Call me at (555) 123-4567 or +1-555-987-6543."
        entities = detector.detect(text, entity_types=[PIIEntityType.PHONE])
        assert len(entities) >= 1
        assert any(e.entity_type == PIIEntityType.PHONE for e in entities)

    def test_detects_ssn(self, detector: PIIDetector) -> None:
        text = "My SSN is 123-45-6789."
        entities = detector.detect(text, entity_types=[PIIEntityType.SSN])
        assert len(entities) >= 1
        ssn = next(e for e in entities if e.entity_type == PIIEntityType.SSN)
        assert "123-45-6789" in ssn.text

    def test_detects_credit_card_numbers(self, detector: PIIDetector) -> None:
        text = "Payment with card 4111-1111-1111-1111."
        entities = detector.detect(text, entity_types=[PIIEntityType.CREDIT_CARD])
        assert len(entities) >= 1
        assert any(e.entity_type == PIIEntityType.CREDIT_CARD for e in entities)

    def test_detects_api_keys(self, detector: PIIDetector) -> None:
        text = "Use API key sk-abcdef1234567890abcdef1234567890 for auth."
        entities = detector.detect(text, entity_types=[PIIEntityType.API_KEY])
        assert len(entities) >= 1
        assert entities[0].entity_type == PIIEntityType.API_KEY

    def test_detects_aws_access_keys(self, detector: PIIDetector) -> None:
        text = "AWS key: AKIAIOSFODNN7EXAMPLE"
        entities = detector.detect(text, entity_types=[PIIEntityType.API_KEY])
        assert len(entities) >= 1

    def test_detects_ip_addresses(self, detector: PIIDetector) -> None:
        text = "Server is at 192.168.1.100."
        entities = detector.detect(text, entity_types=[PIIEntityType.IP_ADDRESS])
        assert len(entities) >= 1
        assert "192.168.1.100" in entities[0].text

    def test_detects_urls(self, detector: PIIDetector) -> None:
        text = "Visit https://internal.company.com/admin for details."
        entities = detector.detect(text, entity_types=[PIIEntityType.URL])
        assert len(entities) >= 1

    def test_detects_passwords_in_config(self, detector: PIIDetector) -> None:
        text = "password=MySecretPass123!"
        entities = detector.detect(text, entity_types=[PIIEntityType.PASSWORD])
        assert len(entities) >= 1
        assert entities[0].entity_type == PIIEntityType.PASSWORD

    def test_detects_account_ids(self, detector: PIIDetector) -> None:
        text = "Account #12345678 is overdue."
        entities = detector.detect(text, entity_types=[PIIEntityType.ACCOUNT_ID])
        assert len(entities) >= 1


# ---------------------------------------------------------------------------
# NER detection tests
# ---------------------------------------------------------------------------


class TestNERDetection:
    def test_detects_person_names(self) -> None:
        detector = PIIDetector()
        # Mock Presidio to return a PERSON entity
        mock_analyzer = MagicMock()
        mock_result = MagicMock()
        mock_result.entity_type = "PERSON"
        mock_result.start = 10
        mock_result.end = 18
        mock_result.score = 0.85
        mock_analyzer.analyze.return_value = [mock_result]
        detector._analyzer = mock_analyzer

        text = "Meet with John Doe at the office."
        entities = detector.detect(text, entity_types=[PIIEntityType.PERSON])
        assert len(entities) >= 1
        assert any(e.entity_type == PIIEntityType.PERSON for e in entities)
        assert any(e.source == "ner" for e in entities)

    def test_detects_organizations(self) -> None:
        detector = PIIDetector()
        mock_analyzer = MagicMock()
        mock_result = MagicMock()
        mock_result.entity_type = "ORGANIZATION"
        mock_result.start = 5
        mock_result.end = 15
        mock_result.score = 0.80
        mock_analyzer.analyze.return_value = [mock_result]
        detector._analyzer = mock_analyzer

        text = "From Acme Corp about the deal."
        entities = detector.detect(text, entity_types=[PIIEntityType.ORGANIZATION])
        assert len(entities) >= 1
        assert any(e.entity_type == PIIEntityType.ORGANIZATION for e in entities)

    def test_gracefully_handles_analyzer_failure(self) -> None:
        detector = PIIDetector()
        mock_analyzer = MagicMock()
        mock_analyzer.analyze.side_effect = RuntimeError("NLP model error")
        detector._analyzer = mock_analyzer

        # Should not raise, just return regex+context results
        text = "Contact john@example.com"
        entities = detector.detect(text)
        # Should still get regex results
        emails = [e for e in entities if e.entity_type == PIIEntityType.EMAIL]
        assert len(emails) >= 1

    def test_handles_missing_analyzer(self, detector_no_ner: PIIDetector) -> None:
        text = "Some text with john@example.com"
        entities = detector_no_ner.detect(text, entity_types=[PIIEntityType.EMAIL])
        assert len(entities) >= 1


# ---------------------------------------------------------------------------
# Context detection tests
# ---------------------------------------------------------------------------


class TestContextDetection:
    def test_detects_financial_terms(self, detector: PIIDetector) -> None:
        text = "Our revenue grew by 20% and the ARR is $5M."
        entities = detector.detect(
            text, entity_types=[PIIEntityType.FINANCIAL_TERM]
        )
        assert len(entities) >= 1
        terms = {e.text.lower() for e in entities}
        assert "revenue" in terms or "arr" in terms

    def test_detects_health_terms(self, detector: PIIDetector) -> None:
        text = "The patient requires a new prescription."
        entities = detector.detect(
            text, entity_types=[PIIEntityType.HEALTH_TERM]
        )
        assert len(entities) >= 1
        terms = {e.text.lower() for e in entities}
        assert "patient" in terms or "prescription" in terms

    def test_detects_legal_privileged_terms(self, detector: PIIDetector) -> None:
        text = "This is a privileged and confidential communication."
        entities = detector.detect(
            text, entity_types=[PIIEntityType.LEGAL_PRIVILEGED]
        )
        assert len(entities) >= 1

    def test_detects_compensation_terms(self, detector: PIIDetector) -> None:
        text = "The salary offer is $150K with stock options."
        entities = detector.detect(
            text, entity_types=[PIIEntityType.COMPENSATION]
        )
        assert len(entities) >= 1
        terms = {e.text.lower() for e in entities}
        assert "salary" in terms or "stock options" in terms

    def test_context_detection_score_is_lower_than_regex(
        self, detector: PIIDetector
    ) -> None:
        text = "salary information and john@example.com"
        entities = detector.detect(text)
        context_entities = [e for e in entities if e.source == "context"]
        regex_entities = [e for e in entities if e.source == "regex"]
        if context_entities and regex_entities:
            assert max(e.score for e in context_entities) <= max(
                e.score for e in regex_entities
            )


# ---------------------------------------------------------------------------
# Custom pattern detection tests
# ---------------------------------------------------------------------------


class TestCustomPatternDetection:
    def test_custom_pattern_detects_matches(self, detector: PIIDetector) -> None:
        pattern = CustomPattern(
            name="internal_project_id",
            pattern=r"PROJ-\d{4,}",
            entity_type=PIIEntityType.CUSTOM,
            score=0.9,
        )
        text = "Refer to PROJ-12345 for details."
        entities = detector.detect(text, custom_patterns=[pattern])
        custom = [e for e in entities if e.source == "custom"]
        assert len(custom) >= 1
        assert "PROJ-12345" in custom[0].text

    def test_custom_pattern_context_boost(self, detector: PIIDetector) -> None:
        pattern = CustomPattern(
            name="employee_id",
            pattern=r"EMP\d{5}",
            entity_type=PIIEntityType.CUSTOM,
            score=0.7,
            context_words=["employee", "staff"],
        )
        text = "The employee EMP00123 was promoted."
        entities = detector.detect(text, custom_patterns=[pattern])
        custom = [e for e in entities if e.source == "custom"]
        assert len(custom) >= 1
        # Score should be boosted due to "employee" nearby
        assert custom[0].score > 0.7

    def test_registered_custom_patterns_persist(self, detector: PIIDetector) -> None:
        pattern = CustomPattern(
            name="ticket_id",
            pattern=r"TKT-\d+",
            entity_type=PIIEntityType.CUSTOM,
            score=0.85,
        )
        detector.register_custom_patterns([pattern])
        text = "See TKT-999 for the bug report."
        entities = detector.detect(text)
        custom = [e for e in entities if e.source == "custom"]
        assert len(custom) >= 1


# ---------------------------------------------------------------------------
# De-duplication tests
# ---------------------------------------------------------------------------


class TestDeduplication:
    def test_deduplicates_overlapping_entities(self, detector: PIIDetector) -> None:
        # Create entities that would overlap
        entities = [
            PIIEntity(
                entity_type=PIIEntityType.EMAIL,
                text="user@example.com",
                start=0,
                end=16,
                score=0.95,
                source="regex",
            ),
            PIIEntity(
                entity_type=PIIEntityType.URL,
                text="user@example.com",
                start=0,
                end=16,
                score=0.80,
                source="regex",
            ),
        ]
        deduped = PIIDetector._deduplicate(entities)
        assert len(deduped) == 1
        # Higher score (email) should be kept
        assert deduped[0].entity_type == PIIEntityType.EMAIL

    def test_keeps_non_overlapping_entities(self, detector: PIIDetector) -> None:
        entities = [
            PIIEntity(
                entity_type=PIIEntityType.EMAIL,
                text="a@b.com",
                start=0,
                end=7,
                score=0.95,
                source="regex",
            ),
            PIIEntity(
                entity_type=PIIEntityType.PHONE,
                text="555-1234",
                start=20,
                end=28,
                score=0.95,
                source="regex",
            ),
        ]
        deduped = PIIDetector._deduplicate(entities)
        assert len(deduped) == 2


# ---------------------------------------------------------------------------
# Redaction integration (RedactionEngine)
# ---------------------------------------------------------------------------


class TestRedactionEngine:
    def test_redaction_produces_typed_tokens(self) -> None:
        from src.redactor import RedactionEngine
        from src.models import RedactionLevel

        engine = RedactionEngine()
        # Mock detector to return controlled results
        engine.detector = PIIDetector()
        engine.detector._analyzer = MagicMock()
        engine.detector._analyzer.analyze.return_value = []

        text = "Email me at user@example.com, SSN is 123-45-6789."
        redacted, count, entity_map = engine.redact(
            text,
            level=RedactionLevel.STANDARD,
            return_entity_map=True,
        )

        assert "[EMAIL_1]" in redacted
        assert "[SSN_1]" in redacted
        assert count >= 2
        assert entity_map is not None
        assert any(e.token == "[EMAIL_1]" for e in entity_map)

    def test_aggressive_redaction_removes_more(self) -> None:
        from src.redactor import RedactionEngine
        from src.models import RedactionLevel

        engine = RedactionEngine()
        engine.detector = PIIDetector()
        engine.detector._analyzer = MagicMock()
        engine.detector._analyzer.analyze.return_value = []

        text = "Revenue is $5M. Contact john@example.com."
        redacted_std, count_std, _ = engine.redact(
            text, level=RedactionLevel.STANDARD
        )
        redacted_agg, count_agg, _ = engine.redact(
            text, level=RedactionLevel.AGGRESSIVE
        )
        # Aggressive should redact at least as many entities
        assert count_agg >= count_std

    def test_minimal_redaction_only_removes_secrets(self) -> None:
        from src.redactor import RedactionEngine
        from src.models import RedactionLevel

        engine = RedactionEngine()
        engine.detector = PIIDetector()
        engine.detector._analyzer = MagicMock()
        engine.detector._analyzer.analyze.return_value = []

        text = "API key: sk-abcdef1234567890abcdef1234567890. Revenue is $5M."
        redacted, count, _ = engine.redact(text, level=RedactionLevel.MINIMAL)
        assert "[API_KEY_1]" in redacted
        # Revenue (financial term) should NOT be redacted at minimal level
        assert "Revenue" in redacted

    def test_none_redaction_returns_original(self) -> None:
        from src.redactor import RedactionEngine
        from src.models import RedactionLevel

        engine = RedactionEngine()
        text = "john@example.com is a secret"
        redacted, count, _ = engine.redact(text, level=RedactionLevel.NONE)
        assert redacted == text
        assert count == 0

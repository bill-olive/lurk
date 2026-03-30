"""Tests for LLMGateway model selection, TokenMeter budget enforcement, and metering."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.gateway import (
    LLMGateway,
    MODEL_DEEP,
    MODEL_FAST,
    MAX_CONCURRENT_PER_ORG,
)
from src.metering import (
    ALERT_THRESHOLDS,
    DEFAULT_AGENT_DAILY_BUDGET,
    DEFAULT_ORG_DAILY_BUDGET,
    TokenMeter,
)
from src.models import (
    BudgetAlert,
    CompletionRequest,
    CompletionResponse,
    UsageRecord,
    UsageResponse,
)


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------


def make_completion_request(**overrides) -> CompletionRequest:
    defaults = dict(
        agent_id="agent-001",
        agent_type="personal",
        org_id="org-001",
        task_type="artifact_analysis",
        prompt="Analyse this artifact.",
        system_prompt="You are a helpful agent.",
        max_tokens=4096,
        temperature=0.3,
        metadata={},
    )
    defaults.update(overrides)
    return CompletionRequest(**defaults)


# ---------------------------------------------------------------------------
# Model selection tests
# ---------------------------------------------------------------------------


class TestModelSelection:
    def test_org_agent_selects_opus(self) -> None:
        model = LLMGateway.select_model("org", "artifact_analysis")
        assert model == MODEL_DEEP

    def test_function_agent_selects_opus(self) -> None:
        model = LLMGateway.select_model("function", "artifact_analysis")
        assert model == MODEL_DEEP

    def test_deep_analysis_task_selects_opus(self) -> None:
        model = LLMGateway.select_model("personal", "deep_analysis")
        assert model == MODEL_DEEP

    def test_customer_health_task_selects_opus(self) -> None:
        model = LLMGateway.select_model("personal", "customer_health")
        assert model == MODEL_DEEP

    def test_multi_artifact_synthesis_over_10_selects_opus(self) -> None:
        model = LLMGateway.select_model(
            "team",
            "multi_artifact_synthesis",
            metadata={"artifact_count": 15},
        )
        assert model == MODEL_DEEP

    def test_multi_artifact_synthesis_under_10_selects_sonnet(self) -> None:
        model = LLMGateway.select_model(
            "team",
            "multi_artifact_synthesis",
            metadata={"artifact_count": 5},
        )
        assert model == MODEL_FAST

    def test_multi_artifact_synthesis_no_metadata_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("team", "multi_artifact_synthesis")
        assert model == MODEL_FAST

    def test_personal_agent_artifact_analysis_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("personal", "artifact_analysis")
        assert model == MODEL_FAST

    def test_team_agent_conflict_detection_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("team", "conflict_detection")
        assert model == MODEL_FAST

    def test_voice_agent_meeting_summary_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("voice", "meeting_summary")
        assert model == MODEL_FAST

    def test_calendar_agent_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("calendar", "calendar_review")
        assert model == MODEL_FAST

    def test_migration_agent_selects_sonnet(self) -> None:
        model = LLMGateway.select_model("migration", "migration_classify")
        assert model == MODEL_FAST


# ---------------------------------------------------------------------------
# TokenMeter tests
# ---------------------------------------------------------------------------


class TestTokenMeterRecordUsage:
    @pytest.mark.asyncio
    async def test_records_org_and_agent_counters(self) -> None:
        meter = TokenMeter()
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=1000,
            output_tokens=500,
        )
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        org_counter = meter._counters[period]["org:org-001"]
        agent_counter = meter._counters[period]["agent:agent-001"]
        assert org_counter.total_tokens == 1500
        assert agent_counter.total_tokens == 1500
        assert org_counter.request_count == 1

    @pytest.mark.asyncio
    async def test_accumulates_multiple_calls(self) -> None:
        meter = TokenMeter()
        for _ in range(3):
            await meter.record_usage(
                org_id="org-001",
                agent_id="agent-001",
                model=MODEL_FAST,
                input_tokens=1000,
                output_tokens=500,
            )
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        org_counter = meter._counters[period]["org:org-001"]
        assert org_counter.total_tokens == 4500
        assert org_counter.request_count == 3

    @pytest.mark.asyncio
    async def test_tracks_model_breakdown(self) -> None:
        meter = TokenMeter()
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=1000,
            output_tokens=500,
        )
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_DEEP,
            input_tokens=2000,
            output_tokens=1000,
        )
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        agent_counter = meter._counters[period]["agent:agent-001"]
        assert agent_counter.model_breakdown[MODEL_FAST] == 1500
        assert agent_counter.model_breakdown[MODEL_DEEP] == 3000


class TestTokenMeterBudgetEnforcement:
    @pytest.mark.asyncio
    async def test_budget_ok_when_within_limits(self) -> None:
        meter = TokenMeter()
        result = await meter.check_budget(org_id="org-001", agent_id="agent-001")
        assert result is True

    @pytest.mark.asyncio
    async def test_budget_exceeded_at_org_level(self) -> None:
        meter = TokenMeter()
        meter.set_org_budget("org-001", 1000)  # Very low budget
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=800,
            output_tokens=300,
        )
        result = await meter.check_budget(org_id="org-001", agent_id="agent-001")
        assert result is False

    @pytest.mark.asyncio
    async def test_budget_exceeded_at_agent_level(self) -> None:
        meter = TokenMeter()
        meter.set_agent_budget("agent-001", 500)  # Very low budget
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=400,
            output_tokens=200,
        )
        result = await meter.check_budget(org_id="org-001", agent_id="agent-001")
        assert result is False

    @pytest.mark.asyncio
    async def test_default_budgets_are_generous(self) -> None:
        meter = TokenMeter()
        # Record a modest amount of usage
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=10000,
            output_tokens=5000,
        )
        result = await meter.check_budget(org_id="org-001", agent_id="agent-001")
        assert result is True  # 15k << 500k agent default


class TestTokenMeterBudgetOverrides:
    def test_set_org_budget(self) -> None:
        meter = TokenMeter()
        meter.set_org_budget("org-001", 10_000_000)
        assert meter._org_budgets["org-001"] == 10_000_000

    def test_set_agent_budget(self) -> None:
        meter = TokenMeter()
        meter.set_agent_budget("agent-001", 1_000_000)
        assert meter._agent_budgets["agent-001"] == 1_000_000


class TestTokenMeterUsageQuery:
    @pytest.mark.asyncio
    async def test_get_usage_returns_org_summary(self) -> None:
        meter = TokenMeter()
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=1000,
            output_tokens=500,
        )
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-002",
            model=MODEL_DEEP,
            input_tokens=2000,
            output_tokens=1000,
        )
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        usage = await meter.get_usage("org-001", period)
        assert usage.org_id == "org-001"
        assert usage.total_tokens == 4500
        assert usage.total_requests == 2
        assert len(usage.agent_usage) == 2

    @pytest.mark.asyncio
    async def test_get_usage_empty_period(self) -> None:
        meter = TokenMeter()
        usage = await meter.get_usage("org-001", "2020-01-01")
        assert usage.total_tokens == 0
        assert usage.total_requests == 0
        assert len(usage.agent_usage) == 0

    @pytest.mark.asyncio
    async def test_budget_used_pct_calculation(self) -> None:
        meter = TokenMeter()
        meter.set_org_budget("org-001", 10000)
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=2500,
            output_tokens=2500,
        )
        period = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        usage = await meter.get_usage("org-001", period)
        assert usage.budget_used_pct == 50.0


class TestTokenMeterResetCounters:
    @pytest.mark.asyncio
    async def test_reset_clears_stale_periods(self) -> None:
        meter = TokenMeter()
        # Manually add a counter for a past period
        meter._counters["2020-01-01"]["org:org-001"]
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=100,
            output_tokens=50,
        )
        meter.reset_daily_counters()
        assert "2020-01-01" not in meter._counters
        # Today's counter should still exist
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert today in meter._counters

    def test_reset_clears_fired_alerts(self) -> None:
        meter = TokenMeter()
        meter._fired_alerts.add(("org-001", None, 0.50))
        meter._fired_alerts.add(("org-001", "agent-001", 0.80))
        meter.reset_daily_counters()
        assert len(meter._fired_alerts) == 0


class TestTokenMeterAlerts:
    @pytest.mark.asyncio
    async def test_fires_alert_at_50_percent(self) -> None:
        meter = TokenMeter()
        meter.set_org_budget("org-001", 1000)
        alerts_emitted = []

        async def mock_emit_alert(alert):
            alerts_emitted.append(alert)

        meter._emit_alert = mock_emit_alert

        # Record 600 tokens = 60% of 1000 budget
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=400,
            output_tokens=200,
        )
        assert len(alerts_emitted) >= 1
        assert alerts_emitted[0].threshold_pct == 50.0

    @pytest.mark.asyncio
    async def test_does_not_re_fire_same_threshold(self) -> None:
        meter = TokenMeter()
        meter.set_org_budget("org-001", 1000)
        alerts_emitted = []

        async def mock_emit_alert(alert):
            alerts_emitted.append(alert)

        meter._emit_alert = mock_emit_alert

        # Record twice, crossing 50% both times
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=300,
            output_tokens=200,
        )
        count_after_first = len(alerts_emitted)
        await meter.record_usage(
            org_id="org-001",
            agent_id="agent-001",
            model=MODEL_FAST,
            input_tokens=50,
            output_tokens=50,
        )
        # Should not fire 50% threshold again
        org_50_alerts = [
            a for a in alerts_emitted
            if a.threshold_pct == 50.0 and a.agent_id is None
        ]
        assert len(org_50_alerts) == 1

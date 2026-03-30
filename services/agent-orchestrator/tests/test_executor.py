"""Tests for AgentExecutor and SafetyController."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models import (
    ActionBudget,
    Agent,
    AgentAction,
    AgentActionType,
    AgentCapability,
    AgentExecutionRequest,
    AgentType,
    Artifact,
    ArtifactType,
    BatchExecuteRequest,
    CaptureMethod,
    FeatureBundle,
    ArtifactMetadata,
    SensitivityLevel,
    TriggerEvent,
    TriggerType,
)
from src.safety import GateResult, RollbackRecord, SafetyConfig, SafetyController


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------


def make_agent(**overrides) -> Agent:
    defaults = dict(
        id="agent-001",
        org_id="org-001",
        name="Test Agent",
        type=AgentType.PERSONAL,
        description="A test agent",
        owner_id="user-001",
        owner_type="user",
        read_scope={},
        write_scope={},
        action_budget=None,
        triggers=[],
        capabilities=[
            AgentCapability.READ_ARTIFACTS,
            AgentCapability.FORK_ARTIFACTS,
            AgentCapability.OPEN_PRS,
        ],
        status="active",
    )
    defaults.update(overrides)
    return Agent(**defaults)


def make_trigger(**overrides) -> TriggerEvent:
    defaults = dict(
        trigger_type=TriggerType.ARTIFACT_COMMITTED,
        agent_id="agent-001",
        org_id="org-001",
        artifact_id="art-001",
        artifact_ids=[],
        payload={},
        timestamp=datetime.now(timezone.utc),
        source="test",
        chain_depth=0,
    )
    defaults.update(overrides)
    return TriggerEvent(**defaults)


def make_action(**overrides) -> AgentAction:
    defaults = dict(
        action=AgentActionType.FORK,
        confidence=0.85,
        justification="Updating stale references",
        target_artifact_id="art-001",
    )
    defaults.update(overrides)
    return AgentAction(**defaults)


def make_artifact(**overrides) -> Artifact:
    now = datetime.now(timezone.utc)
    defaults = dict(
        id="art-001",
        ledger_id="ledger-001",
        org_id="org-001",
        type=ArtifactType.DOCUMENT_GDOC,
        title="Test Document",
        source_app="chrome:gdocs",
        mime_type="text/plain",
        capture_method=CaptureMethod.CHROME_DOM,
        content_hash="abc123",
        feature_bundle=FeatureBundle(),
        metadata=ArtifactMetadata(),
        sensitivity=SensitivityLevel.INTERNAL,
        author_id="user-001",
        owner_ids=["user-001"],
        team_ids=["team-001"],
        captured_at=now,
        modified_at=now,
        committed_at=now,
    )
    defaults.update(overrides)
    return Artifact(**defaults)


def make_execution_request(**overrides) -> AgentExecutionRequest:
    agent = overrides.pop("agent", make_agent())
    trigger = overrides.pop("trigger", make_trigger())
    defaults = dict(
        request_id="req-001",
        trigger_event=trigger,
        agent=agent,
    )
    defaults.update(overrides)
    return AgentExecutionRequest(**defaults)


# ---------------------------------------------------------------------------
# SafetyController tests
# ---------------------------------------------------------------------------


class TestSafetyControllerRateLimiting:
    def test_allows_action_within_limits(self) -> None:
        controller = SafetyController()
        result = controller._check_rate_limits("org-001", "agent-001", AgentActionType.FORK)
        assert result.allowed is True

    def test_blocks_when_org_actions_per_minute_exceeded(self) -> None:
        config = SafetyConfig(max_agent_actions_per_minute=2)
        controller = SafetyController(config=config)
        # Record 2 actions
        controller._org_action_counters["org-001"].record()
        controller._org_action_counters["org-001"].record()
        result = controller._check_rate_limits("org-001", "agent-001", AgentActionType.FORK)
        assert result.allowed is False
        assert "actions/min" in result.reason

    def test_blocks_when_forks_per_hour_exceeded(self) -> None:
        config = SafetyConfig(max_forks_per_agent_per_hour=1)
        controller = SafetyController(config=config)
        controller._agent_fork_counters["agent-001"].record()
        result = controller._check_rate_limits("org-001", "agent-001", AgentActionType.FORK)
        assert result.allowed is False
        assert "forks/hour" in result.reason

    def test_blocks_when_prs_per_day_exceeded(self) -> None:
        config = SafetyConfig(max_prs_per_agent_per_day=1)
        controller = SafetyController(config=config)
        controller._agent_pr_counters["agent-001"].record()
        result = controller._check_rate_limits("org-001", "agent-001", AgentActionType.PR)
        assert result.allowed is False
        assert "PRs/day" in result.reason

    def test_record_action_taken_increments_counters(self) -> None:
        controller = SafetyController()
        controller.record_action_taken("org-001", "agent-001", AgentActionType.FORK)
        assert controller._org_action_counters["org-001"].count() == 1
        assert controller._agent_fork_counters["agent-001"].count() == 1

    def test_pr_limit_does_not_affect_fork_check(self) -> None:
        config = SafetyConfig(max_prs_per_agent_per_day=1)
        controller = SafetyController(config=config)
        controller._agent_pr_counters["agent-001"].record()
        # FORK action should not be blocked by PR limit
        result = controller._check_rate_limits("org-001", "agent-001", AgentActionType.FORK)
        assert result.allowed is True


class TestSafetyControllerCircuitBreaker:
    def test_allows_when_circuit_breaker_closed(self) -> None:
        controller = SafetyController()
        result = controller._check_circuit_breaker("agent-001")
        assert result.allowed is True

    def test_blocks_paused_agent(self) -> None:
        controller = SafetyController()
        controller.pause_agent("agent-001")
        result = controller._check_circuit_breaker("agent-001")
        assert result.allowed is False
        assert "paused" in result.reason

    def test_opens_circuit_on_high_error_rate(self) -> None:
        config = SafetyConfig(
            error_rate_threshold=0.10,
            min_samples_for_breaker=5,
        )
        controller = SafetyController(config=config)
        # Record 5 outcomes, 1 error = 20% > 10%
        for _ in range(4):
            controller.record_outcome("agent-001")
        controller.record_outcome("agent-001", is_error=True)
        assert controller.is_agent_paused("agent-001") is True

    def test_does_not_open_circuit_below_min_samples(self) -> None:
        config = SafetyConfig(
            error_rate_threshold=0.10,
            min_samples_for_breaker=10,
        )
        controller = SafetyController(config=config)
        # 5 errors out of 5 total, but below min_samples
        for _ in range(5):
            controller.record_outcome("agent-001", is_error=True)
        assert controller.is_agent_paused("agent-001") is False

    def test_opens_circuit_on_high_rejection_rate(self) -> None:
        config = SafetyConfig(
            rejection_rate_threshold=0.50,
            min_samples_for_breaker=4,
        )
        controller = SafetyController(config=config)
        for _ in range(2):
            controller.record_outcome("agent-001")
        for _ in range(2):
            controller.record_outcome("agent-001", is_rejection=True)
        assert controller.is_agent_paused("agent-001") is True

    def test_resume_agent_clears_circuit_breaker(self) -> None:
        controller = SafetyController()
        controller.pause_agent("agent-001")
        assert controller.is_agent_paused("agent-001") is True
        controller.resume_agent("agent-001")
        assert controller.is_agent_paused("agent-001") is False


class TestSafetyControllerCascade:
    def test_allows_when_below_max_chain_depth(self) -> None:
        config = SafetyConfig(max_chain_depth=3)
        controller = SafetyController(config=config)
        trigger = make_trigger(chain_depth=2)
        result = controller._check_cascade(trigger)
        assert result.allowed is True

    def test_blocks_when_at_max_chain_depth(self) -> None:
        config = SafetyConfig(max_chain_depth=3)
        controller = SafetyController(config=config)
        trigger = make_trigger(chain_depth=3)
        result = controller._check_cascade(trigger)
        assert result.allowed is False
        assert "Chain depth" in result.reason

    def test_blocks_when_exceeding_max_chain_depth(self) -> None:
        config = SafetyConfig(max_chain_depth=3)
        controller = SafetyController(config=config)
        trigger = make_trigger(chain_depth=5)
        result = controller._check_cascade(trigger)
        assert result.allowed is False


class TestSafetyControllerHumanReview:
    def test_requires_review_for_low_confidence(self) -> None:
        config = SafetyConfig(min_confidence_auto=0.7)
        controller = SafetyController(config=config)
        agent = make_agent()
        action = make_action(confidence=0.5)
        result = controller._check_human_review_required(agent, action)
        assert result is True

    def test_requires_review_for_confidential_artifacts(self) -> None:
        controller = SafetyController()
        agent = make_agent()
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(
            agent, action, artifact_sensitivity=SensitivityLevel.CONFIDENTIAL
        )
        assert result is True

    def test_requires_review_for_restricted_artifacts(self) -> None:
        controller = SafetyController()
        agent = make_agent()
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(
            agent, action, artifact_sensitivity=SensitivityLevel.RESTRICTED
        )
        assert result is True

    def test_requires_review_for_customer_facing(self) -> None:
        controller = SafetyController()
        agent = make_agent()
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(
            agent, action, artifact_customer_facing=True
        )
        assert result is True

    def test_requires_review_for_large_diffs(self) -> None:
        config = SafetyConfig(max_auto_diff_lines=50)
        controller = SafetyController(config=config)
        agent = make_agent()
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(
            agent, action, diff_changed_lines=100
        )
        assert result is True

    def test_requires_review_for_org_agents(self) -> None:
        controller = SafetyController()
        agent = make_agent(type=AgentType.ORG)
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(agent, action)
        assert result is True

    def test_no_review_for_high_confidence_safe_action(self) -> None:
        controller = SafetyController()
        agent = make_agent(type=AgentType.PERSONAL)
        action = make_action(confidence=0.95)
        result = controller._check_human_review_required(
            agent,
            action,
            artifact_sensitivity=SensitivityLevel.INTERNAL,
            artifact_customer_facing=False,
            diff_changed_lines=10,
        )
        assert result is False


class TestSafetyControllerBudget:
    def test_allows_when_no_budget(self) -> None:
        agent = make_agent(action_budget=None)
        action = make_action(confidence=0.5)
        result = SafetyController._check_budget(agent, action)
        assert result.allowed is True

    def test_requires_review_below_approval_threshold(self) -> None:
        budget = ActionBudget(require_approval_above=0.8)
        agent = make_agent(action_budget=budget)
        action = make_action(confidence=0.6)
        result = SafetyController._check_budget(agent, action)
        assert result.allowed is True
        assert result.requires_human_review is True

    def test_allows_above_approval_threshold(self) -> None:
        budget = ActionBudget(require_approval_above=0.8)
        agent = make_agent(action_budget=budget)
        action = make_action(confidence=0.9)
        result = SafetyController._check_budget(agent, action)
        assert result.allowed is True
        assert result.requires_human_review is False


class TestSafetyControllerScope:
    def test_allows_when_no_target(self) -> None:
        agent = make_agent()
        result = SafetyController._check_scope(agent, None)
        assert result.allowed is True

    def test_blocks_when_write_scope_disabled(self) -> None:
        agent = make_agent(write_scope={"disabled": True})
        result = SafetyController._check_scope(agent, "art-001")
        assert result.allowed is False
        assert "disabled" in result.reason

    def test_allows_normal_write_scope(self) -> None:
        agent = make_agent(write_scope={"team_ids": ["team-001"]})
        result = SafetyController._check_scope(agent, "art-001")
        assert result.allowed is True


class TestSafetyControllerCompositeGate:
    def test_composite_gate_allows_safe_action(self) -> None:
        controller = SafetyController()
        agent = make_agent(type=AgentType.PERSONAL)
        action = make_action(confidence=0.9, action=AgentActionType.FORK)
        trigger = make_trigger(chain_depth=0)
        result = controller.evaluate_gate(
            agent=agent,
            action=action,
            trigger=trigger,
            artifact_sensitivity=SensitivityLevel.INTERNAL,
            artifact_customer_facing=False,
            diff_changed_lines=5,
        )
        assert result.allowed is True
        assert result.requires_human_review is False

    def test_composite_gate_blocks_paused_agent(self) -> None:
        controller = SafetyController()
        controller.pause_agent("agent-001")
        agent = make_agent(id="agent-001")
        action = make_action()
        trigger = make_trigger()
        result = controller.evaluate_gate(
            agent=agent, action=action, trigger=trigger,
        )
        assert result.allowed is False

    def test_composite_gate_blocks_cascade(self) -> None:
        config = SafetyConfig(max_chain_depth=2)
        controller = SafetyController(config=config)
        agent = make_agent()
        action = make_action()
        trigger = make_trigger(chain_depth=3)
        result = controller.evaluate_gate(
            agent=agent, action=action, trigger=trigger,
        )
        assert result.allowed is False
        assert "Chain depth" in result.reason

    def test_composite_gate_requires_human_review(self) -> None:
        controller = SafetyController()
        agent = make_agent(type=AgentType.ORG)
        action = make_action(confidence=0.95)
        trigger = make_trigger()
        result = controller.evaluate_gate(
            agent=agent, action=action, trigger=trigger,
        )
        assert result.allowed is True
        assert result.requires_human_review is True


class TestSafetyControllerRollback:
    def test_register_auto_merge(self) -> None:
        controller = SafetyController()
        controller.register_auto_merge("pr-001", "agent-001", "org-001")
        assert len(controller._rollback_records) == 1
        assert controller._rollback_records[0].pr_id == "pr-001"

    def test_request_rollback_within_window(self) -> None:
        controller = SafetyController()
        controller.register_auto_merge("pr-001", "agent-001", "org-001")
        result = controller.request_rollback("pr-001")
        assert result is True
        assert controller._rollback_records[0].rolled_back is True

    def test_request_rollback_unknown_pr(self) -> None:
        controller = SafetyController()
        result = controller.request_rollback("pr-nonexistent")
        assert result is False

    def test_request_rollback_already_rolled_back(self) -> None:
        controller = SafetyController()
        controller.register_auto_merge("pr-001", "agent-001", "org-001")
        controller.request_rollback("pr-001")
        # Second rollback should find it already rolled back
        result = controller.request_rollback("pr-001")
        assert result is False


# ---------------------------------------------------------------------------
# AgentExecutor tests
# ---------------------------------------------------------------------------


class TestAgentExecutorParseAction:
    def test_parses_valid_json(self) -> None:
        from src.agent_executor import AgentExecutor

        json_str = '{"action": "fork", "confidence": 0.9, "justification": "test"}'
        action = AgentExecutor._parse_action(json_str)
        assert action.action == AgentActionType.FORK
        assert action.confidence == 0.9

    def test_strips_markdown_fences(self) -> None:
        from src.agent_executor import AgentExecutor

        json_str = '```json\n{"action": "skip", "confidence": 0.1, "justification": "no action"}\n```'
        action = AgentExecutor._parse_action(json_str)
        assert action.action == AgentActionType.SKIP

    def test_returns_skip_on_invalid_json(self) -> None:
        from src.agent_executor import AgentExecutor

        action = AgentExecutor._parse_action("this is not json")
        assert action.action == AgentActionType.SKIP
        assert action.confidence == 0.0
        assert "Failed to parse" in action.justification

    def test_parses_all_action_types(self) -> None:
        from src.agent_executor import AgentExecutor

        for action_type in ["fork", "pr", "synthesize", "notify", "skip"]:
            json_str = f'{{"action": "{action_type}", "confidence": 0.5, "justification": "test"}}'
            action = AgentExecutor._parse_action(json_str)
            assert action.action.value == action_type


class TestAgentExecutorInferTaskType:
    def test_org_agent_returns_deep_analysis(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.ORG)
        trigger = make_trigger()
        assert AgentExecutor._infer_task_type(agent, trigger) == "deep_analysis"

    def test_function_agent_returns_deep_analysis(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.FUNCTION)
        trigger = make_trigger()
        assert AgentExecutor._infer_task_type(agent, trigger) == "deep_analysis"

    def test_meeting_ended_trigger(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.VOICE)
        trigger = make_trigger(trigger_type=TriggerType.MEETING_ENDED)
        assert AgentExecutor._infer_task_type(agent, trigger) == "meeting_summary"

    def test_customer_event_trigger(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.PERSONAL)
        trigger = make_trigger(trigger_type=TriggerType.CUSTOMER_EVENT)
        assert AgentExecutor._infer_task_type(agent, trigger) == "customer_health"

    def test_conflict_detected_trigger(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.TEAM)
        trigger = make_trigger(trigger_type=TriggerType.CONFLICT_DETECTED)
        assert AgentExecutor._infer_task_type(agent, trigger) == "conflict_detection"

    def test_calendar_event_trigger(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.CALENDAR)
        trigger = make_trigger(trigger_type=TriggerType.CALENDAR_EVENT)
        assert AgentExecutor._infer_task_type(agent, trigger) == "calendar_review"

    def test_migration_batch_trigger(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.MIGRATION)
        trigger = make_trigger(trigger_type=TriggerType.MIGRATION_BATCH)
        assert AgentExecutor._infer_task_type(agent, trigger) == "migration_classify"

    def test_default_returns_artifact_analysis(self) -> None:
        from src.agent_executor import AgentExecutor

        agent = make_agent(type=AgentType.PERSONAL)
        trigger = make_trigger(trigger_type=TriggerType.ARTIFACT_COMMITTED)
        assert AgentExecutor._infer_task_type(agent, trigger) == "artifact_analysis"


class TestAgentExecutorExecution:
    @pytest.mark.asyncio
    async def test_execute_returns_error_for_missing_agent(self) -> None:
        from src.agent_executor import AgentExecutor

        mock_llm = MagicMock()
        safety = SafetyController()
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        trigger = make_trigger(agent_id="missing-agent")
        request = AgentExecutionRequest(
            request_id="req-001",
            trigger_event=trigger,
            agent=None,
        )

        # Mock _load_agent to return None
        executor._load_agent = AsyncMock(return_value=None)

        result = await executor.execute(request)
        assert result.error is not None
        assert "not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_returns_error_for_inactive_agent(self) -> None:
        from src.agent_executor import AgentExecutor

        mock_llm = MagicMock()
        safety = SafetyController()
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        agent = make_agent(status="inactive")
        request = make_execution_request(agent=agent)
        result = await executor.execute(request)
        assert result.error is not None
        assert "inactive" in result.error

    @pytest.mark.asyncio
    async def test_execute_returns_error_for_paused_agent(self) -> None:
        from src.agent_executor import AgentExecutor

        mock_llm = MagicMock()
        safety = SafetyController()
        safety.pause_agent("agent-001")
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        agent = make_agent(id="agent-001")
        request = make_execution_request(agent=agent)
        result = await executor.execute(request)
        assert result.gated is True
        assert "paused" in result.error

    @pytest.mark.asyncio
    async def test_execute_skip_action_produces_no_artifacts(self) -> None:
        from src.agent_executor import AgentExecutor

        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value={
            "content": '{"action": "skip", "confidence": 0.3, "justification": "No changes needed"}',
            "input_tokens": 100,
            "output_tokens": 50,
        })
        safety = SafetyController()
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        # Mock scope and context
        executor._resolve_scope = AsyncMock(return_value=["art-001"])
        executor._load_context = AsyncMock(return_value=[make_artifact()])
        executor._audit = AsyncMock()
        executor._notify_owner = AsyncMock()

        agent = make_agent()
        request = make_execution_request(agent=agent)
        result = await executor.execute(request)
        assert result.action_taken == AgentActionType.SKIP
        assert result.artifacts_created == 0
        assert result.prs_opened == 0
        assert result.error is None

    @pytest.mark.asyncio
    async def test_execute_gated_action_does_not_execute(self) -> None:
        from src.agent_executor import AgentExecutor

        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value={
            "content": '{"action": "fork", "confidence": 0.95, "justification": "Update needed", "target_artifact_id": "art-001"}',
            "input_tokens": 100,
            "output_tokens": 50,
        })
        config = SafetyConfig(max_chain_depth=1)
        safety = SafetyController(config=config)
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        executor._resolve_scope = AsyncMock(return_value=["art-001"])
        executor._load_context = AsyncMock(return_value=[make_artifact()])
        executor._audit = AsyncMock()
        executor._notify_owner = AsyncMock()

        agent = make_agent()
        trigger = make_trigger(chain_depth=2)
        request = make_execution_request(agent=agent, trigger=trigger)
        result = await executor.execute(request)
        assert result.gated is True
        assert result.artifacts_created == 0

    @pytest.mark.asyncio
    async def test_execute_records_outcome_on_llm_error(self) -> None:
        from src.agent_executor import AgentExecutor
        from src.llm_client import LLMClientError

        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(side_effect=LLMClientError("LLM down"))
        safety = SafetyController()
        executor = AgentExecutor(
            llm_client=mock_llm,
            safety=safety,
            api_gateway_url="http://localhost:8080",
        )

        executor._resolve_scope = AsyncMock(return_value=["art-001"])
        executor._load_context = AsyncMock(return_value=[make_artifact()])

        agent = make_agent()
        request = make_execution_request(agent=agent)
        result = await executor.execute(request)
        assert result.error is not None
        assert "LLM error" in result.error
        # Safety controller should have recorded the error
        state = safety._breakers["agent-001"]
        assert state.errors >= 1

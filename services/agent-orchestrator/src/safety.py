"""
Agent safety controls — PRD Section 5.4.

Implements:
- Rate limiting (max actions/min, forks/hour, PRs/day)
- Circuit breakers (error rate and rejection rate thresholds)
- Cascade protection (max chain depth 3)
- Human-in-the-loop trigger evaluation
- Rollback management for auto-merged PRs
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .models import (
    Agent,
    AgentAction,
    AgentActionType,
    AgentType,
    SensitivityLevel,
    TriggerEvent,
)

logger = logging.getLogger("agent-orchestrator.safety")


# ---------------------------------------------------------------------------
# Configuration (PRD Section 5.4 defaults)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SafetyConfig:
    # Global rate limits
    max_agent_actions_per_minute: int = 100
    max_forks_per_agent_per_hour: int = 20
    max_prs_per_agent_per_day: int = 50
    max_tokens_per_agent_per_day: int = 500_000

    # Circuit breakers
    error_rate_threshold: float = 0.10   # 10 %
    rejection_rate_threshold: float = 0.50  # 50 %
    circuit_breaker_window_seconds: int = 3600  # 1 hour
    min_samples_for_breaker: int = 10

    # Cascade protection
    max_chain_depth: int = 3

    # Human-in-the-loop thresholds
    min_confidence_auto: float = 0.7
    max_auto_diff_lines: int = 50

    # Rollback
    auto_rollback_window_hours: int = 24
    rollback_on_owner_reject: bool = True


# ---------------------------------------------------------------------------
# Sliding window counter
# ---------------------------------------------------------------------------

class _SlidingWindowCounter:
    """Simple in-memory sliding window rate counter."""

    def __init__(self, window_seconds: int) -> None:
        self._window = window_seconds
        self._events: list[float] = []

    def record(self) -> None:
        self._events.append(time.monotonic())

    def count(self) -> int:
        cutoff = time.monotonic() - self._window
        self._events = [t for t in self._events if t > cutoff]
        return len(self._events)


# ---------------------------------------------------------------------------
# Circuit breaker state
# ---------------------------------------------------------------------------

@dataclass
class _CircuitBreakerState:
    total: int = 0
    errors: int = 0
    rejections: int = 0
    is_open: bool = False
    opened_at: float | None = None
    window_start: float = field(default_factory=time.monotonic)

    def reset_window(self, now: float) -> None:
        self.total = 0
        self.errors = 0
        self.rejections = 0
        self.window_start = now


# ---------------------------------------------------------------------------
# Gate result
# ---------------------------------------------------------------------------

@dataclass
class GateResult:
    allowed: bool
    reason: str | None = None
    requires_human_review: bool = False


# ---------------------------------------------------------------------------
# Rollback record
# ---------------------------------------------------------------------------

@dataclass
class RollbackRecord:
    pr_id: str
    agent_id: str
    org_id: str
    merged_at: datetime
    rollback_deadline: datetime
    rolled_back: bool = False


# ---------------------------------------------------------------------------
# SafetyController
# ---------------------------------------------------------------------------

class SafetyController:
    """
    Central safety controller for agent execution.

    Provides rate limiting, circuit breakers, cascade protection,
    human-in-the-loop evaluation, and rollback tracking.
    """

    def __init__(self, config: SafetyConfig | None = None) -> None:
        self._config = config or SafetyConfig()

        # Rate limiters keyed by (org_id,) or (org_id, agent_id)
        self._org_action_counters: dict[str, _SlidingWindowCounter] = defaultdict(
            lambda: _SlidingWindowCounter(60)
        )
        self._agent_fork_counters: dict[str, _SlidingWindowCounter] = defaultdict(
            lambda: _SlidingWindowCounter(3600)
        )
        self._agent_pr_counters: dict[str, _SlidingWindowCounter] = defaultdict(
            lambda: _SlidingWindowCounter(86400)
        )

        # Circuit breakers keyed by agent_id
        self._breakers: dict[str, _CircuitBreakerState] = defaultdict(
            _CircuitBreakerState
        )

        # Rollback tracking
        self._rollback_records: list[RollbackRecord] = []

        # Paused agents (set by circuit breaker or admin)
        self._paused_agents: set[str] = set()

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    def _check_rate_limits(
        self,
        org_id: str,
        agent_id: str,
        action: AgentActionType,
    ) -> GateResult:
        # Org-wide actions per minute
        org_counter = self._org_action_counters[org_id]
        if org_counter.count() >= self._config.max_agent_actions_per_minute:
            return GateResult(
                allowed=False,
                reason=f"Org {org_id} exceeded {self._config.max_agent_actions_per_minute} actions/min",
            )

        # Per-agent fork limit
        if action == AgentActionType.FORK:
            fork_counter = self._agent_fork_counters[agent_id]
            if fork_counter.count() >= self._config.max_forks_per_agent_per_hour:
                return GateResult(
                    allowed=False,
                    reason=f"Agent {agent_id} exceeded {self._config.max_forks_per_agent_per_hour} forks/hour",
                )

        # Per-agent PR limit
        if action == AgentActionType.PR:
            pr_counter = self._agent_pr_counters[agent_id]
            if pr_counter.count() >= self._config.max_prs_per_agent_per_day:
                return GateResult(
                    allowed=False,
                    reason=f"Agent {agent_id} exceeded {self._config.max_prs_per_agent_per_day} PRs/day",
                )

        return GateResult(allowed=True)

    def _record_action(
        self,
        org_id: str,
        agent_id: str,
        action: AgentActionType,
    ) -> None:
        self._org_action_counters[org_id].record()
        if action == AgentActionType.FORK:
            self._agent_fork_counters[agent_id].record()
        if action == AgentActionType.PR:
            self._agent_pr_counters[agent_id].record()

    # ------------------------------------------------------------------
    # Circuit breakers
    # ------------------------------------------------------------------

    def _check_circuit_breaker(self, agent_id: str) -> GateResult:
        if agent_id in self._paused_agents:
            return GateResult(
                allowed=False,
                reason=f"Agent {agent_id} is paused by circuit breaker or admin",
            )

        state = self._breakers[agent_id]
        now = time.monotonic()

        # Reset window if expired
        if now - state.window_start > self._config.circuit_breaker_window_seconds:
            state.reset_window(now)

        if state.is_open:
            return GateResult(
                allowed=False,
                reason=f"Circuit breaker is open for agent {agent_id}",
            )

        return GateResult(allowed=True)

    def record_outcome(
        self,
        agent_id: str,
        *,
        is_error: bool = False,
        is_rejection: bool = False,
    ) -> None:
        """
        Record the outcome of an agent action for circuit breaker evaluation.
        """
        state = self._breakers[agent_id]
        now = time.monotonic()

        if now - state.window_start > self._config.circuit_breaker_window_seconds:
            state.reset_window(now)

        state.total += 1
        if is_error:
            state.errors += 1
        if is_rejection:
            state.rejections += 1

        if state.total < self._config.min_samples_for_breaker:
            return

        error_rate = state.errors / state.total
        rejection_rate = state.rejections / state.total

        if error_rate >= self._config.error_rate_threshold:
            logger.warning(
                "Circuit breaker OPEN for agent %s — error rate %.1f%% >= threshold %.1f%%",
                agent_id,
                error_rate * 100,
                self._config.error_rate_threshold * 100,
            )
            state.is_open = True
            state.opened_at = now
            self._paused_agents.add(agent_id)

        if rejection_rate >= self._config.rejection_rate_threshold:
            logger.warning(
                "Circuit breaker OPEN for agent %s — rejection rate %.1f%% >= threshold %.1f%%",
                agent_id,
                rejection_rate * 100,
                self._config.rejection_rate_threshold * 100,
            )
            state.is_open = True
            state.opened_at = now
            self._paused_agents.add(agent_id)

    # ------------------------------------------------------------------
    # Cascade protection
    # ------------------------------------------------------------------

    def _check_cascade(self, trigger: TriggerEvent) -> GateResult:
        if trigger.chain_depth >= self._config.max_chain_depth:
            return GateResult(
                allowed=False,
                reason=(
                    f"Chain depth {trigger.chain_depth} exceeds max "
                    f"{self._config.max_chain_depth}"
                ),
            )
        return GateResult(allowed=True)

    # ------------------------------------------------------------------
    # Human-in-the-loop evaluation (PRD Section 5.4)
    # ------------------------------------------------------------------

    def _check_human_review_required(
        self,
        agent: Agent,
        action: AgentAction,
        artifact_sensitivity: SensitivityLevel | None = None,
        artifact_customer_facing: bool = False,
        diff_changed_lines: int = 0,
    ) -> bool:
        """
        Return True if the action requires human review before execution.

        PRD 5.4 requireHumanReviewWhen:
          - confidence < 0.7
          - artifact.sensitivity >= confidential
          - artifact.customerFacing == true
          - diff.changedLines > 50
          - agent.type == org
        """
        if action.confidence < self._config.min_confidence_auto:
            return True

        if artifact_sensitivity in (
            SensitivityLevel.CONFIDENTIAL,
            SensitivityLevel.RESTRICTED,
        ):
            return True

        if artifact_customer_facing:
            return True

        if diff_changed_lines > self._config.max_auto_diff_lines:
            return True

        if agent.type == AgentType.ORG:
            return True

        return False

    # ------------------------------------------------------------------
    # Budget check (delegates to agent.action_budget)
    # ------------------------------------------------------------------

    @staticmethod
    def _check_budget(agent: Agent, action: AgentAction) -> GateResult:
        budget = agent.action_budget
        if budget is None:
            return GateResult(allowed=True)

        if action.confidence < budget.require_approval_above:
            return GateResult(
                allowed=True,
                requires_human_review=True,
                reason=(
                    f"Confidence {action.confidence:.2f} below agent threshold "
                    f"{budget.require_approval_above:.2f}"
                ),
            )

        return GateResult(allowed=True)

    # ------------------------------------------------------------------
    # Scope check — ensure agent can write to the target artifact
    # ------------------------------------------------------------------

    @staticmethod
    def _check_scope(agent: Agent, target_artifact_id: str | None) -> GateResult:
        """
        Verify the target artifact falls within the agent's write scope.

        In production this would query the ACL resolver. Here we verify the
        agent has the right capabilities.
        """
        if target_artifact_id is None:
            return GateResult(allowed=True)

        # Capability check — simplified; full ACL resolution is in api-gateway
        write_scope = agent.write_scope or {}
        if write_scope.get("disabled"):
            return GateResult(
                allowed=False,
                reason="Agent write scope is disabled",
            )

        return GateResult(allowed=True)

    # ------------------------------------------------------------------
    # Composite gate (PRD Step 6)
    # ------------------------------------------------------------------

    def evaluate_gate(
        self,
        *,
        agent: Agent,
        action: AgentAction,
        trigger: TriggerEvent,
        artifact_sensitivity: SensitivityLevel | None = None,
        artifact_customer_facing: bool = False,
        diff_changed_lines: int = 0,
    ) -> GateResult:
        """
        Run all safety checks for Step 6 (GATE) of the execution loop.

        Returns a GateResult that tells the executor whether to proceed.
        """
        # 1. Circuit breaker
        cb = self._check_circuit_breaker(agent.id)
        if not cb.allowed:
            return cb

        # 2. Cascade protection
        cascade = self._check_cascade(trigger)
        if not cascade.allowed:
            return cascade

        # 3. Rate limits
        rl = self._check_rate_limits(
            trigger.org_id,
            agent.id,
            action.action,
        )
        if not rl.allowed:
            return rl

        # 4. Budget
        budget = self._check_budget(agent, action)
        if not budget.allowed:
            return budget

        # 5. Scope
        scope = self._check_scope(agent, action.target_artifact_id)
        if not scope.allowed:
            return scope

        # 6. Human-in-the-loop
        requires_human = self._check_human_review_required(
            agent,
            action,
            artifact_sensitivity=artifact_sensitivity,
            artifact_customer_facing=artifact_customer_facing,
            diff_changed_lines=diff_changed_lines,
        )

        if requires_human or budget.requires_human_review:
            return GateResult(
                allowed=True,
                requires_human_review=True,
                reason="Action requires human review before merge",
            )

        # All checks passed
        return GateResult(allowed=True)

    def record_action_taken(
        self,
        org_id: str,
        agent_id: str,
        action: AgentActionType,
    ) -> None:
        """Record that an action was taken (for rate-limit bookkeeping)."""
        self._record_action(org_id, agent_id, action)

    # ------------------------------------------------------------------
    # Rollback management
    # ------------------------------------------------------------------

    def register_auto_merge(
        self,
        pr_id: str,
        agent_id: str,
        org_id: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        deadline = now + timedelta(hours=self._config.auto_rollback_window_hours)
        self._rollback_records.append(
            RollbackRecord(
                pr_id=pr_id,
                agent_id=agent_id,
                org_id=org_id,
                merged_at=now,
                rollback_deadline=deadline,
            )
        )
        logger.info(
            "Registered auto-merge for PR %s — rollback window until %s",
            pr_id,
            deadline.isoformat(),
        )

    def request_rollback(self, pr_id: str) -> bool:
        """
        Attempt to roll back an auto-merged PR. Returns True if within
        the rollback window and rollback was marked.
        """
        now = datetime.now(timezone.utc)
        for record in self._rollback_records:
            if record.pr_id == pr_id and not record.rolled_back:
                if now <= record.rollback_deadline:
                    record.rolled_back = True
                    logger.info("Rollback requested and approved for PR %s", pr_id)
                    return True
                logger.warning(
                    "Rollback for PR %s denied — past deadline %s",
                    pr_id,
                    record.rollback_deadline.isoformat(),
                )
                return False
        logger.warning("No auto-merge record found for PR %s", pr_id)
        return False

    # ------------------------------------------------------------------
    # Admin controls
    # ------------------------------------------------------------------

    def pause_agent(self, agent_id: str) -> None:
        self._paused_agents.add(agent_id)
        logger.info("Agent %s paused by admin", agent_id)

    def resume_agent(self, agent_id: str) -> None:
        self._paused_agents.discard(agent_id)
        state = self._breakers.get(agent_id)
        if state is not None:
            state.is_open = False
            state.opened_at = None
            state.reset_window(time.monotonic())
        logger.info("Agent %s resumed by admin", agent_id)

    def is_agent_paused(self, agent_id: str) -> bool:
        return agent_id in self._paused_agents

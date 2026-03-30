"""
Token metering and budget tracking — PRD Section 5.2.

Responsibilities:
- Track input/output tokens per agent and per org
- Enforce daily token budgets
- Alert at 50%, 80%, 95% thresholds
- Persist usage data to Firestore
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from .models import BudgetAlert, UsageRecord, UsageResponse

logger = logging.getLogger("llm-gateway.metering")

# Default daily token budget per org (can be overridden in Firestore config)
DEFAULT_ORG_DAILY_BUDGET = 5_000_000
DEFAULT_AGENT_DAILY_BUDGET = 500_000

# Alert thresholds (PRD: 50%, 80%, 95%)
ALERT_THRESHOLDS = [0.50, 0.80, 0.95]


class TokenMeter:
    """
    Tracks token usage per agent and per org, enforces budgets, and
    emits alerts when thresholds are crossed.

    Uses Firestore for durable storage and in-memory counters for
    fast hot-path checks.
    """

    def __init__(self, firestore_project: str | None = None) -> None:
        self._firestore_project = firestore_project
        self._db = None  # Lazy initialisation

        # In-memory counters: {period: {entity_id: UsageCounter}}
        # period is YYYY-MM-DD
        self._counters: dict[str, dict[str, _UsageCounter]] = defaultdict(
            lambda: defaultdict(_UsageCounter)
        )

        # Track which alert thresholds have been fired to avoid duplicates
        # Key: (org_id, agent_id_or_None, threshold)
        self._fired_alerts: set[tuple[str, str | None, float]] = set()

        # Budget overrides loaded from Firestore
        self._org_budgets: dict[str, int] = {}
        self._agent_budgets: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Firestore
    # ------------------------------------------------------------------

    def _get_db(self):
        if self._db is None:
            try:
                from google.cloud import firestore
                self._db = firestore.AsyncClient(project=self._firestore_project)
            except Exception:
                logger.warning("Firestore not available; metering is in-memory only")
        return self._db

    # ------------------------------------------------------------------
    # Record usage
    # ------------------------------------------------------------------

    async def record_usage(
        self,
        *,
        org_id: str,
        agent_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        """Record token usage for an agent call."""
        period = _today()

        # Update in-memory counters
        org_counter = self._counters[period][f"org:{org_id}"]
        org_counter.add(model, input_tokens, output_tokens)

        agent_counter = self._counters[period][f"agent:{agent_id}"]
        agent_counter.add(model, input_tokens, output_tokens)

        # Check alert thresholds
        await self._check_alerts(org_id, agent_id, period)

        # Persist to Firestore (fire-and-forget; do not block the hot path)
        await self._persist_usage(org_id, agent_id, model, input_tokens, output_tokens, period)

    # ------------------------------------------------------------------
    # Budget enforcement
    # ------------------------------------------------------------------

    async def check_budget(
        self,
        *,
        org_id: str,
        agent_id: str,
    ) -> bool:
        """
        Return True if the org/agent still has budget remaining.
        """
        period = _today()

        # Org budget
        org_budget = self._org_budgets.get(org_id, DEFAULT_ORG_DAILY_BUDGET)
        org_counter = self._counters[period].get(f"org:{org_id}")
        if org_counter and org_counter.total_tokens >= org_budget:
            logger.warning(
                "Org %s budget exhausted: %d / %d tokens",
                org_id,
                org_counter.total_tokens,
                org_budget,
            )
            return False

        # Agent budget
        agent_budget = self._agent_budgets.get(agent_id, DEFAULT_AGENT_DAILY_BUDGET)
        agent_counter = self._counters[period].get(f"agent:{agent_id}")
        if agent_counter and agent_counter.total_tokens >= agent_budget:
            logger.warning(
                "Agent %s budget exhausted: %d / %d tokens",
                agent_id,
                agent_counter.total_tokens,
                agent_budget,
            )
            return False

        return True

    # ------------------------------------------------------------------
    # Alerts
    # ------------------------------------------------------------------

    async def _check_alerts(
        self,
        org_id: str,
        agent_id: str,
        period: str,
    ) -> None:
        """Check if any alert thresholds have been crossed."""
        org_budget = self._org_budgets.get(org_id, DEFAULT_ORG_DAILY_BUDGET)
        org_counter = self._counters[period].get(f"org:{org_id}")
        if org_counter:
            pct = org_counter.total_tokens / org_budget if org_budget > 0 else 0
            for threshold in ALERT_THRESHOLDS:
                alert_key = (org_id, None, threshold)
                if pct >= threshold and alert_key not in self._fired_alerts:
                    self._fired_alerts.add(alert_key)
                    alert = BudgetAlert(
                        org_id=org_id,
                        agent_id=None,
                        threshold_pct=threshold * 100,
                        current_pct=pct * 100,
                        budget_limit=org_budget,
                        tokens_used=org_counter.total_tokens,
                        period=period,
                        timestamp=datetime.now(timezone.utc),
                    )
                    await self._emit_alert(alert)

        agent_budget = self._agent_budgets.get(agent_id, DEFAULT_AGENT_DAILY_BUDGET)
        agent_counter = self._counters[period].get(f"agent:{agent_id}")
        if agent_counter:
            pct = agent_counter.total_tokens / agent_budget if agent_budget > 0 else 0
            for threshold in ALERT_THRESHOLDS:
                alert_key = (org_id, agent_id, threshold)
                if pct >= threshold and alert_key not in self._fired_alerts:
                    self._fired_alerts.add(alert_key)
                    alert = BudgetAlert(
                        org_id=org_id,
                        agent_id=agent_id,
                        threshold_pct=threshold * 100,
                        current_pct=pct * 100,
                        budget_limit=agent_budget,
                        tokens_used=agent_counter.total_tokens,
                        period=period,
                        timestamp=datetime.now(timezone.utc),
                    )
                    await self._emit_alert(alert)

    async def _emit_alert(self, alert: BudgetAlert) -> None:
        """Emit a budget alert (log + persist)."""
        entity = f"agent {alert.agent_id}" if alert.agent_id else f"org {alert.org_id}"
        logger.warning(
            "BUDGET ALERT: %s at %.0f%% of budget (threshold: %.0f%%, used: %d / %d)",
            entity,
            alert.current_pct,
            alert.threshold_pct,
            alert.tokens_used,
            alert.budget_limit,
        )

        db = self._get_db()
        if db is not None:
            try:
                await db.collection("budget_alerts").add(alert.model_dump(mode="json"))
            except Exception:
                logger.exception("Failed to persist budget alert")

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _persist_usage(
        self,
        org_id: str,
        agent_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        period: str,
    ) -> None:
        """Persist usage record to Firestore."""
        db = self._get_db()
        if db is None:
            return

        try:
            doc_ref = (
                db.collection("token_usage")
                .document(f"{org_id}_{period}")
                .collection("agents")
                .document(agent_id)
            )

            from google.cloud.firestore import async_transactional, AsyncTransaction

            @async_transactional
            async def update_in_txn(txn: AsyncTransaction):
                doc = await txn.get(doc_ref)
                if doc.exists:
                    data = doc.to_dict()
                    txn.update(doc_ref, {
                        "input_tokens": data.get("input_tokens", 0) + input_tokens,
                        "output_tokens": data.get("output_tokens", 0) + output_tokens,
                        "total_tokens": data.get("total_tokens", 0) + input_tokens + output_tokens,
                        "request_count": data.get("request_count", 0) + 1,
                        f"model_breakdown.{model}": data.get("model_breakdown", {}).get(model, 0) + input_tokens + output_tokens,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })
                else:
                    txn.set(doc_ref, {
                        "org_id": org_id,
                        "agent_id": agent_id,
                        "period": period,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": input_tokens + output_tokens,
                        "request_count": 1,
                        "model_breakdown": {model: input_tokens + output_tokens},
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })

            txn = db.transaction()
            await update_in_txn(txn)

        except Exception:
            logger.exception("Failed to persist token usage to Firestore")

    # ------------------------------------------------------------------
    # Query usage
    # ------------------------------------------------------------------

    async def get_usage(self, org_id: str, period: str) -> UsageResponse:
        """
        Get aggregated usage for an org in a given period.
        """
        # Try in-memory first
        org_key = f"org:{org_id}"
        org_counter = self._counters.get(period, {}).get(org_key)

        total_input = 0
        total_output = 0
        total_requests = 0
        agent_records: list[UsageRecord] = []

        if org_counter:
            total_input = org_counter.input_tokens
            total_output = org_counter.output_tokens
            total_requests = org_counter.request_count

        # Collect per-agent usage
        period_counters = self._counters.get(period, {})
        for key, counter in period_counters.items():
            if key.startswith("agent:"):
                agent_id = key[6:]
                agent_records.append(UsageRecord(
                    entity_id=agent_id,
                    entity_type="agent",
                    input_tokens=counter.input_tokens,
                    output_tokens=counter.output_tokens,
                    total_tokens=counter.total_tokens,
                    request_count=counter.request_count,
                    period=period,
                    model_breakdown=dict(counter.model_breakdown),
                ))

        # Try Firestore for richer data if in-memory is empty
        if not org_counter:
            db = self._get_db()
            if db is not None:
                try:
                    docs = db.collection("token_usage").document(
                        f"{org_id}_{period}"
                    ).collection("agents").stream()
                    async for doc in docs:
                        data = doc.to_dict()
                        total_input += data.get("input_tokens", 0)
                        total_output += data.get("output_tokens", 0)
                        total_requests += data.get("request_count", 0)
                        agent_records.append(UsageRecord(
                            entity_id=data.get("agent_id", doc.id),
                            entity_type="agent",
                            input_tokens=data.get("input_tokens", 0),
                            output_tokens=data.get("output_tokens", 0),
                            total_tokens=data.get("total_tokens", 0),
                            request_count=data.get("request_count", 0),
                            period=period,
                            model_breakdown=data.get("model_breakdown", {}),
                        ))
                except Exception:
                    logger.exception("Failed to query Firestore for usage")

        org_budget = self._org_budgets.get(org_id, DEFAULT_ORG_DAILY_BUDGET)
        total_tokens = total_input + total_output
        budget_pct = (total_tokens / org_budget * 100) if org_budget > 0 else 0

        return UsageResponse(
            org_id=org_id,
            period=period,
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_tokens=total_tokens,
            total_requests=total_requests,
            budget_limit=org_budget,
            budget_used_pct=round(budget_pct, 2),
            agent_usage=agent_records,
        )

    # ------------------------------------------------------------------
    # Budget configuration
    # ------------------------------------------------------------------

    def set_org_budget(self, org_id: str, daily_tokens: int) -> None:
        """Override the daily token budget for an org."""
        self._org_budgets[org_id] = daily_tokens
        logger.info("Org %s daily budget set to %d tokens", org_id, daily_tokens)

    def set_agent_budget(self, agent_id: str, daily_tokens: int) -> None:
        """Override the daily token budget for an agent."""
        self._agent_budgets[agent_id] = daily_tokens
        logger.info("Agent %s daily budget set to %d tokens", agent_id, daily_tokens)

    def reset_daily_counters(self) -> None:
        """
        Clear in-memory counters for previous periods.
        Call this from a daily cron or at startup.
        """
        today = _today()
        stale = [p for p in self._counters if p != today]
        for period in stale:
            del self._counters[period]
        self._fired_alerts = {
            (o, a, t) for (o, a, t) in self._fired_alerts
            # Keep alerts only for today (we cannot filter by period here,
            # so we clear all; they'll re-fire if needed)
        }
        self._fired_alerts.clear()
        logger.info("Cleared stale metering counters for %d periods", len(stale))


# ---------------------------------------------------------------------------
# Internal counter
# ---------------------------------------------------------------------------

class _UsageCounter:
    """In-memory token counter for a single entity in a single period."""

    __slots__ = (
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "request_count",
        "model_breakdown",
    )

    def __init__(self) -> None:
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0
        self.request_count = 0
        self.model_breakdown: dict[str, int] = defaultdict(int)

    def add(self, model: str, input_tokens: int, output_tokens: int) -> None:
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        total = input_tokens + output_tokens
        self.total_tokens += total
        self.request_count += 1
        self.model_breakdown[model] += total


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today() -> str:
    """Return today's date as YYYY-MM-DD in UTC."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

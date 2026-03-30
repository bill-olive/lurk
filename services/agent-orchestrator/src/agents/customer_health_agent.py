"""
Customer health agent — PRD Section 6.7.

Scope:  All customer-facing artifacts across the org (redacted per policy).
Model:  Opus 4.6 (complex multi-source reasoning).
Purpose: Synthesise all customer touchpoints into health scores.

Pipeline:
1. Agent runs on schedule (daily) or triggered by customer_event
2. For each customer, collects: call transcripts, email sentiment, CRM changes,
   support tickets, contract/renewal artifacts, engineering artifacts
3. Computes CustomerHealthSignal (healthScore, trend, signals, recommendations)
4. Creates meta:customer_health artifact
5. If alertLevel >= action_required, notifies account owner and CS team
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..llm_client import LLMClient
from ..models import (
    Agent,
    AgentAction,
    AgentActionType,
    Artifact,
    ArtifactType,
    CustomerHealthSignal,
    TriggerEvent,
    TriggerType,
)

logger = logging.getLogger("agent-orchestrator.agents.customer_health")

_CUSTOMER_HEALTH_PROMPT = """\
You are a customer health agent performing deep analysis of all touchpoints
for a specific customer. You use Opus 4.6 for complex multi-source reasoning.

Customer: {customer_name} (ID: {customer_id})

Touchpoint artifacts:
{touchpoints_text}

Tasks:
1. Analyse sentiment across all touchpoints (calls, emails, support tickets).
2. Assess engagement frequency and trend (increasing, stable, declining).
3. Evaluate product adoption and usage signals if visible in artifacts.
4. Check contract/renewal status and timeline.
5. Identify any escalation signals or churn risk.
6. Compute an overall health score (0-100) with supporting signals.
7. Generate actionable recommendations for the account team.

Return a JSON object:
{{
  "action": "synthesize" | "notify",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "proposed_title": "Customer Health — {customer_name}",
  "synthesis_content": "# Customer Health Report: {customer_name}\\n\\n## Health Score: {{score}}/100\\n## Trend: {{trend}}\\n\\n## Signal Breakdown\\n...\\n## Recommendations\\n...",
  "health_signal": {{
    "customer_id": "{customer_id}",
    "health_score": 0,
    "trend": "improving|stable|declining|critical",
    "signals": [
      {{"source": "...", "value": "...", "weight": 0.0, "detail": "..."}}
    ],
    "recommendations": ["..."],
    "alert_level": "none|watch|action_required|escalation"
  }},
  "notification_message": "alert message if alert_level >= action_required",
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_PORTFOLIO_HEALTH_PROMPT = """\
You are a customer health agent generating a portfolio-level health summary.

Customer portfolio:
{portfolio_text}

Tasks:
1. Rank customers by risk (highest risk first).
2. Identify portfolio-wide trends (common churn signals, positive patterns).
3. Highlight any customers that need immediate attention.
4. Provide portfolio-level metrics (avg health score, # at risk, # improving).

Return a JSON object:
{{
  "action": "synthesize",
  "confidence": 0.85,
  "justification": "Portfolio health summary for {customer_count} customers",
  "proposed_title": "Customer Portfolio Health — {date}",
  "synthesis_content": "# Portfolio Health Summary\\n\\n## Overview\\n...\\n## At-Risk Customers\\n...\\n## Trends\\n...\\n## Recommendations\\n...",
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class CustomerHealthAgent:
    """
    Customer health agent using Opus 4.6 for deep multi-source analysis.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """
        Analyse customer health. Can operate on a single customer
        (triggered by customer_event) or portfolio-wide (scheduled).
        """
        target_customer_id = trigger.payload.get("customer_id")
        if target_customer_id:
            return await self._analyse_single_customer(
                agent, target_customer_id, artifacts
            )
        return await self._analyse_portfolio(agent, artifacts)

    async def _analyse_single_customer(
        self,
        agent: Agent,
        customer_id: str,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Analyse health for a single customer."""
        # Filter artifacts related to this customer
        customer_artifacts = [
            a for a in artifacts
            if any(ref.customer_id == customer_id for ref in a.customer_refs)
            or customer_id in (a.redacted_content or "")
        ]

        if not customer_artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification=f"No artifacts found for customer {customer_id}",
            )

        # Determine customer name
        customer_name = customer_id
        for a in customer_artifacts:
            for ref in a.customer_refs:
                if ref.customer_id == customer_id:
                    customer_name = ref.customer_name
                    break

        # Categorise touchpoints
        calls = [a for a in customer_artifacts if a.type.value.startswith("comm:call")]
        emails = [a for a in customer_artifacts if a.type.value.startswith("comm:email")]
        crm = [a for a in customer_artifacts if a.type == ArtifactType.DATA_CRM_RECORD]
        support = [a for a in customer_artifacts if a.type == ArtifactType.DATA_ISSUE_TRACKER]
        other = [a for a in customer_artifacts if a not in calls + emails + crm + support]

        touchpoints_text = ""

        if calls:
            touchpoints_text += "### Call transcripts/summaries\n"
            touchpoints_text += "\n".join(
                f"- [{a.id}] {a.title} ({a.modified_at}): {(a.redacted_content or '')[:500]}"
                for a in calls[:5]
            ) + "\n\n"

        if emails:
            touchpoints_text += "### Emails\n"
            touchpoints_text += "\n".join(
                f"- [{a.id}] {a.title} ({a.modified_at}): {(a.redacted_content or '')[:300]}"
                for a in emails[:5]
            ) + "\n\n"

        if crm:
            touchpoints_text += "### CRM records\n"
            touchpoints_text += "\n".join(
                f"- [{a.id}] {a.title}: {(a.redacted_content or '')[:500]}"
                for a in crm[:3]
            ) + "\n\n"

        if support:
            touchpoints_text += "### Support tickets\n"
            touchpoints_text += "\n".join(
                f"- [{a.id}] {a.title}: {(a.redacted_content or '')[:500]}"
                for a in support[:5]
            ) + "\n\n"

        if other:
            touchpoints_text += "### Other artifacts\n"
            touchpoints_text += "\n".join(
                f"- [{a.id}] {a.title} [{a.type.value}]: {(a.redacted_content or '')[:300]}"
                for a in other[:5]
            ) + "\n\n"

        prompt = _CUSTOMER_HEALTH_PROMPT.format(
            customer_name=customer_name,
            customer_id=customer_id,
            touchpoints_text=touchpoints_text or "(no touchpoints available)",
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="customer_health",
            prompt=prompt,
            system_prompt=(
                "You are a customer health agent for Lurk using Opus 4.6. "
                "Be rigorous and evidence-based. Only flag alerts when data "
                "supports the assessment. Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.2,
        )

        action = _parse_response(response.get("content", ""))

        # If alert level is action_required or escalation, ensure action is notify
        try:
            raw = json.loads(_strip_fences(response.get("content", "")))
            health = raw.get("health_signal", {})
            alert_level = health.get("alert_level", "none")
            if alert_level in ("action_required", "escalation") and action.action == AgentActionType.SYNTHESIZE:
                action.action = AgentActionType.NOTIFY
                action.notification_message = (
                    action.notification_message
                    or f"ALERT: Customer {customer_name} health is {alert_level}. "
                    f"Score: {health.get('health_score', '?')}/100, "
                    f"Trend: {health.get('trend', '?')}"
                )
        except Exception:
            pass

        return action

    async def _analyse_portfolio(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Generate portfolio-level customer health summary."""
        # Group artifacts by customer
        customer_map: dict[str, list[Artifact]] = {}
        for a in artifacts:
            for ref in a.customer_refs:
                cid = ref.customer_id
                if cid not in customer_map:
                    customer_map[cid] = []
                customer_map[cid].append(a)

        if not customer_map:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No customer-referenced artifacts found",
            )

        # Build portfolio summary text
        portfolio_lines: list[str] = []
        for cid, arts in list(customer_map.items())[:20]:
            name = cid
            for a in arts:
                for ref in a.customer_refs:
                    if ref.customer_id == cid:
                        name = ref.customer_name
                        break

            types = set(a.type.value for a in arts)
            latest = max(a.modified_at for a in arts)
            portfolio_lines.append(
                f"- {name} ({cid}): {len(arts)} artifacts, "
                f"types=[{', '.join(types)}], last activity={latest}"
            )

        portfolio_text = "\n".join(portfolio_lines)

        from datetime import datetime, timezone
        prompt = _PORTFOLIO_HEALTH_PROMPT.format(
            portfolio_text=portfolio_text,
            customer_count=len(customer_map),
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="customer_health",
            prompt=prompt,
            system_prompt=(
                "You are a customer health portfolio agent for Lurk. "
                "Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.3,
        )

        return _parse_response(response.get("content", ""))


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_nl = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_nl:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _parse_response(text: str) -> AgentAction:
    """Parse LLM JSON response into an AgentAction."""
    cleaned = _strip_fences(text)
    try:
        data = json.loads(cleaned)
        return AgentAction(
            action=data.get("action", "synthesize"),
            confidence=float(data.get("confidence", 0.8)),
            justification=data.get("justification", ""),
            target_artifact_id=data.get("target_artifact_id"),
            proposed_changes=data.get("proposed_changes"),
            proposed_title=data.get("proposed_title"),
            synthesis_content=data.get("synthesis_content"),
            notification_message=data.get("notification_message"),
            source_refs=data.get("source_refs", []),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse customer health agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

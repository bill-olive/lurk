"""
Org agent — PRD Section 6.3.

Scope:  All ledgers across the org (redacted per policy).
Model:  Opus 4.6 (deep reasoning required).
Purpose: Enforce org-wide standards and surface cross-functional insights.

Capabilities:
- Compliance scanning (regulatory red flags)
- Brand consistency (off-brand language in customer-facing docs)
- Security detection (leaked credentials)
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
    TriggerEvent,
    TriggerType,
)

logger = logging.getLogger("agent-orchestrator.agents.org")

_COMPLIANCE_PROMPT = """\
You are an org-level compliance agent performing a regulatory and policy scan.
You use deep reasoning (Opus 4.6) to catch subtle compliance issues.

Organisation: {org_id}

Artifacts to scan:
{artifacts_text}

Compliance areas to check:
- Data privacy regulations (GDPR, CCPA, HIPAA if applicable)
- Financial reporting accuracy
- Contractual obligation alignment
- Internal policy adherence
- Export control / sanctions concerns
- Industry-specific regulations mentioned in artifact context

Tasks:
1. Flag any regulatory red flags or potential compliance violations.
2. Assess severity (critical, high, medium, low).
3. Recommend remediation for each finding.
4. If customer-facing content has compliance issues, recommend immediate action.

Return a JSON object:
{{
  "action": "notify" | "synthesize" | "fork" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "id of most critical artifact, or null",
  "proposed_changes": "...",
  "proposed_title": "Compliance Alert — {org_id}",
  "synthesis_content": "detailed compliance report if synthesize",
  "notification_message": "alert summary if notify",
  "findings": [
    {{
      "artifact_id": "...",
      "finding": "...",
      "regulation": "...",
      "severity": "critical|high|medium|low",
      "remediation": "..."
    }}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_BRAND_CONSISTENCY_PROMPT = """\
You are an org-level brand consistency agent.

Organisation: {org_id}
Brand guidelines summary:
{brand_guidelines}

Customer-facing artifacts to review:
{artifacts_text}

Tasks:
1. Check each artifact against brand voice, terminology, and messaging guidelines.
2. Flag off-brand language, incorrect product names, outdated taglines, or tone violations.
3. Propose corrections.

Return a JSON object:
{{
  "action": "fork" | "pr" | "notify" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "id of the artifact with the most issues",
  "proposed_changes": "specific corrections",
  "proposed_title": "Brand consistency fix",
  "violations": [
    {{
      "artifact_id": "...",
      "location": "...",
      "current_text": "...",
      "suggested_text": "...",
      "guideline_violated": "..."
    }}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""

_SECURITY_PROMPT = """\
You are an org-level security agent scanning artifacts for leaked credentials and security risks.

Organisation: {org_id}

Artifacts to scan:
{artifacts_text}

Security checks:
1. API keys, tokens, passwords, secrets in artifact content.
2. Internal URLs or infrastructure details in customer-facing documents.
3. PII that should have been redacted but was not.
4. Credentials in code snippets, configuration, or documentation.
5. References to internal tools/systems that should not be externally visible.

IMPORTANT: If you find any credential or secret, this is CRITICAL severity.

Return a JSON object:
{{
  "action": "notify" | "fork" | "skip",
  "confidence": 0.0 to 1.0,
  "justification": "...",
  "target_artifact_id": "id of artifact with most critical finding",
  "proposed_changes": "redaction of sensitive content",
  "proposed_title": "Security: credential redaction required",
  "notification_message": "SECURITY ALERT: ...",
  "findings": [
    {{
      "artifact_id": "...",
      "type": "credential|pii|internal_url|infrastructure",
      "severity": "critical|high|medium|low",
      "description": "...",
      "remediation": "..."
    }}
  ],
  "source_refs": [{{"artifact_id": "...", "reason": "..."}}]
}}
Return ONLY the JSON object.
"""


class OrgAgent:
    """
    Org agent implementation using Opus 4.6.

    The LLM Gateway selects Opus 4.6 automatically when agent_type is 'org'
    or task_type indicates deep analysis.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def analyse(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Route to the appropriate org-level scan."""
        task = trigger.payload.get("task", "compliance")

        if task == "brand_consistency":
            return await self._brand_consistency_scan(agent, artifacts)
        if task == "security":
            return await self._security_scan(agent, artifacts)

        # Default: run all scans, return most critical finding
        return await self._compliance_scan(agent, artifacts)

    async def _compliance_scan(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Run compliance/regulatory scan across all artifacts."""
        if not artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No artifacts to scan",
            )

        artifacts_text = "\n\n".join(
            f"--- [{a.id}] {a.title} [{a.type.value}] ---\n"
            f"Sensitivity: {a.sensitivity.value} | Customer-facing: {a.customer_facing}\n"
            f"Tags: {', '.join(a.tags)}\n"
            f"{(a.redacted_content or '(no content)')[:2000]}"
            for a in artifacts[:15]
        )

        prompt = _COMPLIANCE_PROMPT.format(
            org_id=agent.org_id,
            artifacts_text=artifacts_text,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="deep_analysis",
            prompt=prompt,
            system_prompt=(
                "You are an org-level Lurk compliance agent using Opus 4.6 "
                "for deep reasoning. Be thorough and precise. Respond with JSON only."
            ),
            max_tokens=4096,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))

    async def _brand_consistency_scan(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Check customer-facing artifacts for brand consistency."""
        customer_facing = [a for a in artifacts if a.customer_facing]
        if not customer_facing:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No customer-facing artifacts to review",
            )

        # Extract brand guidelines from wiki/doc artifacts
        guideline_artifacts = [
            a for a in artifacts
            if any(t in a.tags for t in ("brand", "guidelines", "style-guide", "brand-guidelines"))
        ]
        brand_guidelines = "\n".join(
            f"- {a.title}: {(a.redacted_content or '')[:1000]}"
            for a in guideline_artifacts
        ) or "(no explicit brand guidelines found — check for standard corporate tone and terminology)"

        artifacts_text = "\n\n".join(
            f"--- [{a.id}] {a.title} [{a.type.value}] ---\n"
            f"{(a.redacted_content or '(no content)')[:2000]}"
            for a in customer_facing[:10]
        )

        prompt = _BRAND_CONSISTENCY_PROMPT.format(
            org_id=agent.org_id,
            brand_guidelines=brand_guidelines,
            artifacts_text=artifacts_text,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="deep_analysis",
            prompt=prompt,
            system_prompt=(
                "You are an org-level Lurk brand consistency agent. "
                "Respond with JSON only."
            ),
            max_tokens=3072,
            temperature=0.2,
        )

        return _parse_response(response.get("content", ""))

    async def _security_scan(
        self,
        agent: Agent,
        artifacts: list[Artifact],
    ) -> AgentAction:
        """Scan for leaked credentials and security risks."""
        if not artifacts:
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=1.0,
                justification="No artifacts to scan for security issues",
            )

        artifacts_text = "\n\n".join(
            f"--- [{a.id}] {a.title} [{a.type.value}] ---\n"
            f"Sensitivity: {a.sensitivity.value}\n"
            f"{(a.redacted_content or '(no content)')[:3000]}"
            for a in artifacts[:15]
        )

        prompt = _SECURITY_PROMPT.format(
            org_id=agent.org_id,
            artifacts_text=artifacts_text,
        )

        response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type="deep_analysis",
            prompt=prompt,
            system_prompt=(
                "You are an org-level Lurk security agent using Opus 4.6. "
                "Be extremely thorough — missed credentials are critical. "
                "Respond with JSON only."
            ),
            max_tokens=3072,
            temperature=0.1,
        )

        return _parse_response(response.get("content", ""))


def _parse_response(text: str) -> AgentAction:
    """Parse LLM JSON response into an AgentAction."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_nl = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_nl:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        data = json.loads(cleaned)
        return AgentAction(
            action=data.get("action", "skip"),
            confidence=float(data.get("confidence", 0.0)),
            justification=data.get("justification", ""),
            target_artifact_id=data.get("target_artifact_id"),
            proposed_changes=data.get("proposed_changes"),
            proposed_title=data.get("proposed_title"),
            synthesis_content=data.get("synthesis_content"),
            notification_message=data.get("notification_message"),
            source_refs=data.get("source_refs", []),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse org agent response: %s", exc)
        return AgentAction(
            action=AgentActionType.SKIP,
            confidence=0.0,
            justification=f"Parse error: {exc}",
        )

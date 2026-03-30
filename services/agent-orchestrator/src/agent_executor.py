"""
Core AgentExecutor — implements the 9-step execution loop from PRD Section 5.3.

Steps:
1. TRIGGER  — Receive trigger event
2. SCOPE    — Resolve accessible artifacts via API Gateway
3. CONTEXT  — Load relevant artifacts and feature bundles
4. ANALYZE  — Send to LLM Gateway for Claude analysis
5. DECIDE   — Parse structured response (action, confidence, justification)
6. GATE     — Check policy (budget, confidence, scope, YOLO)
7. EXECUTE  — Fork artifact -> compute diff -> open PR (or synthesize/notify)
8. AUDIT    — Log action
9. NOTIFY   — Send notification
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from .llm_client import LLMBudgetExceeded, LLMClient, LLMClientError
from .models import (
    Agent,
    AgentAction,
    AgentActionType,
    AgentExecutionRequest,
    AgentExecutionResult,
    AgentType,
    Artifact,
    BatchExecuteRequest,
    BatchExecuteResponse,
    Diff,
    Fork,
    ForkStatus,
    PRStatus,
    PullRequest,
    SensitivityLevel,
    TriggerEvent,
    TriggerType,
)
from .safety import GateResult, SafetyController

logger = logging.getLogger("agent-orchestrator.executor")


class AgentExecutor:
    """Orchestrates the full agent execution pipeline."""

    def __init__(
        self,
        *,
        llm_client: LLMClient,
        safety: SafetyController,
        api_gateway_url: str,
        firestore_project: str | None = None,
    ) -> None:
        self._llm = llm_client
        self._safety = safety
        self._api_url = api_gateway_url.rstrip("/")
        self._http = httpx.AsyncClient(timeout=30.0)
        self._firestore_project = firestore_project

        # Lazy Firestore client (only created when needed)
        self._db = None

    # ------------------------------------------------------------------
    # Firestore helpers
    # ------------------------------------------------------------------

    def _get_db(self):
        if self._db is None:
            from google.cloud import firestore
            self._db = firestore.AsyncClient(project=self._firestore_project)
        return self._db

    async def _load_agent(self, agent_id: str, org_id: str) -> Agent | None:
        """Load an agent definition from Firestore."""
        try:
            db = self._get_db()
            doc_ref = db.collection("orgs").document(org_id).collection("agents").document(agent_id)
            doc = await doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = agent_id
                data["org_id"] = org_id
                return Agent.model_validate(data)
        except Exception:
            logger.exception("Failed to load agent %s from Firestore", agent_id)
        return None

    async def _load_agents_by_type(
        self, org_id: str, agent_type: AgentType | None = None
    ) -> list[Agent]:
        """Load all agents for an org, optionally filtered by type."""
        try:
            db = self._get_db()
            collection = db.collection("orgs").document(org_id).collection("agents")
            if agent_type is not None:
                query = collection.where("type", "==", agent_type.value)
            else:
                query = collection.where("status", "==", "active")
            docs = query.stream()
            agents = []
            async for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                data["org_id"] = org_id
                agents.append(Agent.model_validate(data))
            return agents
        except Exception:
            logger.exception("Failed to load agents for org %s", org_id)
            return []

    # ------------------------------------------------------------------
    # Step 2: SCOPE — resolve accessible artifacts
    # ------------------------------------------------------------------

    async def _resolve_scope(
        self, agent: Agent, trigger: TriggerEvent
    ) -> list[str]:
        """
        Call the API Gateway to resolve which artifact IDs this agent can
        access, based on ACL and scope configuration.
        """
        try:
            resp = await self._http.post(
                f"{self._api_url}/v1/artifacts/resolve-scope",
                json={
                    "agent_id": agent.id,
                    "org_id": agent.org_id,
                    "read_scope": agent.read_scope,
                    "trigger_artifact_id": trigger.artifact_id,
                    "trigger_artifact_ids": trigger.artifact_ids,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("artifact_ids", [])
            logger.warning(
                "Scope resolution returned %d: %s", resp.status_code, resp.text
            )
        except Exception:
            logger.exception("Failed to resolve scope via API Gateway")

        # Fallback: use trigger artifact IDs directly
        ids: list[str] = []
        if trigger.artifact_id:
            ids.append(trigger.artifact_id)
        ids.extend(trigger.artifact_ids)
        return ids

    # ------------------------------------------------------------------
    # Step 3: CONTEXT — load artifacts
    # ------------------------------------------------------------------

    async def _load_context(
        self, agent: Agent, artifact_ids: list[str]
    ) -> list[Artifact]:
        """Load artifact details from the API Gateway."""
        if not artifact_ids:
            return []
        try:
            resp = await self._http.post(
                f"{self._api_url}/v1/artifacts/batch",
                json={
                    "artifact_ids": artifact_ids[:50],  # cap to avoid enormous payloads
                    "org_id": agent.org_id,
                    "include_content": True,
                },
            )
            if resp.status_code == 200:
                items = resp.json().get("artifacts", [])
                return [Artifact.model_validate(a) for a in items]
            logger.warning("Artifact batch load returned %d", resp.status_code)
        except Exception:
            logger.exception("Failed to load artifacts from API Gateway")
        return []

    # ------------------------------------------------------------------
    # Step 4+5: ANALYZE + DECIDE — call LLM and parse decision
    # ------------------------------------------------------------------

    async def _analyze_and_decide(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        artifacts: list[Artifact],
    ) -> tuple[AgentAction, int]:
        """
        Send context to the LLM Gateway, parse the structured response.

        Returns (AgentAction, tokens_used).
        """
        # Build the artifact context string
        context_parts: list[str] = []
        for art in artifacts:
            content = art.redacted_content or "(content unavailable)"
            context_parts.append(
                f"--- Artifact: {art.title} [{art.type.value}] ---\n"
                f"ID: {art.id}\n"
                f"Author: {art.author_id}\n"
                f"Version: {art.version}\n"
                f"Sensitivity: {art.sensitivity.value}\n"
                f"Tags: {', '.join(art.tags)}\n"
                f"Customer-facing: {art.customer_facing}\n"
                f"Quality score: {art.quality_score}\n"
                f"Staleness score: {art.staleness_score}\n"
                f"Content:\n{content}\n"
            )

        artifacts_text = "\n".join(context_parts) if context_parts else "(no artifacts loaded)"

        system_prompt = self._build_system_prompt(agent, trigger)
        user_prompt = (
            f"Trigger: {trigger.trigger_type.value}\n"
            f"Trigger payload: {json.dumps(trigger.payload)}\n\n"
            f"Artifacts in scope ({len(artifacts)}):\n\n"
            f"{artifacts_text}\n\n"
            "Analyse these artifacts and return your decision as JSON with the "
            "following structure:\n"
            "{\n"
            '  "action": "fork" | "pr" | "synthesize" | "notify" | "skip",\n'
            '  "confidence": 0.0 to 1.0,\n'
            '  "justification": "why this action is needed",\n'
            '  "target_artifact_id": "id of the artifact to act on (if applicable)",\n'
            '  "proposed_changes": "description of changes (if fork/pr)",\n'
            '  "proposed_title": "title for the PR or synthesis (if applicable)",\n'
            '  "synthesis_content": "content of the synthesis artifact (if synthesize)",\n'
            '  "notification_message": "message to send (if notify)",\n'
            '  "source_refs": [{"artifact_id": "...", "reason": "..."}]\n'
            "}\n"
            "Return ONLY the JSON object, no markdown fences."
        )

        task_type = self._infer_task_type(agent, trigger)
        llm_response = await self._llm.complete(
            agent_id=agent.id,
            agent_type=agent.type.value,
            org_id=agent.org_id,
            task_type=task_type,
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=4096,
            temperature=0.3,
        )

        content_text = llm_response.get("content", "")
        tokens_used = llm_response.get("input_tokens", 0) + llm_response.get("output_tokens", 0)

        action = self._parse_action(content_text)
        return action, tokens_used

    def _build_system_prompt(self, agent: Agent, trigger: TriggerEvent) -> str:
        """Build the system prompt based on agent type and trigger."""
        base = (
            f"You are a Lurk {agent.type.value} agent named '{agent.name}'.\n"
            f"Description: {agent.description}\n\n"
            "Your job is to analyse artifacts and decide whether action is needed. "
            "You must return a structured JSON decision.\n\n"
            "Guidelines:\n"
            "- Only propose changes when you are confident they improve the artifact.\n"
            "- Be conservative with fork/pr actions on customer-facing or confidential artifacts.\n"
            "- Prefer 'skip' when no clear action is warranted.\n"
            "- Always include a clear justification.\n"
            "- Reference specific artifact IDs in source_refs.\n"
        )

        type_instructions = {
            AgentType.PERSONAL: (
                "As a personal agent, focus on keeping the user's own work "
                "consistent and up-to-date. Look for stale references, "
                "deprecated APIs, and action items from meetings."
            ),
            AgentType.TEAM: (
                "As a team agent, focus on cross-artifact consistency within "
                "the team. Detect contradictions, synthesise weekly reports, "
                "and enforce team standards."
            ),
            AgentType.ORG: (
                "As an org agent, focus on compliance, brand consistency, "
                "and security. Flag regulatory issues, off-brand language, "
                "and leaked credentials."
            ),
            AgentType.FUNCTION: (
                "As a function agent, represent your business function's "
                "interests across teams. Synthesise cross-functional insights."
            ),
            AgentType.VOICE: (
                "As a voice agent, process meeting transcripts and generate "
                "summaries with action items, decisions, and follow-ups. "
                "Open PRs on affected artifacts."
            ),
            AgentType.CALENDAR: (
                "As a calendar agent, review upcoming meetings and determine "
                "whether they are necessary based on existing artifacts."
            ),
            AgentType.MIGRATION: (
                "As a migration agent, classify imported content, map "
                "relationships, and ensure clean import into the Lurk ledger."
            ),
        }

        return base + type_instructions.get(agent.type, "")

    @staticmethod
    def _infer_task_type(agent: Agent, trigger: TriggerEvent) -> str:
        """Map agent type + trigger to a task_type string for model selection."""
        if agent.type in (AgentType.ORG, AgentType.FUNCTION):
            return "deep_analysis"
        if trigger.trigger_type == TriggerType.MEETING_ENDED:
            return "meeting_summary"
        if trigger.trigger_type == TriggerType.CONFLICT_DETECTED:
            return "conflict_detection"
        if trigger.trigger_type == TriggerType.CUSTOMER_EVENT:
            return "customer_health"
        if trigger.trigger_type == TriggerType.CALENDAR_EVENT:
            return "calendar_review"
        if trigger.trigger_type == TriggerType.MIGRATION_BATCH:
            return "migration_classify"
        return "artifact_analysis"

    @staticmethod
    def _parse_action(llm_content: str) -> AgentAction:
        """Parse the LLM response JSON into an AgentAction."""
        # Strip any accidental markdown fences
        text = llm_content.strip()
        if text.startswith("```"):
            first_nl = text.index("\n") if "\n" in text else 3
            text = text[first_nl:].strip()
        if text.endswith("```"):
            text = text[:-3].strip()

        try:
            data = json.loads(text)
            return AgentAction.model_validate(data)
        except (json.JSONDecodeError, Exception) as exc:
            logger.warning("Failed to parse LLM response as JSON: %s", exc)
            return AgentAction(
                action=AgentActionType.SKIP,
                confidence=0.0,
                justification=f"Failed to parse LLM response: {exc}",
            )

    # ------------------------------------------------------------------
    # Step 7: EXECUTE — perform the action
    # ------------------------------------------------------------------

    async def _execute_action(
        self,
        agent: Agent,
        action: AgentAction,
        trigger: TriggerEvent,
        gate: GateResult,
        artifacts: list[Artifact],
    ) -> dict[str, int]:
        """
        Execute the decided action. Returns counts:
        {artifacts_created, prs_opened}
        """
        counters = {"artifacts_created": 0, "prs_opened": 0}

        if action.action == AgentActionType.SKIP:
            return counters

        if action.action in (AgentActionType.FORK, AgentActionType.PR):
            await self._execute_fork_and_pr(
                agent, action, trigger, gate, artifacts, counters
            )
        elif action.action == AgentActionType.SYNTHESIZE:
            await self._execute_synthesize(agent, action, trigger, counters)
        elif action.action == AgentActionType.NOTIFY:
            await self._execute_notify(agent, action, trigger)

        return counters

    async def _execute_fork_and_pr(
        self,
        agent: Agent,
        action: AgentAction,
        trigger: TriggerEvent,
        gate: GateResult,
        artifacts: list[Artifact],
        counters: dict[str, int],
    ) -> None:
        """Fork the target artifact, compute diff, and open a PR."""
        target_id = action.target_artifact_id
        if not target_id:
            logger.warning("Fork/PR action without target_artifact_id; skipping")
            return

        # Find the target artifact
        target = next((a for a in artifacts if a.id == target_id), None)
        if target is None:
            logger.warning("Target artifact %s not found in context", target_id)
            return

        # Create fork via API Gateway
        fork_id = str(uuid.uuid4())
        fork_branch_id = f"agent/{agent.name}/{fork_id[:8]}"
        try:
            resp = await self._http.post(
                f"{self._api_url}/v1/forks",
                json={
                    "fork_id": fork_id,
                    "org_id": agent.org_id,
                    "upstream_artifact_id": target.id,
                    "upstream_version": target.version,
                    "upstream_ledger_id": target.ledger_id,
                    "fork_branch_id": fork_branch_id,
                    "agent_id": agent.id,
                    "agent_type": agent.type.value,
                    "reason": action.justification,
                    "confidence": action.confidence,
                },
            )
            if resp.status_code not in (200, 201):
                logger.error("Fork creation failed: %d %s", resp.status_code, resp.text)
                return
            fork_data = resp.json()
        except Exception:
            logger.exception("Failed to create fork via API Gateway")
            return

        counters["artifacts_created"] += 1

        # Open PR
        pr_id = str(uuid.uuid4())
        pr_title = action.proposed_title or f"Agent update: {action.justification[:80]}"
        pr_desc = (
            f"## Agent: {agent.name} ({agent.type.value})\n\n"
            f"**Justification:** {action.justification}\n\n"
            f"**Confidence:** {action.confidence:.0%}\n\n"
            f"**Proposed changes:** {action.proposed_changes or 'See diff'}\n"
        )

        auto_merge_eligible = (
            not gate.requires_human_review
            and action.confidence >= 0.9
            and not target.customer_facing
            and target.sensitivity in (SensitivityLevel.PUBLIC, SensitivityLevel.INTERNAL)
        )

        try:
            resp = await self._http.post(
                f"{self._api_url}/v1/pull-requests",
                json={
                    "pr_id": pr_id,
                    "org_id": agent.org_id,
                    "fork_id": fork_id,
                    "source_artifact_id": fork_data.get("artifact_id", fork_id),
                    "target_artifact_id": target.id,
                    "target_ledger_id": target.ledger_id,
                    "title": pr_title,
                    "description": pr_desc,
                    "change_summary": action.proposed_changes or action.justification,
                    "agent_id": agent.id,
                    "agent_type": agent.type.value,
                    "confidence": action.confidence,
                    "justification": action.justification,
                    "source_refs": action.source_refs,
                    "auto_merge_eligible": auto_merge_eligible,
                },
            )
            if resp.status_code in (200, 201):
                counters["prs_opened"] += 1
                logger.info("PR %s opened for artifact %s", pr_id, target.id)

                # Register for rollback tracking if auto-merge
                if auto_merge_eligible:
                    self._safety.register_auto_merge(pr_id, agent.id, agent.org_id)
            else:
                logger.error("PR creation failed: %d %s", resp.status_code, resp.text)
        except Exception:
            logger.exception("Failed to create PR via API Gateway")

    async def _execute_synthesize(
        self,
        agent: Agent,
        action: AgentAction,
        trigger: TriggerEvent,
        counters: dict[str, int],
    ) -> None:
        """Create a synthesis/meta artifact."""
        try:
            resp = await self._http.post(
                f"{self._api_url}/v1/artifacts",
                json={
                    "org_id": agent.org_id,
                    "type": "meta:synthesis",
                    "title": action.proposed_title or "Agent Synthesis",
                    "source_app": f"lurk:agent:{agent.name}",
                    "capture_method": "agent_generated",
                    "redacted_content": action.synthesis_content or action.justification,
                    "author_id": agent.id,
                    "tags": ["agent-generated", f"agent:{agent.type.value}"],
                    "sensitivity": "internal",
                },
            )
            if resp.status_code in (200, 201):
                counters["artifacts_created"] += 1
                logger.info("Synthesis artifact created by agent %s", agent.id)
            else:
                logger.error(
                    "Synthesis artifact creation failed: %d %s",
                    resp.status_code,
                    resp.text,
                )
        except Exception:
            logger.exception("Failed to create synthesis artifact")

    async def _execute_notify(
        self,
        agent: Agent,
        action: AgentAction,
        trigger: TriggerEvent,
    ) -> None:
        """Send a notification via the notification service."""
        try:
            await self._http.post(
                f"{self._api_url}/v1/notifications",
                json={
                    "org_id": agent.org_id,
                    "agent_id": agent.id,
                    "agent_type": agent.type.value,
                    "message": action.notification_message or action.justification,
                    "target_artifact_id": action.target_artifact_id,
                    "confidence": action.confidence,
                    "trigger_type": trigger.trigger_type.value,
                },
            )
            logger.info("Notification sent by agent %s", agent.id)
        except Exception:
            logger.exception("Failed to send notification")

    # ------------------------------------------------------------------
    # Step 8: AUDIT
    # ------------------------------------------------------------------

    async def _audit(
        self,
        agent: Agent,
        trigger: TriggerEvent,
        action: AgentAction,
        gate: GateResult,
        result: AgentExecutionResult,
    ) -> None:
        """Log the action to the audit service."""
        try:
            await self._http.post(
                f"{self._api_url}/v1/audit/agent-actions",
                json={
                    "request_id": result.request_id,
                    "agent_id": agent.id,
                    "org_id": agent.org_id,
                    "trigger_type": trigger.trigger_type.value,
                    "action_taken": action.action.value,
                    "confidence": action.confidence,
                    "justification": action.justification,
                    "gated": result.gated,
                    "gate_reason": result.gate_reason,
                    "artifacts_read": result.artifacts_read,
                    "artifacts_created": result.artifacts_created,
                    "prs_opened": result.prs_opened,
                    "tokens_used": result.tokens_used,
                    "duration_ms": result.duration_ms,
                    "error": result.error,
                    "timestamp": result.created_at.isoformat(),
                },
            )
        except Exception:
            logger.exception("Failed to write audit log")

    # ------------------------------------------------------------------
    # Step 9: NOTIFY
    # ------------------------------------------------------------------

    async def _notify_owner(
        self,
        agent: Agent,
        action: AgentAction,
        artifacts: list[Artifact],
    ) -> None:
        """Notify artifact owner(s) if a PR was opened."""
        if action.action not in (AgentActionType.FORK, AgentActionType.PR):
            return

        target_id = action.target_artifact_id
        target = next((a for a in artifacts if a.id == target_id), None) if target_id else None
        if target is None:
            return

        for owner_id in target.owner_ids:
            try:
                await self._http.post(
                    f"{self._api_url}/v1/notifications",
                    json={
                        "org_id": agent.org_id,
                        "recipient_id": owner_id,
                        "type": "pr_opened",
                        "agent_id": agent.id,
                        "agent_name": agent.name,
                        "artifact_id": target.id,
                        "artifact_title": target.title,
                        "message": f"Agent '{agent.name}' opened a PR on '{target.title}': {action.justification}",
                    },
                )
            except Exception:
                logger.exception("Failed to notify owner %s", owner_id)

    # ------------------------------------------------------------------
    # Main execution loop (PRD Section 5.3)
    # ------------------------------------------------------------------

    async def execute(self, request: AgentExecutionRequest) -> AgentExecutionResult:
        """
        Run the full 9-step agent execution loop.
        """
        start = time.perf_counter()
        trigger = request.trigger_event
        tokens_used = 0

        # Step 1: TRIGGER — we already have it
        logger.info(
            "Executing agent %s for trigger %s (request %s)",
            trigger.agent_id,
            trigger.trigger_type.value,
            request.request_id,
        )

        # Load agent definition
        agent = request.agent
        if agent is None:
            agent = await self._load_agent(trigger.agent_id, trigger.org_id)
        if agent is None:
            return self._error_result(
                request, "Agent not found", start,
            )

        # Check agent is active
        if agent.status != "active":
            return self._error_result(
                request, f"Agent status is '{agent.status}'", start,
            )

        # Check if agent is paused by safety controller
        if self._safety.is_agent_paused(agent.id):
            return self._error_result(
                request, "Agent is paused by safety controller", start,
            )

        try:
            # Step 2: SCOPE
            artifact_ids = await self._resolve_scope(agent, trigger)
            logger.info("Scope resolved: %d artifacts", len(artifact_ids))

            # Step 3: CONTEXT
            artifacts = await self._load_context(agent, artifact_ids)
            logger.info("Context loaded: %d artifacts", len(artifacts))

            # Step 4+5: ANALYZE + DECIDE
            action, tokens_used = await self._analyze_and_decide(
                agent, trigger, artifacts
            )
            logger.info(
                "Decision: %s (confidence=%.2f) — %s",
                action.action.value,
                action.confidence,
                action.justification[:100],
            )

            # Step 6: GATE
            target_artifact = (
                next((a for a in artifacts if a.id == action.target_artifact_id), None)
                if action.target_artifact_id
                else None
            )
            gate = self._safety.evaluate_gate(
                agent=agent,
                action=action,
                trigger=trigger,
                artifact_sensitivity=(
                    target_artifact.sensitivity if target_artifact else None
                ),
                artifact_customer_facing=(
                    target_artifact.customer_facing if target_artifact else False
                ),
                diff_changed_lines=0,  # not yet computed at this stage
            )

            gated = False
            gate_reason: str | None = None
            if not gate.allowed:
                gated = True
                gate_reason = gate.reason
                logger.info("Action GATED: %s", gate.reason)
            elif gate.requires_human_review:
                gate_reason = gate.reason
                logger.info("Action requires human review: %s", gate.reason)

            # Step 7: EXECUTE
            counters = {"artifacts_created": 0, "prs_opened": 0}
            if gate.allowed:
                counters = await self._execute_action(
                    agent, action, trigger, gate, artifacts,
                )
                self._safety.record_action_taken(
                    trigger.org_id, agent.id, action.action
                )

            elapsed_ms = int((time.perf_counter() - start) * 1000)

            result = AgentExecutionResult(
                request_id=request.request_id,
                agent_id=agent.id,
                org_id=agent.org_id,
                trigger_type=trigger.trigger_type,
                action_taken=action.action,
                confidence=action.confidence,
                justification=action.justification,
                artifacts_read=len(artifacts),
                artifacts_created=counters["artifacts_created"],
                prs_opened=counters["prs_opened"],
                tokens_used=tokens_used,
                duration_ms=elapsed_ms,
                gated=gated,
                gate_reason=gate_reason,
                created_at=datetime.now(timezone.utc),
            )

            # Step 8: AUDIT
            await self._audit(agent, trigger, action, gate, result)

            # Step 9: NOTIFY
            if gate.allowed:
                await self._notify_owner(agent, action, artifacts)

            # Record outcome for circuit breaker
            self._safety.record_outcome(agent.id)

            return result

        except LLMBudgetExceeded as exc:
            self._safety.record_outcome(agent.id, is_error=True)
            return self._error_result(
                request, f"LLM budget exceeded: {exc}", start, tokens_used,
            )
        except LLMClientError as exc:
            self._safety.record_outcome(agent.id, is_error=True)
            return self._error_result(
                request, f"LLM error: {exc}", start, tokens_used,
            )
        except Exception as exc:
            self._safety.record_outcome(agent.id, is_error=True)
            logger.exception("Unexpected error during agent execution")
            return self._error_result(
                request, f"Internal error: {exc}", start, tokens_used,
            )

    # ------------------------------------------------------------------
    # Batch execution
    # ------------------------------------------------------------------

    async def batch_execute(
        self, request: BatchExecuteRequest
    ) -> BatchExecuteResponse:
        """
        Execute multiple agents for scheduled runs.
        """
        # Load agents
        if request.agent_ids:
            agents: list[Agent] = []
            for aid in request.agent_ids:
                ag = await self._load_agent(aid, request.org_id)
                if ag is not None:
                    agents.append(ag)
        else:
            agents = await self._load_agents_by_type(
                request.org_id, request.agent_type
            )

        results: list[AgentExecutionResult] = []
        executed = 0
        skipped = 0
        errors = 0

        for agent in agents:
            if agent.status != "active":
                skipped += 1
                continue
            if self._safety.is_agent_paused(agent.id):
                skipped += 1
                continue

            trigger = TriggerEvent(
                trigger_type=request.trigger_type,
                agent_id=agent.id,
                org_id=request.org_id,
                timestamp=datetime.now(timezone.utc),
                source="batch_scheduler",
            )
            exec_request = AgentExecutionRequest(
                request_id=str(uuid.uuid4()),
                trigger_event=trigger,
                agent=agent,
            )

            result = await self.execute(exec_request)
            results.append(result)

            if result.error:
                errors += 1
            else:
                executed += 1

        return BatchExecuteResponse(
            org_id=request.org_id,
            total_agents=len(agents),
            executed=executed,
            skipped=skipped,
            errors=errors,
            results=results,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _error_result(
        request: AgentExecutionRequest,
        error: str,
        start: float,
        tokens_used: int = 0,
    ) -> AgentExecutionResult:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return AgentExecutionResult(
            request_id=request.request_id,
            agent_id=request.trigger_event.agent_id,
            org_id=request.trigger_event.org_id,
            trigger_type=request.trigger_event.trigger_type,
            action_taken=AgentActionType.SKIP,
            confidence=0.0,
            justification=error,
            tokens_used=tokens_used,
            duration_ms=elapsed_ms,
            gated=True,
            gate_reason=error,
            error=error,
            created_at=datetime.now(timezone.utc),
        )

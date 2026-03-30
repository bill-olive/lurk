"""
LLMGateway — core service implementing PRD Section 5.2.

Responsibilities:
- Model selection logic: agent type + task complexity -> Sonnet 4.6 or Opus 4.6
- Token metering per agent and per org
- Budget enforcement
- Retry with exponential backoff
- Max 50 concurrent calls per org
- Uses the Anthropic Python SDK
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections import defaultdict
from typing import Any

import anthropic

from .metering import TokenMeter
from .models import CompletionRequest, CompletionResponse
from .prompt_manager import PromptManager

logger = logging.getLogger("llm-gateway.gateway")

# ---------------------------------------------------------------------------
# Constants (PRD Section 5.2)
# ---------------------------------------------------------------------------

MODEL_FAST = "claude-sonnet-4-6-20250514"   # Sonnet 4.6
MODEL_DEEP = "claude-opus-4-6-20250514"     # Opus 4.6

MAX_CONCURRENT_PER_ORG = 50
MAX_RETRIES = 3
BACKOFF_MS = [1000, 5000, 15000]
REQUEST_TIMEOUT_S = 120


class LLMGateway:
    """
    Centralised Claude access. All agent LLM calls are routed through this
    class, which enforces model selection, concurrency, metering, and budget.
    """

    def __init__(
        self,
        *,
        anthropic_api_key: str,
        meter: TokenMeter,
        prompt_manager: PromptManager,
    ) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=anthropic_api_key,
            timeout=REQUEST_TIMEOUT_S,
        )
        self._meter = meter
        self._prompts = prompt_manager

        # Per-org concurrency semaphores
        self._org_semaphores: dict[str, asyncio.Semaphore] = defaultdict(
            lambda: asyncio.Semaphore(MAX_CONCURRENT_PER_ORG)
        )

    async def close(self) -> None:
        await self._client.close()

    # ------------------------------------------------------------------
    # Model selection (PRD Section 5.2)
    # ------------------------------------------------------------------

    @staticmethod
    def select_model(agent_type: str, task_type: str, metadata: dict[str, Any] | None = None) -> str:
        """
        Select the appropriate Claude model.

        Rules:
        - org or function agent type -> Opus 4.6 (deep)
        - task_type == 'deep_analysis' -> Opus 4.6
        - task_type == 'multi_artifact_synthesis' with > 10 artifacts -> Opus 4.6
        - Everything else -> Sonnet 4.6 (fast)
        """
        if agent_type in ("org", "function"):
            return MODEL_DEEP

        if task_type == "deep_analysis":
            return MODEL_DEEP

        if task_type == "multi_artifact_synthesis":
            artifact_count = (metadata or {}).get("artifact_count", 0)
            if artifact_count > 10:
                return MODEL_DEEP

        if task_type == "customer_health":
            return MODEL_DEEP

        return MODEL_FAST

    # ------------------------------------------------------------------
    # Completion
    # ------------------------------------------------------------------

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """
        Execute a completion request with model selection, concurrency
        control, retry, metering, and budget enforcement.
        """
        request_id = str(uuid.uuid4())
        model = self.select_model(
            request.agent_type,
            request.task_type,
            request.metadata,
        )

        # Budget check before making the call
        budget_ok = await self._meter.check_budget(
            org_id=request.org_id,
            agent_id=request.agent_id,
        )
        if not budget_ok:
            from .main import BudgetExceededError
            raise BudgetExceededError(
                f"Token budget exceeded for org {request.org_id} / agent {request.agent_id}"
            )

        # Concurrency limiter
        semaphore = self._org_semaphores[request.org_id]
        try:
            acquired = semaphore._value > 0  # noqa: SLF001 — check without blocking
        except AttributeError:
            acquired = True

        if not acquired:
            from .main import ConcurrencyExceededError
            raise ConcurrencyExceededError(
                f"Max concurrent calls ({MAX_CONCURRENT_PER_ORG}) exceeded for org {request.org_id}"
            )

        async with semaphore:
            return await self._complete_with_retry(request, model, request_id)

    async def _complete_with_retry(
        self,
        request: CompletionRequest,
        model: str,
        request_id: str,
    ) -> CompletionResponse:
        """Call the Anthropic API with retry and backoff."""
        last_exc: Exception | None = None

        for attempt in range(MAX_RETRIES + 1):
            start = time.perf_counter()
            try:
                # Build messages
                messages: list[dict[str, Any]] = [
                    {"role": "user", "content": request.prompt},
                ]

                # Build kwargs
                kwargs: dict[str, Any] = {
                    "model": model,
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature,
                    "messages": messages,
                }
                if request.system_prompt:
                    kwargs["system"] = request.system_prompt

                response = await self._client.messages.create(**kwargs)

                latency_ms = int((time.perf_counter() - start) * 1000)

                # Extract content
                content = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        content += block.text

                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens

                # Record usage
                await self._meter.record_usage(
                    org_id=request.org_id,
                    agent_id=request.agent_id,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )

                return CompletionResponse(
                    content=content,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    finish_reason=response.stop_reason or "end_turn",
                    request_id=request_id,
                    latency_ms=latency_ms,
                )

            except anthropic.RateLimitError as exc:
                last_exc = exc
                if attempt < MAX_RETRIES:
                    backoff_s = BACKOFF_MS[attempt] / 1000
                    logger.warning(
                        "Rate limited on attempt %d/%d, backing off %.1fs",
                        attempt + 1,
                        MAX_RETRIES + 1,
                        backoff_s,
                    )
                    await asyncio.sleep(backoff_s)
                    continue
                raise

            except anthropic.APIStatusError as exc:
                last_exc = exc
                if exc.status_code >= 500 and attempt < MAX_RETRIES:
                    backoff_s = BACKOFF_MS[attempt] / 1000
                    logger.warning(
                        "API error %d on attempt %d/%d, backing off %.1fs",
                        exc.status_code,
                        attempt + 1,
                        MAX_RETRIES + 1,
                        backoff_s,
                    )
                    await asyncio.sleep(backoff_s)
                    continue
                raise

            except anthropic.APIConnectionError as exc:
                last_exc = exc
                if attempt < MAX_RETRIES:
                    backoff_s = BACKOFF_MS[attempt] / 1000
                    logger.warning(
                        "Connection error on attempt %d/%d: %s — backing off %.1fs",
                        attempt + 1,
                        MAX_RETRIES + 1,
                        exc,
                        backoff_s,
                    )
                    await asyncio.sleep(backoff_s)
                    continue
                raise

        raise RuntimeError(
            f"Completion failed after {MAX_RETRIES + 1} attempts: {last_exc}"
        )

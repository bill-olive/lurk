"""
HTTP client for calling the LLM Gateway service.

Handles retries with exponential backoff, timeouts, and structured
error responses so that the agent executor never has to deal with raw
HTTP failures.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger("agent-orchestrator.llm_client")

# Retry backoff schedule in seconds (matches PRD 5.2 retryPolicy)
_BACKOFF_SECONDS = [1.0, 5.0, 15.0]
_REQUEST_TIMEOUT = 120.0  # seconds — matches PRD 120 000 ms


class LLMClientError(Exception):
    """Raised when the LLM Gateway returns a non-retryable error."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class LLMBudgetExceeded(LLMClientError):
    """Raised when the org/agent token budget is exhausted."""


class LLMClient:
    """Thin async wrapper around the LLM Gateway HTTP API."""

    def __init__(self, gateway_url: str) -> None:
        self._gateway_url = gateway_url.rstrip("/")
        self._http = httpx.AsyncClient(
            base_url=self._gateway_url,
            timeout=httpx.Timeout(_REQUEST_TIMEOUT, connect=10.0),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def complete(
        self,
        *,
        agent_id: str,
        agent_type: str,
        org_id: str,
        task_type: str,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Send a completion request to the LLM Gateway.

        Returns the parsed JSON body which includes at minimum:
            - content: str
            - model: str
            - input_tokens: int
            - output_tokens: int
        """
        payload: dict[str, Any] = {
            "agent_id": agent_id,
            "agent_type": agent_type,
            "org_id": org_id,
            "task_type": task_type,
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system_prompt is not None:
            payload["system_prompt"] = system_prompt
        if metadata is not None:
            payload["metadata"] = metadata

        return await self._post_with_retry("/v1/llm/complete", payload)

    async def tts(
        self,
        *,
        text: str,
        voice: str = "nova",
        org_id: str,
    ) -> bytes:
        """
        Generate TTS audio via the LLM Gateway.

        Returns raw audio bytes (Opus format).
        """
        payload = {
            "text": text,
            "voice": voice,
            "org_id": org_id,
        }
        return await self._post_with_retry_bytes("/v1/llm/tts", payload)

    async def get_usage(self, org_id: str) -> dict[str, Any]:
        """Retrieve token usage stats for an org."""
        resp = await self._http.get(
            "/v1/llm/usage",
            params={"org_id": org_id},
        )
        resp.raise_for_status()
        return resp.json()

    async def close(self) -> None:
        await self._http.aclose()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _post_with_retry(
        self,
        path: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        last_exc: Exception | None = None

        for attempt, backoff in enumerate(_backoff_schedule()):
            try:
                resp = await self._http.post(path, json=payload)

                if resp.status_code == 429:
                    body = resp.json()
                    if body.get("error_type") == "budget_exceeded":
                        raise LLMBudgetExceeded(
                            body.get("detail", "Token budget exceeded"),
                            status_code=429,
                        )
                    # Rate limited — retry after backoff
                    logger.warning(
                        "Rate limited on attempt %d, backing off %.1fs",
                        attempt + 1,
                        backoff,
                    )
                    await _async_sleep(backoff)
                    continue

                if resp.status_code >= 500:
                    logger.warning(
                        "Gateway returned %d on attempt %d, backing off %.1fs",
                        resp.status_code,
                        attempt + 1,
                        backoff,
                    )
                    await _async_sleep(backoff)
                    continue

                if resp.status_code >= 400:
                    body = resp.json()
                    raise LLMClientError(
                        body.get("detail", f"HTTP {resp.status_code}"),
                        status_code=resp.status_code,
                    )

                return resp.json()

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
                logger.warning(
                    "Network error on attempt %d: %s — backing off %.1fs",
                    attempt + 1,
                    exc,
                    backoff,
                )
                last_exc = exc
                await _async_sleep(backoff)

        raise LLMClientError(
            f"LLM Gateway request failed after {len(_BACKOFF_SECONDS) + 1} attempts: {last_exc}"
        )

    async def _post_with_retry_bytes(
        self,
        path: str,
        payload: dict[str, Any],
    ) -> bytes:
        """Same retry logic but returns raw bytes (for audio)."""
        last_exc: Exception | None = None

        for attempt, backoff in enumerate(_backoff_schedule()):
            try:
                resp = await self._http.post(path, json=payload)

                if resp.status_code >= 500 or resp.status_code == 429:
                    logger.warning(
                        "TTS request returned %d on attempt %d, backing off %.1fs",
                        resp.status_code,
                        attempt + 1,
                        backoff,
                    )
                    await _async_sleep(backoff)
                    continue

                if resp.status_code >= 400:
                    raise LLMClientError(
                        f"TTS request failed: HTTP {resp.status_code}",
                        status_code=resp.status_code,
                    )

                return resp.content

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
                last_exc = exc
                await _async_sleep(backoff)

        raise LLMClientError(
            f"TTS request failed after {len(_BACKOFF_SECONDS) + 1} attempts: {last_exc}"
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _backoff_schedule() -> list[float]:
    """Return the full backoff schedule including the initial immediate attempt."""
    return [0.0] + list(_BACKOFF_SECONDS)


async def _async_sleep(seconds: float) -> None:
    if seconds <= 0:
        return
    import asyncio
    await asyncio.sleep(seconds)

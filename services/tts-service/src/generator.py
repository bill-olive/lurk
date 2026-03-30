"""TTSGenerator -- text-to-speech generation engine.

Implements PRD Section 5.2 TTS configuration:
  - OpenAI tts-1-hd model
  - Voice: nova (configurable)
  - Max 4096 chars input
  - Output: opus format
  - Upload to GCS, return CDN URL
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal

from google.cloud import storage as gcs
from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_INPUT_LENGTH = 4096
DEFAULT_MODEL = "tts-1-hd"
DEFAULT_VOICE = "nova"
DEFAULT_FORMAT = "opus"

SUPPORTED_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
SUPPORTED_FORMATS = {"opus", "mp3", "aac", "flac", "wav", "pcm"}


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class TTSResult:
    """Result of a TTS generation."""

    audio_url: str
    duration_estimate_seconds: float
    format: str
    voice: str
    model: str
    input_length: int
    content_hash: str
    gcs_path: str


@dataclass
class TTSConfig:
    """Configuration for a TTS generation request."""

    model: str = DEFAULT_MODEL
    voice: str = DEFAULT_VOICE
    format: str = DEFAULT_FORMAT
    speed: float = 1.0  # 0.25 to 4.0


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

@dataclass
class TTSGenerator:
    """Generates speech audio from text using OpenAI TTS and stores in GCS."""

    _client: OpenAI | None = field(default=None, init=False, repr=False)
    _gcs_client: gcs.Client | None = field(default=None, init=False, repr=False)
    _bucket_name: str = field(
        default_factory=lambda: os.environ.get("TTS_GCS_BUCKET", "lurk-tts-audio")
    )
    _cdn_base_url: str = field(
        default_factory=lambda: os.environ.get(
            "TTS_CDN_BASE_URL", "https://cdn.lurk.dev/tts"
        )
    )

    # ------------------------------------------------------------------
    # Lazy initialisation
    # ------------------------------------------------------------------

    def _get_openai(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI()  # uses OPENAI_API_KEY env var
        return self._client

    def _get_gcs(self) -> gcs.Client:
        if self._gcs_client is None:
            self._gcs_client = gcs.Client()
        return self._gcs_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate(
        self,
        text: str,
        *,
        config: TTSConfig | None = None,
        path_prefix: str = "general",
    ) -> TTSResult:
        """Generate speech from text, upload to GCS, return CDN URL.

        Parameters
        ----------
        text:
            Input text (max 4096 characters).
        config:
            Optional TTS configuration overrides.
        path_prefix:
            GCS path prefix for organisation (e.g., "pr", "meeting").

        Returns
        -------
        TTSResult with the CDN URL and metadata.

        Raises
        ------
        ValueError:
            If input exceeds max length or invalid config.
        """
        cfg = config or TTSConfig()
        self._validate_input(text, cfg)

        # Content hash for dedup/caching
        content_hash = hashlib.sha256(
            f"{text}:{cfg.model}:{cfg.voice}:{cfg.speed}".encode()
        ).hexdigest()[:16]

        # Check if already generated (cache hit)
        gcs_path = f"{path_prefix}/{content_hash}.{cfg.format}"
        existing_url = self._check_cache(gcs_path)
        if existing_url:
            logger.info("TTS cache hit: %s", gcs_path)
            return TTSResult(
                audio_url=existing_url,
                duration_estimate_seconds=self._estimate_duration(text, cfg.speed),
                format=cfg.format,
                voice=cfg.voice,
                model=cfg.model,
                input_length=len(text),
                content_hash=content_hash,
                gcs_path=gcs_path,
            )

        # Generate audio via OpenAI
        logger.info(
            "Generating TTS: model=%s voice=%s format=%s len=%d",
            cfg.model,
            cfg.voice,
            cfg.format,
            len(text),
        )

        client = self._get_openai()
        response = client.audio.speech.create(
            model=cfg.model,
            voice=cfg.voice,  # type: ignore[arg-type]
            input=text,
            response_format=cfg.format,  # type: ignore[arg-type]
            speed=cfg.speed,
        )

        # Read audio bytes
        audio_bytes = response.content

        # Upload to GCS
        audio_url = self._upload_to_gcs(audio_bytes, gcs_path, cfg.format)

        return TTSResult(
            audio_url=audio_url,
            duration_estimate_seconds=self._estimate_duration(text, cfg.speed),
            format=cfg.format,
            voice=cfg.voice,
            model=cfg.model,
            input_length=len(text),
            content_hash=content_hash,
            gcs_path=gcs_path,
        )

    async def generate_pr_narration(
        self,
        *,
        pr_title: str,
        pr_summary: str,
        key_changes: list[str],
        author: str,
        config: TTSConfig | None = None,
    ) -> TTSResult:
        """Generate a voice narration for a pull request.

        Constructs a natural-sounding script from PR metadata and generates
        audio.
        """
        changes_text = ""
        if key_changes:
            changes_list = ". ".join(key_changes)
            changes_text = f" Key changes include: {changes_list}."

        script = (
            f"Pull request by {author}: {pr_title}. "
            f"{pr_summary}"
            f"{changes_text}"
        )

        # Truncate to max length
        if len(script) > MAX_INPUT_LENGTH:
            script = script[: MAX_INPUT_LENGTH - 3] + "..."

        return await self.generate(script, config=config, path_prefix="pr")

    async def generate_meeting_summary(
        self,
        *,
        meeting_title: str,
        summary: str,
        action_items: list[str],
        decisions: list[str],
        config: TTSConfig | None = None,
    ) -> TTSResult:
        """Generate a voice narration for a meeting summary."""
        parts = [f"Meeting summary: {meeting_title}. {summary}"]

        if decisions:
            decisions_text = ". ".join(decisions)
            parts.append(f"Key decisions: {decisions_text}.")

        if action_items:
            items_text = ". ".join(action_items)
            parts.append(f"Action items: {items_text}.")

        script = " ".join(parts)

        if len(script) > MAX_INPUT_LENGTH:
            script = script[: MAX_INPUT_LENGTH - 3] + "..."

        return await self.generate(
            script, config=config, path_prefix="meeting"
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_input(text: str, config: TTSConfig) -> None:
        if not text or not text.strip():
            raise ValueError("Input text must not be empty")

        if len(text) > MAX_INPUT_LENGTH:
            raise ValueError(
                f"Input text exceeds maximum length of {MAX_INPUT_LENGTH} characters "
                f"(got {len(text)})"
            )

        if config.voice not in SUPPORTED_VOICES:
            raise ValueError(
                f"Unsupported voice '{config.voice}'. "
                f"Supported: {', '.join(sorted(SUPPORTED_VOICES))}"
            )

        if config.format not in SUPPORTED_FORMATS:
            raise ValueError(
                f"Unsupported format '{config.format}'. "
                f"Supported: {', '.join(sorted(SUPPORTED_FORMATS))}"
            )

        if not (0.25 <= config.speed <= 4.0):
            raise ValueError(
                f"Speed must be between 0.25 and 4.0 (got {config.speed})"
            )

    # ------------------------------------------------------------------
    # GCS operations
    # ------------------------------------------------------------------

    def _check_cache(self, gcs_path: str) -> str | None:
        """Check if audio already exists in GCS. Return CDN URL if so."""
        try:
            gcs_client = self._get_gcs()
            bucket = gcs_client.bucket(self._bucket_name)
            blob = bucket.blob(gcs_path)
            if blob.exists():
                return f"{self._cdn_base_url}/{gcs_path}"
        except Exception:
            logger.debug("GCS cache check failed", exc_info=True)
        return None

    def _upload_to_gcs(
        self, audio_bytes: bytes, gcs_path: str, audio_format: str
    ) -> str:
        """Upload audio bytes to GCS and return the CDN URL."""
        content_type_map = {
            "opus": "audio/opus",
            "mp3": "audio/mpeg",
            "aac": "audio/aac",
            "flac": "audio/flac",
            "wav": "audio/wav",
            "pcm": "audio/pcm",
        }

        try:
            gcs_client = self._get_gcs()
            bucket = gcs_client.bucket(self._bucket_name)
            blob = bucket.blob(gcs_path)

            blob.upload_from_string(
                audio_bytes,
                content_type=content_type_map.get(audio_format, "application/octet-stream"),
            )

            # Set cache control for CDN
            blob.cache_control = "public, max-age=31536000, immutable"
            blob.patch()

            cdn_url = f"{self._cdn_base_url}/{gcs_path}"
            logger.info("Uploaded TTS audio to %s (%d bytes)", cdn_url, len(audio_bytes))
            return cdn_url

        except Exception as exc:
            logger.error("Failed to upload to GCS: %s", exc, exc_info=True)
            raise RuntimeError(f"GCS upload failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _estimate_duration(text: str, speed: float) -> float:
        """Estimate audio duration in seconds.

        Average English speech is ~150 words per minute.
        """
        word_count = len(text.split())
        base_duration = (word_count / 150) * 60  # seconds
        return round(base_duration / speed, 1)

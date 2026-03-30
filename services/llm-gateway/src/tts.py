"""
TTSService — text-to-speech via OpenAI tts-1-hd (PRD Section 5.2).

Configuration:
- Provider: OpenAI
- Model: tts-1-hd
- Voice: nova (configurable)
- Output format: opus
- Max input: 4096 characters
- Use case: voice narration of PR summaries for iOS review
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

import openai

from .models import TTSRequest, TTSResponse

logger = logging.getLogger("llm-gateway.tts")

# Supported voices (OpenAI TTS)
SUPPORTED_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
DEFAULT_VOICE = "nova"
MODEL = "tts-1-hd"
MAX_INPUT_CHARS = 4096


class TTSService:
    """
    Text-to-speech service using OpenAI's tts-1-hd model.

    Generates voice narration for PR summaries that can be delivered
    as audio attachments to iOS push notifications.
    """

    def __init__(self, openai_api_key: str) -> None:
        self._client = openai.AsyncOpenAI(api_key=openai_api_key)

    async def generate(
        self,
        request: TTSRequest,
    ) -> tuple[bytes, TTSResponse]:
        """
        Generate TTS audio from text.

        Returns (audio_bytes, metadata).
        """
        request_id = str(uuid.uuid4())

        # Validate and sanitise input
        text = request.text.strip()
        if not text:
            raise ValueError("TTS input text cannot be empty")
        if len(text) > MAX_INPUT_CHARS:
            logger.warning(
                "TTS input truncated from %d to %d chars",
                len(text),
                MAX_INPUT_CHARS,
            )
            text = text[:MAX_INPUT_CHARS]

        voice = request.voice.lower()
        if voice not in SUPPORTED_VOICES:
            logger.warning(
                "Unsupported voice '%s', falling back to '%s'",
                voice,
                DEFAULT_VOICE,
            )
            voice = DEFAULT_VOICE

        # Map output format to OpenAI's response_format values
        format_map = {
            "opus": "opus",
            "mp3": "mp3",
            "aac": "aac",
            "flac": "flac",
            "wav": "wav",
            "pcm": "pcm",
        }
        output_format = format_map.get(request.output_format, "opus")

        try:
            response = await self._client.audio.speech.create(
                model=MODEL,
                voice=voice,
                input=text,
                response_format=output_format,
            )

            # Read the audio bytes from the streaming response
            audio_bytes = response.content

            # Estimate duration (rough heuristic: ~150 words/min, ~5 chars/word)
            word_count = len(text.split())
            duration_estimate = word_count / 150 * 60  # seconds

            metadata = TTSResponse(
                audio_size_bytes=len(audio_bytes),
                voice=voice,
                model=MODEL,
                duration_estimate_seconds=round(duration_estimate, 1),
                request_id=request_id,
            )

            logger.info(
                "TTS generated: %d bytes, voice=%s, format=%s, request=%s",
                len(audio_bytes),
                voice,
                output_format,
                request_id,
            )

            return audio_bytes, metadata

        except openai.RateLimitError as exc:
            logger.error("OpenAI TTS rate limited: %s", exc)
            raise
        except openai.APIError as exc:
            logger.error("OpenAI TTS API error: %s", exc)
            raise
        except Exception as exc:
            logger.exception("TTS generation failed unexpectedly")
            raise RuntimeError(f"TTS generation failed: {exc}") from exc

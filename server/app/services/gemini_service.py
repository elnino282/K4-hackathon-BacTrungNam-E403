"""Official Google Gemini SDK adapter used by AI-facing services."""

import base64
import binascii
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

from google import genai
from google.genai import types


logger = logging.getLogger("uvicorn")


class GeminiConfigurationError(RuntimeError):
    """Raised when required Gemini settings are unavailable."""


class GeminiProviderError(RuntimeError):
    """Raised without provider details so callers can return safe fallbacks."""


@dataclass(frozen=True)
class GeminiConfiguration:
    api_key: str
    model: str


def get_gemini_configuration() -> GeminiConfiguration:
    """Read the required Gemini configuration without logging its secret."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "").strip()
    missing = [
        name
        for name, value in (("GEMINI_API_KEY", api_key), ("GEMINI_MODEL", model))
        if not value
    ]
    if missing:
        raise GeminiConfigurationError(
            "Missing required Gemini environment variable(s): " + ", ".join(missing)
        )
    return GeminiConfiguration(api_key=api_key, model=model)


def _to_gemini_parts(content: list[dict[str, Any]]) -> list[types.Part]:
    parts: list[types.Part] = []
    for item in content:
        if item.get("type") == "text":
            text = item.get("text")
            if isinstance(text, str) and text:
                parts.append(types.Part.from_text(text=text))
            continue

        if item.get("type") == "image_url":
            image_url = item.get("image_url", {})
            url = image_url.get("url") if isinstance(image_url, dict) else None
            supported_prefixes = {
                "data:image/png;base64,": "image/png",
                "data:image/jpeg;base64,": "image/jpeg",
            }
            prefix = next(
                (
                    candidate
                    for candidate in supported_prefixes
                    if isinstance(url, str) and url.startswith(candidate)
                ),
                None,
            )
            if prefix is None:
                raise ValueError(
                    "Gemini adapter only accepts inline PNG or JPEG image data"
                )
            try:
                image_bytes = base64.b64decode(url[len(prefix) :], validate=True)
            except (ValueError, binascii.Error) as error:
                raise ValueError("Gemini adapter received invalid inline image data") from error
            parts.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=supported_prefixes[prefix],
                )
            )
            continue

        raise ValueError("Gemini adapter received unsupported content")

    if not parts:
        raise ValueError("Gemini adapter requires at least one content part")
    return parts


def _to_gemini_contents(messages: list[dict[str, Any]]) -> list[types.Content]:
    contents: list[types.Content] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        if role not in {"user", "assistant"}:
            raise ValueError("Gemini adapter received unsupported message role")
        if isinstance(content, str):
            parts = [types.Part.from_text(text=content)]
        elif isinstance(content, list):
            parts = _to_gemini_parts(content)
        else:
            raise ValueError("Gemini adapter received invalid message content")
        contents.append(types.Content(role="model" if role == "assistant" else "user", parts=parts))
    if not contents:
        raise ValueError("Gemini adapter requires at least one message")
    return contents


async def generate_content(
    *,
    system_instruction: str,
    messages: list[dict[str, Any]],
    temperature: float,
    response_mime_type: Optional[str] = None,
) -> str:
    """Generate text with Gemini using text and inline PNG/JPEG content."""
    configuration = get_gemini_configuration()
    config_kwargs: dict[str, Any] = {
        "system_instruction": system_instruction,
        "temperature": temperature,
    }
    if response_mime_type:
        config_kwargs["response_mime_type"] = response_mime_type

    client = genai.Client(api_key=configuration.api_key)
    try:
        response = await client.aio.models.generate_content(
            model=configuration.model,
            contents=_to_gemini_contents(messages),
            config=types.GenerateContentConfig(**config_kwargs),
        )
        text = response.text
        if not isinstance(text, str) or not text.strip():
            raise GeminiProviderError("Gemini returned no text content")
        return text.strip()
    except GeminiProviderError:
        raise
    except Exception as error:
        logger.warning("Gemini request failed (%s)", type(error).__name__)
        raise GeminiProviderError("Gemini request failed") from None
    finally:
        await client.aio.aclose()

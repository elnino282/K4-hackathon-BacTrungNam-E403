"""AI provider adapter used by every AI-facing service.

The product can call Google Gemini directly or an OpenAI-compatible gateway
such as XAH.  Keeping this decision here prevents summary, tutor, note and
study flows from drifting into separate provider implementations.
"""

import base64
import binascii
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

import httpx
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
    base_url: Optional[str] = None

    @property
    def uses_openai_gateway(self) -> bool:
        return bool(self.base_url)


def get_gemini_configuration() -> GeminiConfiguration:
    """Read provider configuration without logging its secret.

    ``AI_*`` is the preferred provider-neutral configuration.  ``GEMINI_*``
    remains supported so existing teammates can still use the official SDK.
    """
    api_key = (
        os.getenv("AI_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    model = (
        os.getenv("AI_MODEL", "").strip()
        or os.getenv("GEMINI_MODEL", "").strip()
    )
    base_url = os.getenv("AI_BASE_URL", "").strip().rstrip("/") or None
    missing = [
        name
        for name, value in (("AI_API_KEY/GEMINI_API_KEY", api_key), ("AI_MODEL/GEMINI_MODEL", model))
        if not value
    ]
    if missing:
        raise GeminiConfigurationError(
            "Missing required Gemini environment variable(s): " + ", ".join(missing)
        )
    return GeminiConfiguration(api_key=api_key, model=model, base_url=base_url)


async def _generate_with_openai_gateway(
    *,
    configuration: GeminiConfiguration,
    system_instruction: str,
    messages: list[dict[str, Any]],
    temperature: float,
) -> str:
    """Call an OpenAI-compatible chat-completions endpoint.

    XAH accepts the same text and inline ``image_url`` message shape already
    used by the rest of the backend, so no lossy content conversion is needed.
    """
    payload = {
        "model": configuration.model,
        "messages": [
            {"role": "system", "content": system_instruction},
            *messages,
        ],
        "temperature": temperature,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {configuration.api_key}",
        "Content-Type": "application/json; charset=utf-8",
    }
    timeout = httpx.Timeout(120.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{configuration.base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise GeminiProviderError("AI gateway returned an invalid response") from error
    if not isinstance(text, str) or not text.strip():
        raise GeminiProviderError("AI gateway returned no text content")
    return text.strip()


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
    """Generate text using text and optional inline PNG/JPEG content."""
    configuration = get_gemini_configuration()
    if configuration.uses_openai_gateway:
        try:
            return await _generate_with_openai_gateway(
                configuration=configuration,
                system_instruction=system_instruction,
                messages=messages,
                temperature=temperature,
            )
        except GeminiProviderError:
            raise
        except Exception as error:
            logger.warning("AI gateway request failed (%s)", type(error).__name__)
            raise GeminiProviderError("AI gateway request failed") from None

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

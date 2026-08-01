import asyncio
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.gemini_service import (
    GeminiConfigurationError,
    generate_content,
    get_gemini_configuration,
)
from app.main import app
from fastapi.testclient import TestClient


class GeminiConfigurationTest(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_configuration_reports_each_missing_required_variable(self):
        with self.assertRaisesRegex(
            GeminiConfigurationError,
            "AI_API_KEY/GEMINI_API_KEY.*AI_MODEL/GEMINI_MODEL",
        ):
            get_gemini_configuration()

    @patch.dict(
        os.environ,
        {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "gemini-test"},
        clear=True,
    )
    def test_configuration_returns_required_values(self):
        configuration = get_gemini_configuration()

        self.assertEqual(configuration.api_key, "test-key")
        self.assertEqual(configuration.model, "gemini-test")
        self.assertIsNone(configuration.base_url)

    @patch.dict(
        os.environ,
        {
            "AI_API_KEY": "gateway-key",
            "AI_MODEL": "provider/model",
            "AI_BASE_URL": "https://gateway.example/v1/",
        },
        clear=True,
    )
    def test_configuration_prefers_provider_neutral_gateway_values(self):
        configuration = get_gemini_configuration()

        self.assertEqual(configuration.api_key, "gateway-key")
        self.assertEqual(configuration.model, "provider/model")
        self.assertEqual(configuration.base_url, "https://gateway.example/v1")
        self.assertTrue(configuration.uses_openai_gateway)

    @patch.dict(os.environ, {}, clear=True)
    def test_startup_fails_with_clear_missing_configuration_error(self):
        with self.assertRaisesRegex(GeminiConfigurationError, "AI_API_KEY/GEMINI_API_KEY"):
            with TestClient(app):
                pass

    @patch.dict(
        os.environ,
        {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "gemini-test"},
        clear=True,
    )
    @patch("app.services.gemini_service.genai.Client")
    def test_adapter_uses_official_sdk_for_text_png_and_jpeg_parts(self, client_factory):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(
            return_value=MagicMock(text="Gemini response")
        )
        client.aio.aclose = AsyncMock()
        client_factory.return_value = client

        result = asyncio.run(
            generate_content(
                system_instruction="Be concise.",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": "Describe this image."},
                    {"type": "image_url", "image_url": {
                        "url": "data:image/png;base64,aGVsbG8=",
                    }},
                    {"type": "image_url", "image_url": {
                        "url": "data:image/jpeg;base64,aGVsbG8=",
                    }},
                ]}],
                temperature=0.2,
            )
        )

        self.assertEqual(result, "Gemini response")
        client_factory.assert_called_once_with(api_key="test-key")
        client.aio.models.generate_content.assert_awaited_once()
        client.aio.aclose.assert_awaited_once()

    @patch.dict(
        os.environ,
        {
            "AI_API_KEY": "gateway-key",
            "AI_MODEL": "provider/model",
            "AI_BASE_URL": "https://gateway.example/v1",
        },
        clear=True,
    )
    @patch("app.services.gemini_service.httpx.AsyncClient")
    def test_adapter_uses_openai_gateway_with_utf8_messages(self, client_factory):
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = {
            "choices": [{"message": {"content": "Phản hồi tiếng Việt"}}]
        }
        client = MagicMock()
        client.post = AsyncMock(return_value=response)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client_factory.return_value = client

        result = asyncio.run(
            generate_content(
                system_instruction="Trả lời bằng tiếng Việt.",
                messages=[{"role": "user", "content": "Giải thích từ dữ liệu nguồn."}],
                temperature=0.1,
                response_mime_type="application/json",
            )
        )

        self.assertEqual(result, "Phản hồi tiếng Việt")
        request = client.post.await_args
        self.assertEqual(
            request.args[0],
            "https://gateway.example/v1/chat/completions",
        )
        self.assertEqual(request.kwargs["headers"]["Authorization"], "Bearer gateway-key")
        self.assertEqual(request.kwargs["json"]["model"], "provider/model")
        self.assertEqual(
            request.kwargs["json"]["messages"][0],
            {"role": "system", "content": "Trả lời bằng tiếng Việt."},
        )


if __name__ == "__main__":
    unittest.main()

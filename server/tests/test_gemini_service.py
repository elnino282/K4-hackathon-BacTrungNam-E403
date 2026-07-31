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
            "GEMINI_API_KEY, GEMINI_MODEL",
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

    @patch.dict(os.environ, {}, clear=True)
    def test_startup_fails_with_clear_missing_configuration_error(self):
        with self.assertRaisesRegex(GeminiConfigurationError, "GEMINI_API_KEY, GEMINI_MODEL"):
            with TestClient(app):
                pass

    @patch.dict(
        os.environ,
        {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "gemini-test"},
        clear=True,
    )
    @patch("app.services.gemini_service.genai.Client")
    def test_adapter_uses_official_sdk_for_text_and_png_parts(self, client_factory):
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
                ]}],
                temperature=0.2,
            )
        )

        self.assertEqual(result, "Gemini response")
        client_factory.assert_called_once_with(api_key="test-key")
        client.aio.models.generate_content.assert_awaited_once()
        client.aio.aclose.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

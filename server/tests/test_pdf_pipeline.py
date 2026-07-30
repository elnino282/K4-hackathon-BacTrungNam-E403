import asyncio
import json
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.summary import SummaryRequest
from app.schemas.tutor import TutorChatRequest
from app.services.pdf_service import (
    PARSER_VERSION,
    extract_pdf_to_json,
    render_pdf_page,
)
from app.services.summary_service import (
    _post_chat_completion,
    generate_summary,
)
from app.services.tutor_service import chat_with_tutor


class PdfPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = extract_pdf_to_json("lesson-01")

    def test_parser_produces_clean_compatible_payload(self):
        self.assertEqual(self.data["parser_version"], PARSER_VERSION)
        self.assertEqual(self.data["total_pages"], 44)
        self.assertEqual(self.data["pages_with_warnings"], 0)

        first_page = self.data["pages"][0]
        self.assertEqual(
            first_page["title"],
            "Xác Định Bài Toán Kinh Doanh Cho AI",
        )
        self.assertEqual(first_page["text"], first_page["clean_text"])
        self.assertIn("layout_text", first_page)

    def test_render_page_for_multimodal_context(self):
        image_path = render_pdf_page("lesson-01", 22)
        self.assertTrue(image_path.exists())
        self.assertGreater(image_path.stat().st_size, 100_000)

    def test_summary_request_contains_system_prompt_text_and_image(self):
        captured_request = {}

        def fake_post(url, api_key, payload):
            captured_request.update(
                {
                    "url": url,
                    "api_key": api_key,
                    "body": payload,
                }
            )
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Tóm tắt kiểm thử.",
                                    "key_points": ["Điểm kiểm thử — Trang 22"],
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            }

        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.summary_service._post_chat_completion",
                side_effect=fake_post,
            ):
                result = asyncio.run(
                    generate_summary(
                        SummaryRequest(
                            doc_id="lesson-01",
                            current_page=22,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(result.provider, "xah")
        self.assertEqual(result.summary, "Tóm tắt kiểm thử.")

        self.assertTrue(captured_request["url"].endswith("/chat/completions"))
        messages = captured_request["body"]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("JSON", messages[0]["content"])
        parts = messages[1]["content"]
        self.assertEqual(
            sum(part["type"] == "image_url" for part in parts),
            1,
        )

    def test_regression_summary_uses_requested_page_7_not_current_page_5(self):
        captured_request = {}

        def fake_post(url, api_key, payload):
            captured_request["body"] = payload
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Nội dung kiểm thử trang 7.",
                                    "key_points": ["Ý kiểm thử — Trang 7"],
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            }

        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.summary_service._post_chat_completion",
                side_effect=fake_post,
            ):
                result = asyncio.run(
                    generate_summary(
                        SummaryRequest(
                            doc_id="lesson-01",
                            current_page=7,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(result.provider, "xah")
        self.assertEqual(result.scope_description, "Trang 7")
        user_parts = captured_request["body"]["messages"][1]["content"]
        text_part = next(
            part["text"] for part in user_parts if part["type"] == "text"
        )
        self.assertIn('<slide page="7"', text_part)
        self.assertNotIn('<slide page="5"', text_part)
        self.assertEqual(
            sum(part["type"] == "image_url" for part in user_parts),
            1,
        )

    def test_xah_transport_serializes_vietnamese_as_ascii_safe_json(self):
        captured = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def read(self):
                return b'{"choices":[]}'

        def fake_urlopen(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse()

        payload = {
            "model": "test",
            "messages": [
                {
                    "role": "user",
                    "content": "Ử và Ủ là dữ liệu tiếng Việt cần gửi nguyên vẹn.",
                }
            ],
        }
        with patch(
            "app.services.summary_service.urllib.request.urlopen",
            side_effect=fake_urlopen,
        ):
            result = _post_chat_completion(
                "https://example.test/chat/completions",
                "test-key",
                payload,
            )

        request_bytes = captured["request"].data
        self.assertEqual(result, {"choices": []})
        self.assertEqual(captured["timeout"], 90)
        self.assertTrue(all(byte < 128 for byte in request_bytes))
        self.assertEqual(
            json.loads(request_bytes.decode("ascii")),
            payload,
        )

    def test_summary_http_endpoint_returns_page_7_result(self):
        def fake_post(url, api_key, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Trang 7 được chọn chính xác.",
                                    "key_points": ["Kiểm thử HTTP — Trang 7"],
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            }

        with patch(
            "app.services.summary_service._post_chat_completion",
            side_effect=fake_post,
        ):
            with TestClient(app) as client:
                response = client.post(
                    "/api/summaries/generate",
                    json={
                        "doc_id": "lesson-01",
                        "current_page": 7,
                        "language": "VI",
                    },
                )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["provider"], "xah")
        self.assertEqual(body["scope_description"], "Trang 7")
        self.assertEqual(body["summary"], "Trang 7 được chọn chính xác.")

    def test_tutor_uses_real_slide_context_in_xah_request(self):
        captured_request = {}

        def fake_post(url, api_key, payload):
            captured_request["body"] = payload
            return {
                "choices": [
                    {
                        "message": {
                            "content": "Slide này đặt câu hỏi mở đầu về nguyên nhân một AI agent không scale — Trang 2."
                        }
                    }
                ]
            }

        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.tutor_service._post_chat_completion",
                side_effect=fake_post,
            ):
                result = asyncio.run(
                    chat_with_tutor(
                        TutorChatRequest(
                            message="Slide nói về điều gì?",
                            page_context=2,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(result.provider, "xah")
        messages = captured_request["body"]["messages"]
        user_parts = messages[1]["content"]
        self.assertIn("HÃY SUY NGHĨ", user_parts[0]["text"])
        self.assertEqual(
            sum(part["type"] == "image_url" for part in user_parts),
            1,
        )


if __name__ == "__main__":
    unittest.main()

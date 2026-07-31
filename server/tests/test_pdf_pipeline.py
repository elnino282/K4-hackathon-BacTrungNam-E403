import asyncio
import json
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.summary import SummaryRequest
from app.schemas.tutor import TutorChatRequest
from app.services.evidence_service import build_source_passages, verify_key_points
from app.services.pdf_service import PARSER_VERSION, extract_pdf_to_json
from app.services.summary_service import _clear_summary_cache, generate_summary
from app.services.tutor_service import chat_with_tutor


class PdfPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = extract_pdf_to_json("lesson-01")

    def setUp(self):
        _clear_summary_cache()
        self.environment = patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "gemini-test"},
            clear=False,
        )
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    def test_parser_produces_clean_compatible_payload(self):
        self.assertEqual(self.data["parser_version"], PARSER_VERSION)
        self.assertEqual(self.data["total_pages"], 44)
        self.assertEqual(self.data["pages_with_warnings"], 0)

    def test_summary_request_rejects_ambiguous_scope(self):
        with self.assertRaises(ValidationError):
            SummaryRequest(current_page=1, start_page=1, end_page=2)

    def test_evidence_verifier_rejects_wrong_page(self):
        pages = self.data["pages"]
        verified, rejected = verify_key_points(
            [{
                "claim": "Nguồn sai trang.",
                "page": 12,
                "evidence_quote": "6 Giai Đoạn Phát Triển AI Product",
            }],
            [pages[10], pages[11]],
        )
        self.assertEqual(verified, [])
        self.assertEqual(rejected[0]["reason"], "evidence_not_found_on_page")

    def test_summary_preserves_evidence_validation_and_cache(self):
        passages = build_source_passages([self.data["pages"][36]])
        response = json.dumps({
            "summary": "Trang mở đầu phần thực hành Lab 2.",
            "key_points": [{
                "claim": "Lab 2 yêu cầu chọn use case, viết PS và quyết định go/no-go.",
                "page": 37,
                "source_id": passages[0]["source_id"],
            }],
        }, ensure_ascii=False)
        with patch(
            "app.services.summary_service.generate_content", return_value=response
        ) as mocked_generate:
            request = SummaryRequest(doc_id="lesson-01", current_page=37, language="VI")
            first = asyncio.run(generate_summary(request))
            second = asyncio.run(generate_summary(request))
        self.assertEqual(first.provider, "gemini")
        self.assertEqual(first.status, "verified")
        self.assertFalse(first.cached)
        self.assertTrue(second.cached)
        self.assertEqual(mocked_generate.call_count, 1)

    def test_summary_provider_failure_returns_safe_fallback(self):
        with patch(
            "app.services.summary_service.generate_content",
            side_effect=RuntimeError("provider secret detail"),
        ):
            result = asyncio.run(
                generate_summary(SummaryRequest(doc_id="lesson-01", current_page=7))
            )
        self.assertEqual(result.provider, "mock")
        self.assertNotIn("provider secret detail", result.notice)

    def test_summary_http_endpoint_preserves_response_shape(self):
        response = json.dumps({
            "summary": "Trang 7 được chọn chính xác.",
            "key_points": [{
                "claim": "Adoption tăng nhưng scale vẫn khó.",
                "page": 7,
                "evidence_quote": "AI 2025: Adoption tăng nhanh, scale vẫn khó",
            }],
        }, ensure_ascii=False)
        with patch("app.services.summary_service.generate_content", return_value=response):
            with TestClient(app) as client:
                result = client.post(
                    "/api/summaries/generate",
                    json={"doc_id": "lesson-01", "current_page": 7, "language": "VI"},
                )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["provider"], "gemini")

    def test_tutor_uses_gemini_with_slide_context(self):
        with patch(
            "app.services.tutor_service.generate_content",
            return_value="Câu trả lời dựa trên slide 2.",
        ) as mocked_generate:
            result = asyncio.run(
                chat_with_tutor(TutorChatRequest(message="Slide nói về điều gì?", page_context=2))
            )
        self.assertEqual(result.provider, "gemini")
        user_content = mocked_generate.call_args.kwargs["messages"][0]["content"]
        self.assertIn("student_question", user_content[0]["text"])
        self.assertEqual(sum(part["type"] == "image_url" for part in user_content), 1)


if __name__ == "__main__":
    unittest.main()

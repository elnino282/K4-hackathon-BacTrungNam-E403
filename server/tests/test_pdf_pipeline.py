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
from app.schemas.note import AINoteRequest, NoteSelectionInput
from app.schemas.study import (
    AssessmentStartRequest,
    QuizEvaluateRequest,
    QuizGenerateRequest,
    StudySource,
)
from app.services.pdf_service import (
    PARSER_VERSION,
    _clean_linear_text,
    extract_pdf_to_json,
    render_pdf_page,
)
from app.services.evidence_service import (
    build_source_passages,
    verify_key_points,
)
from app.services.summary_service import (
    AI_REQUEST_TIMEOUT_SECONDS,
    SUMMARY_SYSTEM_PROMPT,
    _build_summary_contract,
    _clear_summary_cache,
    _evidence_scope_coverage,
    _post_chat_completion,
    _system_prompt_for_contract,
    generate_summary,
)
from app.services.tutor_service import chat_with_tutor
from app.services.note_service import generate_ai_note
from app.services.study_service import (
    StudyScopeError,
    evaluate_quiz,
    generate_assessment,
    generate_quiz,
)


class PdfPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = extract_pdf_to_json("lesson-01")

    def setUp(self):
        _clear_summary_cache()

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
        self.assertIn("workflow", self.data["pages"][39]["clean_text"])

    def test_cleaner_repairs_number_interrupted_word(self):
        cleaned, _ = _clean_linear_text("rule / work-\n1\nflow trước")
        self.assertEqual(cleaned, "rule / workflow trước")

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
                                    "key_points": [
                                        {
                                            "claim": "Ba lựa chọn kiến trúc.",
                                            "page": 22,
                                            "evidence_quote": "3 Cases: Rule, LLM Feature, Hay Agent?",
                                        }
                                    ],
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
        self.assertEqual(result.coverage.verified_points, 1)
        self.assertTrue(result.key_points[0].verified)

        self.assertTrue(captured_request["url"].endswith("/chat/completions"))
        messages = captured_request["body"]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("JSON", messages[0]["content"])
        self.assertIn("source_id", messages[0]["content"])
        parts = messages[1]["content"]
        text_part = next(
            part["text"] for part in parts if part["type"] == "text"
        )
        self.assertIn("<source_passages>", text_part)
        self.assertIn('<passage id="p022-', text_part)
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
                                    "key_points": [
                                        {
                                            "claim": "Adoption tăng nhưng scale vẫn khó.",
                                            "page": 7,
                                            "evidence_quote": "AI 2025: Adoption tăng nhanh, scale vẫn khó",
                                        }
                                    ],
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

    def test_summary_repairs_invalid_json_once(self):
        responses = [
            {"choices": [{"message": {"content": "not-json"}}]},
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Adoption tăng nhưng scale vẫn khó.",
                                    "key_points": [
                                        {
                                            "claim": "AI được áp dụng nhanh nhưng khó scale.",
                                            "page": 7,
                                            "evidence_quote": "AI 2025: Adoption tăng nhanh, scale vẫn khó",
                                        },
                                        {
                                            "claim": "Dev đang có nhiều pilot và demo.",
                                            "page": 7,
                                            "evidence_quote": "Ý nghĩa cho Dev: có nhiều pilot và demo",
                                        },
                                        {
                                            "claim": "Khó mở rộng vì bài toán và workflow.",
                                            "page": 7,
                                            "evidence_quote": "scale thật sự vẫn khó vì bài toán, workflow",
                                        },
                                    ],
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        ]

        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.summary_service._post_chat_completion",
                side_effect=responses,
            ) as mocked_post:
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

        self.assertEqual(mocked_post.call_count, 2)
        self.assertEqual(result.provider, "xah")
        self.assertEqual(result.coverage.verified_points, 3)
        self.assertIn("Đã tự sửa một lượt", result.notice)

    def test_adaptive_contract_uses_content_density(self):
        divider = _build_summary_contract([self.data["pages"][36]])
        dense = _build_summary_contract([self.data["pages"][23]])
        checklist = _build_summary_contract([self.data["pages"][20]])

        self.assertEqual(divider.page_type, "divider")
        self.assertEqual((divider.min_points, divider.max_points), (1, 2))
        self.assertEqual(dense.page_type, "content")
        self.assertEqual((dense.min_points, dense.max_points), (3, 5))
        self.assertEqual(checklist.page_type, "content")
        self.assertEqual(
            (checklist.min_points, checklist.max_points),
            (3, 5),
        )
        self.assertEqual(
            _system_prompt_for_contract(dense),
            SUMMARY_SYSTEM_PROMPT,
        )
        self.assertNotEqual(
            _system_prompt_for_contract(divider),
            SUMMARY_SYSTEM_PROMPT,
        )

    def test_summary_depth_changes_content_contract(self):
        page = [self.data["pages"][23]]
        quick = _build_summary_contract(page, "quick")
        standard = _build_summary_contract(page, "standard")
        study = _build_summary_contract(page, "study")

        self.assertEqual(
            (quick.min_points, quick.max_points),
            (2, 3),
        )
        self.assertEqual(
            (standard.min_points, standard.max_points),
            (3, 5),
        )
        self.assertEqual(
            (study.min_points, study.max_points),
            (4, 5),
        )
        self.assertNotEqual(
            _system_prompt_for_contract(quick),
            SUMMARY_SYSTEM_PROMPT,
        )

    def test_evidence_scope_coverage_requires_all_short_range_pages(self):
        selected_pages = self.data["pages"][6:8]
        one_page = [{"page": 7}]
        both_pages = [{"page": 7}, {"page": 8}]

        self.assertEqual(
            _evidence_scope_coverage(one_page, selected_pages),
            (1, 2),
        )
        self.assertEqual(
            _evidence_scope_coverage(both_pages, selected_pages),
            (2, 2),
        )

    def test_evidence_scope_coverage_spans_full_document_thirds(self):
        selected_pages = self.data["pages"]
        spread_points = [{"page": 7}, {"page": 22}, {"page": 39}]
        early_only = [{"page": 4}, {"page": 7}, {"page": 10}]

        self.assertEqual(
            _evidence_scope_coverage(spread_points, selected_pages),
            (3, 3),
        )
        self.assertEqual(
            _evidence_scope_coverage(early_only, selected_pages),
            (1, 3),
        )

    def test_summary_request_rejects_ambiguous_or_invalid_scope(self):
        invalid_payloads = [
            {"current_page": 0},
            {"current_page": True},
            {"start_page": 7},
            {"end_page": 7},
            {"start_page": 9, "end_page": 7},
            {"current_page": 7, "start_page": 8, "end_page": 9},
            {"language": "KLINGON"},
            {"depth": "essay"},
            {"current_page": 7, "unexpected": "field"},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    SummaryRequest(**payload)

        self.assertEqual(SummaryRequest().model_dump()["current_page"], None)

    def test_summary_http_scope_guard_returns_404_or_422(self):
        cases = [
            ({"doc_id": "lesson-01", "current_page": 0}, 422),
            ({"doc_id": "lesson-01", "current_page": 45}, 422),
            ({"doc_id": "lesson-01", "start_page": 7}, 422),
            (
                {
                    "doc_id": "lesson-01",
                    "start_page": 9,
                    "end_page": 7,
                },
                422,
            ),
            (
                {
                    "doc_id": "lesson-01",
                    "start_page": 43,
                    "end_page": 99,
                },
                422,
            ),
            (
                {
                    "doc_id": "lesson-01",
                    "current_page": 7,
                    "unexpected": "field",
                },
                422,
            ),
            ({"doc_id": "does-not-exist", "current_page": 1}, 404),
            ({"doc_id": "../secret", "current_page": 1}, 422),
        ]

        with TestClient(app) as client:
            for payload, expected_status in cases:
                with self.subTest(payload=payload):
                    response = client.post(
                        "/api/summaries/generate",
                        json=payload,
                    )
                    self.assertEqual(
                        response.status_code,
                        expected_status,
                        response.text,
                    )

    def test_administrative_page_skips_ai(self):
        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.summary_service._post_chat_completion"
            ) as mocked_post:
                result = asyncio.run(
                    generate_summary(
                        SummaryRequest(
                            doc_id="lesson-01",
                            current_page=44,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        mocked_post.assert_not_called()
        self.assertEqual(result.status, "not_applicable")
        self.assertEqual(result.provider, "local")
        self.assertEqual(result.key_points, [])
        self.assertNotIn("lecturer@", result.summary)

    def test_fallback_is_never_marked_verified(self):
        old_xah_key = os.environ.pop("XAH_API_KEY", None)
        old_ai_key = os.environ.pop("AI_API_KEY", None)
        try:
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
            if old_xah_key is not None:
                os.environ["XAH_API_KEY"] = old_xah_key
            if old_ai_key is not None:
                os.environ["AI_API_KEY"] = old_ai_key

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, "mock")
        self.assertEqual(result.key_points, [])
        self.assertEqual(result.coverage.verified_points, 0)

    def test_zero_verified_points_fails_closed(self):
        unsupported = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "Đây là tóm tắt bị bịa.",
                                "key_points": [
                                    {
                                        "claim": "Nội dung không có nguồn.",
                                        "page": 7,
                                        "evidence_quote": "Câu này không tồn tại trong PDF",
                                    }
                                ],
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
                return_value=unsupported,
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

        self.assertEqual(result.status, "error")
        self.assertEqual(result.provider, "xah")
        self.assertEqual(result.key_points, [])
        self.assertEqual(result.coverage.verified_points, 0)
        self.assertNotEqual(result.summary, "Đây là tóm tắt bị bịa.")

    def test_divider_accepts_one_distinct_point_without_retry(self):
        response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "Trang mở đầu phần thực hành Lab 2.",
                                "key_points": [
                                    {
                                        "claim": "Lab 2 yêu cầu chọn use case, viết PS và quyết định go/no-go.",
                                        "page": 37,
                                        "evidence_quote": "Lab 2: Chọn use case, viết PS, và ra quyết định go/no-go",
                                    }
                                ],
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
                return_value=response,
            ) as mocked_post:
                result = asyncio.run(
                    generate_summary(
                        SummaryRequest(
                            doc_id="lesson-01",
                            current_page=37,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(mocked_post.call_count, 1)
        self.assertEqual(result.status, "verified")
        self.assertEqual(result.coverage.verified_points, 1)
        self.assertEqual(result.coverage.target_min_points, 1)

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
        self.assertEqual(
            captured["timeout"],
            AI_REQUEST_TIMEOUT_SECONDS,
        )
        self.assertTrue(all(byte < 128 for byte in request_bytes))
        self.assertEqual(
            json.loads(request_bytes.decode("ascii")),
            payload,
        )

    def test_transport_error_is_not_retried_or_exposed_to_user(self):
        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.summary_service._post_chat_completion",
                side_effect=RuntimeError("secret transport detail"),
            ) as mocked_post:
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

        self.assertEqual(mocked_post.call_count, 1)
        self.assertEqual(result.status, "fallback")
        self.assertNotIn("secret transport detail", result.notice)
        self.assertIn("tạm thời không khả dụng", result.notice)

    def test_evidence_verifier_rejects_wrong_page_and_invented_quote(self):
        pages = self.data["pages"]
        verified, rejected = verify_key_points(
            [
                {
                    "claim": "Lifecycle có sáu giai đoạn.",
                    "page": 11,
                    "evidence_quote": "6 Giai Đoạn Phát Triển AI Product",
                },
                {
                    "claim": "Nguồn sai trang.",
                    "page": 12,
                    "evidence_quote": "6 Giai Đoạn Phát Triển AI Product",
                },
                {
                    "claim": "Nội dung bị bịa.",
                    "page": 11,
                    "evidence_quote": "Đây là câu không tồn tại trong tài liệu",
                },
            ],
            [pages[10], pages[11]],
        )

        self.assertEqual(len(verified), 1)
        self.assertEqual(verified[0]["page"], 11)
        self.assertEqual(len(rejected), 2)
        self.assertEqual(
            {item["reason"] for item in rejected},
            {"evidence_not_found_on_page"},
        )

    def test_source_id_resolves_server_owned_evidence(self):
        pages = [
            {
                "page_number": 7,
                "clean_text": (
                    "AI 2025: Adoption tăng nhanh, scale vẫn khó.\n"
                    "Ý nghĩa cho Dev: có nhiều pilot và demo."
                ),
            }
        ]
        passages = build_source_passages(pages)
        verified, rejected = verify_key_points(
            [
                {
                    "claim": "AI 2025 được áp dụng nhanh nhưng vẫn khó mở rộng.",
                    "page": 7,
                    "source_id": passages[0]["source_id"],
                }
            ],
            pages,
            passages,
        )

        self.assertEqual(rejected, [])
        self.assertEqual(len(verified), 1)
        self.assertEqual(
            verified[0]["evidence_quote"],
            passages[0]["text"],
        )
        self.assertEqual(
            verified[0]["verification_method"],
            "source_id_exact_source_match",
        )

    def test_evidence_verifier_blocks_number_not_present_in_source(self):
        pages = [
            {
                "page_number": 7,
                "clean_text": "Tỷ lệ áp dụng tăng nhanh nhưng vẫn khó mở rộng.",
            }
        ]
        passages = build_source_passages(pages)
        verified, rejected = verify_key_points(
            [
                {
                    "claim": "Tỷ lệ áp dụng đạt 12.8%.",
                    "page": 7,
                    "source_id": passages[0]["source_id"],
                }
            ],
            pages,
            passages,
        )

        self.assertEqual(verified, [])
        self.assertEqual(rejected[0]["reason"], "claim_number_not_in_evidence")
        self.assertEqual(rejected[0]["missing_numbers"], ["12.8%"])

    def test_verified_summary_is_cached_by_source_and_scope(self):
        passages = build_source_passages([self.data["pages"][36]])
        response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "Trang mở đầu phần thực hành Lab 2.",
                                "key_points": [
                                    {
                                        "claim": (
                                            "Lab 2 yêu cầu chọn use case, viết PS "
                                            "và quyết định go/no-go."
                                        ),
                                        "page": 37,
                                        "source_id": passages[0]["source_id"],
                                    }
                                ],
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
                return_value=response,
            ) as mocked_post:
                request = SummaryRequest(
                    doc_id="lesson-01",
                    current_page=37,
                    language="VI",
                )
                first = asyncio.run(generate_summary(request))
                second = asyncio.run(generate_summary(request))
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(mocked_post.call_count, 1)
        self.assertFalse(first.cached)
        self.assertTrue(second.cached)
        self.assertEqual(first.summary, second.summary)

    def test_summary_http_endpoint_returns_page_7_result(self):
        def fake_post(url, api_key, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Trang 7 được chọn chính xác.",
                                    "key_points": [
                                        {
                                            "claim": "Adoption tăng nhưng scale vẫn khó.",
                                            "page": 7,
                                            "evidence_quote": "AI 2025: Adoption tăng nhanh, scale vẫn khó",
                                        }
                                    ],
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
        self.assertEqual(body["coverage"]["verified_points"], 1)

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

    def test_tutor_follow_up_keeps_all_summary_source_pages(self):
        captured_request = {}

        def fake_post(url, api_key, payload):
            captured_request["body"] = payload
            return {
                "choices": [
                    {
                        "message": {
                            "content": (
                                "Trang 7 nói về adoption; trang 8 nói về "
                                "vấn đề không nằm ở model."
                            )
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
                            message="Giải thích dễ hiểu hơn.",
                            page_context=7,
                            context_pages=[7, 8],
                            prior_answer=(
                                "AI adoption tăng nhưng scale vẫn khó."
                            ),
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
        self.assertEqual(len(result.sources), 2)
        user_parts = captured_request["body"]["messages"][1]["content"]
        text_part = user_parts[0]["text"]
        self.assertIn('<slide page="7"', text_part)
        self.assertIn('<slide page="8"', text_part)
        self.assertIn(
            "AI adoption tăng nhưng scale vẫn khó.",
            text_part,
        )
        self.assertEqual(
            sum(part["type"] == "image_url" for part in user_parts),
            2,
        )

    def test_tutor_request_rejects_invalid_context(self):
        invalid_payloads = [
            {"message": "Test", "page_context": 0},
            {"message": "Test", "page_context": True},
            {"message": "Test", "context_pages": [7, 7]},
            {"message": "Test", "context_pages": [0]},
            {"message": "Test", "language": "KLINGON"},
            {"message": "Test", "unexpected": "field"},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    TutorChatRequest(**payload)

    def test_ai_note_uses_only_user_selected_regions(self):
        captured_request = {}

        def fake_post(url, api_key, payload):
            captured_request["body"] = payload
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "title": "Operational Boundary",
                                    "summary": (
                                        "Xác định giới hạn hành động của hệ thống."
                                    ),
                                    "key_takeaways": [
                                        "Nêu điều hệ thống được và không được làm."
                                    ],
                                    "example": (
                                        "AI gợi ý nhưng con người phê duyệt."
                                    ),
                                    "misconception": (
                                        "Không chỉ là giới hạn kỹ thuật."
                                    ),
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            }

        request = AINoteRequest(
            doc_id="lesson-01",
            language="VI",
            selections=[
                NoteSelectionInput(
                    page=24,
                    text="Operational Boundary",
                    x=0.1,
                    y=0.2,
                    width=0.4,
                    height=0.2,
                )
            ],
        )
        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.note_service._post_chat_completion",
                side_effect=fake_post,
            ):
                result = asyncio.run(generate_ai_note(request))
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(result.status, "generated")
        self.assertEqual(result.provider, "xah")
        self.assertEqual(result.source_pages, [24])
        self.assertEqual(result.verified_selections, 1)
        self.assertEqual(
            result.source_excerpts,
            ["Operational Boundary"],
        )
        messages = captured_request["body"]["messages"]
        self.assertIn("đúng những vùng", messages[0]["content"])
        user_parts = messages[1]["content"]
        self.assertIn(
            "<selected_text>\nOperational Boundary",
            user_parts[0]["text"],
        )

    def test_ai_note_fallback_keeps_selection_when_key_is_missing(self):
        old_xah_key = os.environ.pop("XAH_API_KEY", None)
        old_ai_key = os.environ.pop("AI_API_KEY", None)
        try:
            result = asyncio.run(
                generate_ai_note(
                    AINoteRequest(
                        selections=[
                            NoteSelectionInput(
                                page=24,
                                text="Operational Boundary",
                                x=0.1,
                                y=0.2,
                                width=0.4,
                                height=0.2,
                            )
                        ]
                    )
                )
            )
        finally:
            if old_xah_key is not None:
                os.environ["XAH_API_KEY"] = old_xah_key
            if old_ai_key is not None:
                os.environ["AI_API_KEY"] = old_ai_key

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, "local")
        self.assertIn("Operational Boundary", result.summary)
        self.assertEqual(result.source_pages, [24])

    def test_ai_note_request_rejects_invalid_or_empty_selection(self):
        invalid_selections = [
            {
                "page": 24,
                "text": "",
                "x": 0.1,
                "y": 0.1,
                "width": 0.2,
                "height": 0.2,
            },
            {
                "page": 24,
                "text": "Test",
                "x": 0.9,
                "y": 0.1,
                "width": 0.2,
                "height": 0.2,
            },
            {
                "page": 24,
                "text": "Test",
                "x": 0.1,
                "y": 0.1,
                "width": 0,
                "height": 0.2,
            },
        ]
        for selection in invalid_selections:
            with self.subTest(selection=selection):
                with self.assertRaises(ValidationError):
                    AINoteRequest(selections=[selection])

    def test_study_quiz_and_evaluation_use_verified_source(self):
        source = StudySource(
            page=7,
            claim="AI 2025 adoption tăng nhanh nhưng scale vẫn khó.",
            evidence_quote="AI 2025: Adoption tăng nhanh, scale vẫn khó",
        )
        responses = [
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "question": (
                                        "Vì sao adoption tăng chưa đồng nghĩa "
                                        "với scale thành công?"
                                    ),
                                    "hint": "Xem lại các trở ngại sau pilot.",
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "verdict": "correct",
                                    "feedback": (
                                        "Bạn đã phân biệt adoption và scale."
                                    ),
                                    "next_step": "Đối chiếu lại trang 7.",
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        ]
        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.study_service._post_chat_completion",
                side_effect=responses,
            ):
                quiz = asyncio.run(
                    generate_quiz(
                        QuizGenerateRequest(source=source, language="VI")
                    )
                )
                evaluation = asyncio.run(
                    evaluate_quiz(
                        QuizEvaluateRequest(
                            source=source,
                            question=quiz.question,
                            answer=(
                                "Adoption mới thể hiện đã dùng; scale còn phụ "
                                "thuộc workflow, eval và vận hành."
                            ),
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(quiz.status, "generated")
        self.assertNotIn("workflow", quiz.question.casefold())
        self.assertEqual(evaluation.verdict, "correct")
        self.assertEqual(evaluation.score, 100)
        self.assertEqual(evaluation.source_page, 7)

    def test_learning_assessment_creates_equivalent_question_pair(self):
        source = StudySource(
            page=7,
            claim="AI 2025 adoption tăng nhanh nhưng scale vẫn khó.",
            evidence_quote="AI 2025: Adoption tăng nhanh, scale vẫn khó",
        )
        ai_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "pre_question": (
                                    "Vì sao việc nhiều nhóm bắt đầu dùng AI "
                                    "chưa chứng minh họ đã mở rộng thành công?"
                                ),
                                "post_question": (
                                    "Một công ty có nhiều thử nghiệm AI nhưng "
                                    "chưa vận hành rộng. Điều này cho thấy gì?"
                                ),
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
                "app.services.study_service._post_chat_completion",
                return_value=ai_response,
            ):
                assessment = asyncio.run(
                    generate_assessment(
                        AssessmentStartRequest(
                            source=source,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(assessment.status, "generated")
        self.assertEqual(assessment.provider, "xah")
        self.assertEqual(assessment.source_page, 7)
        self.assertNotEqual(
            assessment.pre_question.casefold(),
            assessment.post_question.casefold(),
        )
        self.assertGreaterEqual(len(assessment.assessment_id), 8)

    def test_learning_assessment_rejects_duplicate_ai_questions(self):
        source = StudySource(
            page=7,
            claim="AI 2025 adoption tăng nhanh nhưng scale vẫn khó.",
            evidence_quote="AI 2025: Adoption tăng nhanh, scale vẫn khó",
        )
        duplicated = "Adoption khác scale như thế nào?"
        old_key = os.environ.get("XAH_API_KEY")
        os.environ["XAH_API_KEY"] = "test-only-not-a-real-key"
        try:
            with patch(
                "app.services.study_service._post_chat_completion",
                return_value={
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "pre_question": duplicated,
                                        "post_question": duplicated,
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        }
                    ]
                },
            ):
                assessment = asyncio.run(
                    generate_assessment(
                        AssessmentStartRequest(
                            source=source,
                            language="VI",
                        )
                    )
                )
        finally:
            if old_key is None:
                os.environ.pop("XAH_API_KEY", None)
            else:
                os.environ["XAH_API_KEY"] = old_key

        self.assertEqual(assessment.status, "fallback")
        self.assertEqual(assessment.provider, "local")
        self.assertNotEqual(
            assessment.pre_question.casefold(),
            assessment.post_question.casefold(),
        )

    def test_study_quiz_blocks_unverified_source(self):
        fake_source = StudySource(
            page=7,
            claim="Số liệu bị bịa là 99%.",
            evidence_quote="Câu dẫn chứng không tồn tại trong slide này",
        )
        for operation in (
            generate_quiz(QuizGenerateRequest(source=fake_source)),
            generate_assessment(AssessmentStartRequest(source=fake_source)),
        ):
            with self.subTest(operation=operation):
                with self.assertRaises(StudyScopeError):
                    asyncio.run(operation)

    def test_learning_evaluation_rejects_invalid_stage(self):
        with self.assertRaises(ValidationError):
            QuizEvaluateRequest(
                source=StudySource(
                    page=7,
                    claim="AI 2025 adoption tăng nhanh nhưng scale vẫn khó.",
                    evidence_quote=(
                        "AI 2025: Adoption tăng nhanh, scale vẫn khó"
                    )
                ),
                question="Một câu hỏi hợp lệ?",
                answer="Một câu trả lời hợp lệ.",
                stage="during",
            )


if __name__ == "__main__":
    unittest.main()

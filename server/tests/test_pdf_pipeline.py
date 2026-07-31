import asyncio
import json
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.note import AINoteRequest, NoteSelectionInput
from app.schemas.study import (
    AssessmentStartRequest,
    QuizEvaluateRequest,
    QuizGenerateRequest,
    StudySource,
)
from app.schemas.summary import SummaryRequest
from app.schemas.tutor import TutorChatRequest
from app.services.evidence_service import (
    build_source_passages,
    verify_key_points,
)
from app.services.gemini_service import GeminiConfigurationError
from app.services.pdf_service import (
    PARSER_VERSION,
    _clean_linear_text,
    extract_pdf_to_json,
    render_pdf_page,
)
from app.services.summary_service import (
    _build_summary_contract,
    _clear_summary_cache,
    _evidence_scope_coverage,
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

    def test_cleaner_repairs_number_interrupted_word(self):
        cleaned, _ = _clean_linear_text("rule / work-\n1\nflow trước")
        self.assertEqual(cleaned, "rule / workflow trước")

    def test_render_page_for_multimodal_context(self):
        image_path = render_pdf_page("lesson-01", 22)
        self.assertTrue(image_path.exists())
        self.assertGreater(image_path.stat().st_size, 100_000)

    def test_summary_request_contains_system_prompt_text_and_image(self):
        fake_response = json.dumps(
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
        with patch(
            "app.services.summary_service.generate_content",
            return_value=fake_response,
        ) as mocked_generate:
            result = asyncio.run(
                generate_summary(
                    SummaryRequest(
                        doc_id="lesson-01",
                        current_page=22,
                        language="VI",
                    )
                )
            )

        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.summary, "Tóm tắt kiểm thử.")
        self.assertEqual(result.coverage.verified_points, 1)
        self.assertTrue(result.key_points[0].verified)

        messages = mocked_generate.call_args.kwargs["messages"]
        user_content = messages[0]["content"]
        text_part = next(
            part["text"] for part in user_content if part["type"] == "text"
        )
        self.assertIn("<source_passages>", text_part)
        self.assertIn('<passage id="p022-', text_part)
        self.assertEqual(
            sum(part["type"] == "image_url" for part in user_content),
            1,
        )

    def test_regression_summary_uses_requested_page_7_not_current_page_5(self):
        fake_response = json.dumps(
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
        with patch(
            "app.services.summary_service.generate_content",
            return_value=fake_response,
        ) as mocked_generate:
            result = asyncio.run(
                generate_summary(
                    SummaryRequest(
                        doc_id="lesson-01",
                        current_page=7,
                        language="VI",
                    )
                )
            )

        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.scope_description, "Trang 7")
        user_parts = mocked_generate.call_args.kwargs["messages"][0]["content"]
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
            "not-json",
            json.dumps(
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
            ),
        ]

        with patch(
            "app.services.summary_service.generate_content",
            side_effect=responses,
        ) as mocked_generate:
            result = asyncio.run(
                generate_summary(
                    SummaryRequest(
                        doc_id="lesson-01",
                        current_page=7,
                        language="VI",
                    )
                )
            )

        self.assertEqual(mocked_generate.call_count, 2)
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.coverage.verified_points, 3)
        self.assertIn("Đã tự sửa một lượt", result.notice)

    def test_adaptive_contract_uses_content_density(self):
        divider = _build_summary_contract([self.data["pages"][36]])
        dense = _build_summary_contract([self.data["pages"][23]])
        checklist = _build_summary_contract([self.data["pages"][20]])

        self.assertEqual(divider.page_type, "divider")
        self.assertEqual(divider.min_points, 1)
        self.assertEqual(divider.max_points, 2)
        self.assertEqual(dense.page_type, "content")
        self.assertEqual(dense.min_points, 3)
        self.assertEqual(dense.max_points, 5)
        self.assertEqual(checklist.min_points, 3)

    def test_summary_depth_changes_content_contract(self):
        quick = _build_summary_contract([self.data["pages"][23]], depth="quick")
        standard = _build_summary_contract([self.data["pages"][23]], depth="standard")
        study = _build_summary_contract([self.data["pages"][23]], depth="study")

        self.assertEqual(quick.min_points, 2)
        self.assertEqual(quick.max_points, 3)
        self.assertEqual(standard.min_points, 3)
        self.assertEqual(standard.max_points, 5)
        self.assertEqual(study.min_points, 4)
        self.assertEqual(study.max_points, 5)

    def test_evidence_scope_coverage_requires_all_short_range_pages(self):
        pages = [self.data["pages"][5], self.data["pages"][6]]
        points = [
            {
                "claim": "AI Landscape có cơ hội",
                "page": 6,
                "evidence_quote": "AI Landscape và Cơ Hội",
            }
        ]

        verified_points, _ = verify_key_points(points, pages)
        covered, total = _evidence_scope_coverage(verified_points, pages)
        self.assertEqual(total, 2)
        self.assertEqual(covered, 1)

    def test_evidence_scope_coverage_spans_full_document_thirds(self):
        pages = self.data["pages"]
        points = [
            {
                "claim": "Trang mở đầu",
                "page": 1,
                "evidence_quote": "Xác Định Bài Toán Kinh Doanh Cho AI",
            },
            {
                "claim": "Trang Lab 2",
                "page": 37,
                "evidence_quote": "Lab 2: Chọn use case, viết PS, và ra quyết định go/no-go",
            },
        ]

        verified_points, _ = verify_key_points(points, pages)
        covered, total = _evidence_scope_coverage(verified_points, pages)
        self.assertEqual(total, 3)
        self.assertEqual(covered, 2)

    def test_summary_request_rejects_ambiguous_or_invalid_scope(self):
        invalid_payloads = [
            {"current_page": 1, "start_page": 1, "end_page": 3},
            {"start_page": 1},
            {"end_page": 3},
            {"start_page": 5, "end_page": 2},
            {"depth": "deep"},
            {"language": "FR"},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    SummaryRequest(**payload)

    def test_summary_http_scope_guard_returns_404_or_422(self):
        with TestClient(app) as client:
            notFound = client.post(
                "/api/summaries/generate",
                json={"doc_id": "unknown-doc", "current_page": 1},
            )
            outOfBounds = client.post(
                "/api/summaries/generate",
                json={"doc_id": "lesson-01", "current_page": 999},
            )
            invalidRange = client.post(
                "/api/summaries/generate",
                json={
                    "doc_id": "lesson-01",
                    "start_page": 5,
                    "end_page": 2,
                },
            )

        self.assertEqual(notFound.status_code, 404)
        self.assertEqual(outOfBounds.status_code, 422)
        self.assertEqual(invalidRange.status_code, 422)

    def test_summary_http_accepts_frontend_contiguous_range_contract(self):
        response = json.dumps({
            "summary": "Tóm tắt từ trang 6 đến trang 8.",
            "key_points": [
                {
                    "claim": "Giai đoạn AI.",
                    "page": 6,
                    "evidence_quote": "6 Giai Đoạn Phát Triển AI Product",
                },
                {
                    "claim": "Adoption tăng.",
                    "page": 7,
                    "evidence_quote": "AI 2025: Adoption tăng nhanh, scale vẫn khó",
                },
                {
                    "claim": "Vấn đề không ở model.",
                    "page": 8,
                    "evidence_quote": "Problem không nằm ở AI model",
                },
            ],
        }, ensure_ascii=False)
        with patch("app.services.summary_service.generate_content", return_value=response):
            with TestClient(app) as client:
                result = client.post(
                    "/api/summaries/generate",
                    json={
                        "doc_id": "lesson-01",
                        "start_page": 6,
                        "end_page": 8,
                        "language": "VI",
                        "depth": "standard",
                    },
                )
        self.assertEqual(result.status_code, 200)
        payload = result.json()
        self.assertEqual(payload["scope_description"], "Khoảng trang 6 - 8")
        self.assertEqual(payload["coverage"]["requested_pages"], 3)
        self.assertEqual(payload["coverage"]["processed_pages"], 3)
        self.assertEqual(payload["depth"], "standard")

    def test_administrative_page_skips_ai(self):
        result = asyncio.run(
            generate_summary(
                SummaryRequest(
                    doc_id="lesson-01",
                    current_page=44,
                    language="VI",
                )
            )
        )
        self.assertEqual(result.status, "not_applicable")
        self.assertEqual(result.provider, "local")
        self.assertEqual(result.key_points, [])

    def test_fallback_is_never_marked_verified(self):
        fake_response = json.dumps(
            {
                "summary": "Đây là tóm tắt bị bịa.",
                "key_points": [
                    {
                        "claim": "Tất cả mọi thứ đều sai.",
                        "page": 7,
                        "evidence_quote": "Hoàn toàn không có trong PDF",
                    }
                ],
            },
            ensure_ascii=False,
        )
        with patch(
            "app.services.summary_service.generate_content",
            return_value=fake_response,
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

        self.assertEqual(result.status, "error")
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.key_points, [])
        self.assertEqual(result.coverage.verified_points, 0)
        self.assertNotEqual(result.summary, "Đây là tóm tắt bị bịa.")

    def test_zero_verified_points_fails_closed(self):
        fake_response = json.dumps(
            {
                "summary": "Tóm tắt bịa.",
                "key_points": [
                    {
                        "claim": "Bị bịa hoàn toàn.",
                        "page": 7,
                        "evidence_quote": "Chắc chắn không có câu này",
                    }
                ],
            },
            ensure_ascii=False,
        )
        with patch(
            "app.services.summary_service.generate_content",
            return_value=fake_response,
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

        self.assertEqual(result.status, "error")
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.key_points, [])
        self.assertEqual(result.coverage.verified_points, 0)

    def test_divider_accepts_one_distinct_point_without_retry(self):
        response = json.dumps(
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
        with patch(
            "app.services.summary_service.generate_content",
            return_value=response,
        ) as mocked_generate:
            result = asyncio.run(
                generate_summary(
                    SummaryRequest(
                        doc_id="lesson-01",
                        current_page=37,
                        language="VI",
                    )
                )
            )

        self.assertEqual(mocked_generate.call_count, 1)
        self.assertEqual(result.status, "verified")
        self.assertEqual(result.coverage.verified_points, 1)
        self.assertEqual(result.coverage.target_min_points, 1)

    def test_transport_error_is_not_retried_or_exposed_to_user(self):
        with patch(
            "app.services.summary_service.generate_content",
            side_effect=RuntimeError("secret transport detail"),
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

        self.assertEqual(result.status, "fallback")
        self.assertNotIn("secret transport detail", result.notice)
        self.assertIn("tạm thời không khả dụng", result.notice)

    def test_evidence_verifier_rejects_wrong_page_and_invented_quote(self):
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

    def test_tutor_follow_up_keeps_all_summary_source_pages(self):
        with patch(
            "app.services.tutor_service.generate_content",
            return_value=(
                "Trang 7 nói về adoption; trang 8 nói về vấn đề không nằm ở model."
            ),
        ) as mocked_generate:
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

        self.assertEqual(result.provider, "gemini")
        self.assertEqual(len(result.sources), 2)
        user_parts = mocked_generate.call_args.kwargs["messages"][0]["content"]
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
        fake_response = json.dumps(
            {
                "title": "Operational Boundary",
                "summary": "Xác định giới hạn hành động của hệ thống.",
                "key_takeaways": ["Nêu điều hệ thống được và không được làm."],
                "example": "AI gợi ý nhưng con người phê duyệt.",
                "misconception": "Không chỉ là giới hạn kỹ thuật.",
            },
            ensure_ascii=False,
        )
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
        with patch(
            "app.services.note_service.generate_content",
            return_value=fake_response,
        ) as mocked_generate:
            result = asyncio.run(generate_ai_note(request))

        self.assertEqual(result.status, "generated")
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.source_pages, [24])
        self.assertEqual(result.verified_selections, 1)
        self.assertEqual(
            result.source_excerpts,
            ["Operational Boundary"],
        )
        messages = mocked_generate.call_args.kwargs["messages"]
        user_parts = messages[0]["content"]
        self.assertIn(
            "<selected_text>\nOperational Boundary",
            user_parts[0]["text"],
        )

    def test_ai_note_fallback_keeps_selection_when_key_is_missing(self):
        with patch(
            "app.services.note_service.get_gemini_configuration",
            side_effect=GeminiConfigurationError("missing config"),
        ):
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
            json.dumps(
                {
                    "question": (
                        "Vì sao adoption tăng chưa đồng nghĩa với scale thành công?"
                    ),
                    "hint": "Xem lại các trở ngại sau pilot.",
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "verdict": "correct",
                    "feedback": "Bạn đã phân biệt adoption và scale.",
                    "next_step": "Đối chiếu lại trang 7.",
                },
                ensure_ascii=False,
            ),
        ]
        with patch(
            "app.services.study_service.generate_content",
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
                            "Adoption mới thể hiện đã dùng; scale còn phụ thuộc workflow, eval và vận hành."
                        ),
                        language="VI",
                    )
                )
            )

        self.assertEqual(quiz.status, "generated")
        self.assertEqual(quiz.provider, "gemini")
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
        ai_response = json.dumps(
            {
                "pre_question": (
                    "Vì sao việc nhiều nhóm bắt đầu dùng AI chưa chứng minh họ đã mở rộng thành công?"
                ),
                "post_question": (
                    "Một công ty có nhiều thử nghiệm AI nhưng chưa vận hành rộng. Điều này cho thấy gì?"
                ),
            },
            ensure_ascii=False,
        )
        with patch(
            "app.services.study_service.generate_content",
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

        self.assertEqual(assessment.status, "generated")
        self.assertEqual(assessment.provider, "gemini")
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
        with patch(
            "app.services.study_service.generate_content",
            return_value=json.dumps(
                {
                    "pre_question": duplicated,
                    "post_question": duplicated,
                },
                ensure_ascii=False,
            ),
        ):
            assessment = asyncio.run(
                generate_assessment(
                    AssessmentStartRequest(
                        source=source,
                        language="VI",
                    )
                )
            )

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

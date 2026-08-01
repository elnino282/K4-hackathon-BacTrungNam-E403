import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.mind_map import MindMapRequest
from app.services.mind_map_service import (
    MindMapGenerationError,
    _parse_response,
    generate_mind_map,
)


SOURCE_DOCUMENT = {
    "pages": [
        {"page_number": 1, "clean_text": "Mở đầu bài học"},
        {"page_number": 2, "clean_text": "Problem Statement và Actor"},
        {"page_number": 3, "clean_text": "Success Metric đo được"},
    ]
}


def valid_tree(page: int = 2) -> str:
    return json.dumps(
        {
            "id": "root",
            "title": "Problem Statement",
            "summary": "Cấu trúc bài toán cần làm rõ.",
            "page_references": [page],
            "children": [
                {
                    "id": "actor",
                    "title": "Actor",
                    "summary": "Người thực hiện công việc.",
                    "page_references": [page],
                    "children": [],
                }
            ],
        },
        ensure_ascii=False,
    )


class MindMapTest(unittest.TestCase):
    def test_request_requires_pages_for_selected_scope(self):
        with self.assertRaises(ValidationError):
            MindMapRequest(scope="selected_pages", depth="normal")
        with self.assertRaises(ValidationError):
            MindMapRequest(
                scope="selected_pages",
                depth="normal",
                start_page=3,
                end_page=2,
            )

    def test_generation_reads_document_server_side_and_keeps_scope(self):
        request = MindMapRequest(
            scope="selected_pages",
            depth="normal",
            start_page=2,
            end_page=3,
        )
        with (
            patch(
                "app.services.mind_map_service.get_extracted_data",
                return_value=SOURCE_DOCUMENT,
            ),
            patch(
                "app.services.mind_map_service.generate_content",
                new_callable=AsyncMock,
                return_value=valid_tree(2),
            ) as generate,
        ):
            result = asyncio.run(generate_mind_map("lesson-01", request))

        self.assertEqual(result.source_pages, [2, 3])
        self.assertEqual(result.node_count, 2)
        prompt = generate.await_args.kwargs["messages"][0]["content"]
        self.assertNotIn("Mở đầu bài học", prompt)
        self.assertIn('<page number="2">', prompt)
        self.assertIn('<page number="3">', prompt)

    def test_rejects_duplicate_ids_and_sources_outside_scope(self):
        duplicate = json.loads(valid_tree())
        duplicate["children"][0]["id"] = "root"
        with self.assertRaises(MindMapGenerationError):
            _parse_response(json.dumps(duplicate), {2, 3})
        with self.assertRaises(MindMapGenerationError):
            _parse_response(valid_tree(4), {2, 3})

    def test_rejects_whole_map_when_a_required_section_is_missing(self):
        with self.assertRaises(MindMapGenerationError):
            _parse_response(valid_tree(2), {2, 3}, [{2}, {3}])

        complete = json.loads(valid_tree(2))
        complete["children"][0]["page_references"] = [3]
        root, count = _parse_response(
            json.dumps(complete),
            {2, 3},
            [{2}, {3}],
        )
        self.assertEqual(root.children[0].page_references, [3])
        self.assertEqual(count, 2)

    def test_api_does_not_accept_client_supplied_slide_content(self):
        response = TestClient(app).post(
            "/api/documents/lesson-01/mind-map",
            json={
                "scope": "whole_lecture",
                "depth": "normal",
                "content": [{"page": 99, "text": "Nội dung giả"}],
            },
        )
        self.assertEqual(response.status_code, 422)

    @patch("app.api.documents.generate_mind_map", new_callable=AsyncMock)
    def test_api_returns_validated_response(self, generate: AsyncMock):
        request = MindMapRequest(
            scope="current_page",
            depth="overview",
            current_page=2,
        )
        with (
            patch(
                "app.services.mind_map_service.get_extracted_data",
                return_value=SOURCE_DOCUMENT,
            ),
            patch(
                "app.services.mind_map_service.generate_content",
                new_callable=AsyncMock,
                return_value=valid_tree(2),
            ),
        ):
            generated = asyncio.run(generate_mind_map("lesson-01", request))
        generate.return_value = generated

        response = TestClient(app).post(
            "/api/documents/lesson-01/mind-map",
            json={
                "scope": "current_page",
                "depth": "overview",
                "current_page": 2,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source_pages"], [2])
        self.assertEqual(response.json()["mind_map"]["page_references"], [2])


if __name__ == "__main__":
    unittest.main()

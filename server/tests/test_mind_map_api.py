import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.mind_map import MindMapNode


class MindMapApiTest(unittest.TestCase):
    def test_rejects_a_mind_map_request_without_page_content(self):
        response = TestClient(app).post(
            "/api/documents/lesson-01/mind-map",
            json={"scope": "whole_lecture", "depth": "normal", "content": []},
        )

        self.assertEqual(response.status_code, 422)

    @patch("app.api.documents.generate_mind_map", new_callable=AsyncMock)
    def test_returns_the_validated_tree_from_the_generator(self, generate_mind_map):
        generate_mind_map.return_value = MindMapNode(
            id="root",
            title="AI Product",
            summary="Course overview",
            page_references=[1],
            children=[],
        )

        response = TestClient(app).post(
            "/api/documents/lesson-01/mind-map",
            json={
                "scope": "whole_lecture",
                "depth": "normal",
                "content": [{"page": 1, "text": "AI product material"}],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["page_references"], [1])
        generate_mind_map.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

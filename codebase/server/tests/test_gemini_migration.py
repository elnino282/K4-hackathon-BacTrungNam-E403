import asyncio
import json
import os
import unittest
from unittest.mock import patch

from app.schemas.summary import SummaryRequest
from app.services.summary_service import generate_content, generate_summary


class GeminiMigrationTest(unittest.TestCase):
    @patch.dict(
        os.environ,
        {"GEMINI_API_KEY": "test-key", "GEMINI_MODEL": "gemini-test"},
        clear=True,
    )
    def test_summary_uses_gemini_and_preserves_evidence_validation(self):
        with patch(
            "app.services.summary_service.generate_content",
            return_value=json.dumps(
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
            ),
        ) as mocked_generate:
            result = asyncio.run(
                generate_summary(SummaryRequest(doc_id="lesson-01", current_page=7))
            )

        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.coverage.verified_points, 1)
        self.assertEqual(mocked_generate.call_count, 2)


if __name__ == "__main__":
    unittest.main()

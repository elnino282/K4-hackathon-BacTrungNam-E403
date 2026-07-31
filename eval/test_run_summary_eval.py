import unittest

from run_summary_eval import evaluate_case


class EvaluateCaseTests(unittest.TestCase):
    def test_gemini_verified_response_passes_quality_checks(self):
        case = {
            "id": "G01",
            "label": "Example",
            "expected_pages": [7],
            "expected_terms": ["adoption", "scale", "agentic"],
        }
        response = {
            "provider": "gemini",
            "summary": "Adoption, scale, and agentic AI.",
            "key_points": [
                {
                    "claim": "First point",
                    "page": 7,
                    "evidence_quote": "source",
                    "verified": True,
                },
                {
                    "claim": "Second point",
                    "page": 7,
                    "evidence_quote": "source",
                    "verified": True,
                },
                {
                    "claim": "Third point",
                    "page": 7,
                    "evidence_quote": "source",
                    "verified": True,
                },
            ],
        }

        result = evaluate_case(
            case,
            response,
            duration_ms=1,
            pages_by_number={7: {"clean_text": "source"}},
        )

        self.assertTrue(result["quality_pass"])
        self.assertTrue(result["verified_pass"])


if __name__ == "__main__":
    unittest.main()

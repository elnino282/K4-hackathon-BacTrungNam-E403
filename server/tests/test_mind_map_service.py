import json
import unittest

from app.services.mind_map_service import MindMapGenerationError, _parse_response


class MindMapServiceTest(unittest.TestCase):
    def test_rejects_non_positive_page_references(self):
        with self.assertRaises(MindMapGenerationError):
            _parse_response(
                json.dumps(
                    {
                        "id": "root",
                        "title": "Course",
                        "summary": "Overview",
                        "page_references": [0],
                        "children": [],
                    }
                )
            )

    def test_rejects_duplicate_node_ids(self):
        with self.assertRaises(MindMapGenerationError):
            _parse_response(
                json.dumps(
                    {
                        "id": "root",
                        "title": "Course",
                        "summary": "Overview",
                        "page_references": [1],
                        "children": [
                            {
                                "id": "root",
                                "title": "Repeated",
                                "summary": "Invalid",
                                "page_references": [1],
                                "children": [],
                            }
                        ],
                    }
                )
            )


if __name__ == "__main__":
    unittest.main()

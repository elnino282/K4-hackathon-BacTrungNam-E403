import json
from typing import Any

from pydantic import ValidationError

from app.schemas.mind_map import MindMapNode, MindMapRequest
from app.services.gemini_service import generate_content


class MindMapGenerationError(RuntimeError):
    """The AI provider did not return a usable mind-map tree."""


SYSTEM_PROMPT = """
You create evidence-grounded study mind maps from the supplied slide text.
Return JSON only. Use exactly this recursive schema for every node:
{"id":"unique-string","title":"short title","summary":"short explanation",
 "page_references":[1],"children":[]}
Every id must be unique. Cite only supplied page numbers. Do not add facts that
are absent from the source. The root must describe the requested study scope.
""".strip()


def _node_budget(depth: str) -> str:
    return {
        "overview": "Use 2-4 top-level concepts and concise children.",
        "normal": "Use 3-6 top-level concepts with useful supporting children.",
        "detailed": "Use 4-8 top-level concepts and detailed supporting children.",
    }[depth]


def _build_source(request: MindMapRequest) -> str:
    pages = "\n\n".join(
        f"<page number=\"{page.page}\">\n{page.text}\n</page>"
        for page in request.content
    )
    return (
        f"Scope: {request.scope}\n"
        f"Requested detail: {request.depth}\n"
        f"{_node_budget(request.depth)}\n\n"
        f"Source pages:\n{pages}"
    )


def _parse_response(raw: str) -> MindMapNode:
    try:
        payload: Any = json.loads(raw)
        if isinstance(payload, dict) and "mind_map" in payload:
            payload = payload["mind_map"]
        root = MindMapNode.model_validate(payload)
        seen_ids: set[str] = set()

        def validate_tree(node: MindMapNode, depth: int = 0) -> None:
            if depth > 8 or len(seen_ids) >= 200 or node.id in seen_ids:
                raise ValueError("mind-map tree is too large, deep, or has duplicate ids")
            seen_ids.add(node.id)
            for child in node.children:
                validate_tree(child, depth + 1)

        validate_tree(root)
        return root
    except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as error:
        raise MindMapGenerationError("AI returned an invalid mind-map structure") from error


async def generate_mind_map(request: MindMapRequest) -> MindMapNode:
    try:
        raw = await generate_content(
            system_instruction=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_source(request)}],
            temperature=0.2,
            response_mime_type="application/json",
        )
    except Exception as error:
        raise MindMapGenerationError("Mind-map generation is unavailable") from error
    return _parse_response(raw)

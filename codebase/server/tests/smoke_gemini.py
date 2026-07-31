"""Manual Gemini smoke test that never prints the API key."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from app.schemas.summary import SummaryRequest
from app.services.gemini_service import generate_content, get_gemini_configuration
from app.services.summary_service import generate_summary


def load_configuration() -> str:
    load_dotenv(SERVER_DIR / ".env")
    return get_gemini_configuration().model


async def test_minimal_request(model: str) -> None:
    content = await generate_content(
        system_instruction="Reply exactly as requested.",
        messages=[{"role": "user", "content": [{"type": "text", "text": "Reply with OK."}]}],
        temperature=0,
    )
    print(json.dumps({"test": "minimal", "model": model, "content": content}, ensure_ascii=False))
    if not content:
        raise RuntimeError("Gemini returned no text content")


async def test_summary_page(page: int, model: str) -> None:
    result = await generate_summary(SummaryRequest(doc_id="lesson-01", current_page=page, language="VI"))
    print(json.dumps({"test": "summary", "model": model, **result.model_dump()}, ensure_ascii=False))
    if result.provider != "gemini":
        raise RuntimeError(result.notice or "Summary did not use Gemini")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=int)
    args = parser.parse_args()
    model = load_configuration()
    if args.page is None:
        asyncio.run(test_minimal_request(model))
    else:
        asyncio.run(test_summary_page(args.page, model))


if __name__ == "__main__":
    main()

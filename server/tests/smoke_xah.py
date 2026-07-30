"""Manual XAH smoke test.

Loads credentials from server/.env and never prints the API key.
Run:
    python tests/smoke_xah.py
    python tests/smoke_xah.py --page 12
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from app.schemas.summary import SummaryRequest
from app.services.summary_service import (
    _post_chat_completion,
    generate_summary,
)


def load_configuration() -> tuple[str, str, str]:
    load_dotenv(SERVER_DIR / ".env")
    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    base_url = os.getenv("AI_BASE_URL")
    model = os.getenv("AI_MODEL")
    if not api_key or not base_url or not model:
        raise RuntimeError("Thiếu XAH_API_KEY, AI_BASE_URL hoặc AI_MODEL trong server/.env")
    return api_key, base_url.rstrip("/"), model


def test_minimal_request(api_key: str, base_url: str, model: str) -> None:
    result = _post_chat_completion(
        f"{base_url}/chat/completions",
        api_key,
        {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": "Trả lời đúng một từ OK. Ký tự kiểm tra mã hóa: Ủ",
                }
            ],
            "temperature": 0,
        },
    )
    choices = result.get("choices") or []
    content = choices[0].get("message", {}).get("content") if choices else None
    print(json.dumps(
        {
            "test": "minimal",
            "model": model,
            "has_choices": bool(choices),
            "content": content,
        },
        ensure_ascii=True,
        indent=2,
    ))
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("XAH trả về nhưng không có message.content")


async def test_summary_page(page: int, model: str) -> None:
    result = await generate_summary(
        SummaryRequest(
            doc_id="lesson-01",
            current_page=page,
            language="VI",
        )
    )
    print(json.dumps(
        {
            "test": "summary",
            "model": model,
            **result.model_dump(),
        },
        ensure_ascii=True,
        indent=2,
    ))
    if result.provider != "xah":
        raise RuntimeError(result.notice or "Summary không dùng provider XAH")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=int)
    args = parser.parse_args()

    api_key, base_url, model = load_configuration()
    if args.page is None:
        test_minimal_request(api_key, base_url, model)
    else:
        asyncio.run(test_summary_page(args.page, model))


if __name__ == "__main__":
    main()

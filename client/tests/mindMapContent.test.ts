import assert from "node:assert/strict";
import test from "node:test";

import { loadMindMapSource } from "../src/lib/mindMapContent";


test("chỉ chuẩn bị đúng khoảng trang và tạo chữ ký nội dung ổn định", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    pages: [
      { page_number: 1, clean_text: "Slide 1" },
      { page_number: 2, clean_text: "Slide 2" },
      { page_number: 3, clean_text: "Slide 3" },
      { page_number: 4, clean_text: "Slide 4" },
    ],
  });
  try {
    const input = {
      documentId: "lesson-01",
      scope: "selected_pages" as const,
      depth: "normal" as const,
      startPage: 2,
      endPage: 3,
    };
    const first = await loadMindMapSource(input);
    const second = await loadMindMapSource(input);
    assert.deepEqual(first.pages.map((page) => page.page), [2, 3]);
    assert.equal(first.sourceSignature, second.sourceSignature);
    assert.equal(first.sourceSignature, "d69846ee0d6e88e4a739ea68");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadMindMapContent } from "../src/lib/mindMapContent";

test("loads every page in the selected inclusive range from the extracted document", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    pages: [
      { page_number: 5, clean_text: "Slide 5" },
      { page_number: 6, clean_text: "Slide 6" },
      { page_number: 7, clean_text: "Slide 7" },
      { page_number: 8, clean_text: "Slide 8" },
    ],
  });
  try {
    const content = await loadMindMapContent({
      documentId: "lesson-01",
      scope: "selected_pages",
      startPage: 6,
      endPage: 7,
      currentPage: 6,
    });
    assert.deepEqual(content, [
      { page: 6, text: "Slide 6" },
      { page: 7, text: "Slide 7" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

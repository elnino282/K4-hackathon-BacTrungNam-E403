import assert from "node:assert/strict";
import test from "node:test";

import { requestMindMap } from "../src/lib/mindMapRequest";


const apiResponse = {
  mind_map: {
    id: "root",
    title: "Bài học",
    summary: "Tổng quan.",
    page_references: [6],
    children: [],
  },
  scope: "selected_pages",
  depth: "normal",
  source_pages: [6, 7],
  source_signature: "signature",
  node_count: 1,
};

test("request chỉ gửi cấu hình phạm vi, không cho client nhét nội dung slide", async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json(apiResponse);
  };
  try {
    await requestMindMap({
      documentId: "lesson-01",
      scope: "selected_pages",
      depth: "normal",
      startPage: 6,
      endPage: 7,
    });
    assert.deepEqual(body, {
      scope: "selected_pages",
      depth: "normal",
      start_page: 6,
      end_page: 7,
    });
    assert.equal("content" in body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

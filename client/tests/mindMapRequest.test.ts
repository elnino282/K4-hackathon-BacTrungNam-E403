import assert from "node:assert/strict";
import test from "node:test";
import { requestMindMap } from "../src/lib/mindMapRequest";

test("posts extracted pages and a JSON-only contract to the live mind-map API", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    request = init;
    return Response.json({
      id: "root", title: "Root", summary: "", page_references: [1], children: [],
    });
  };
  try {
    await requestMindMap({
      documentId: "lesson-01",
      content: [{ page: 1, text: "AI product" }],
      scope: "whole_lecture",
      depth: "normal",
    });
    assert.equal(request?.method, "POST");
    assert.deepEqual(JSON.parse(String(request?.body)).content, [{ page: 1, text: "AI product" }]);
    assert.match(String(request?.body), /page_references/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

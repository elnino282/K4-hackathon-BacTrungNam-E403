import assert from "node:assert/strict";
import test from "node:test";
import { requestMindMap } from "../src/lib/mindMapRequest";

test("posts extracted pages and a JSON-only contract to the live mind-map API", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  let url: RequestInfo | URL | undefined;
  globalThis.fetch = async (requestUrl, init) => {
    url = requestUrl;
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
    assert.equal(url, "/api/documents/lesson-01/mind-map");
    assert.deepEqual(JSON.parse(String(request?.body)), {
      content: [{ page: 1, text: "AI product" }],
      scope: "whole_lecture",
      depth: "normal",
    });
    assert.doesNotMatch(String(request?.body), /\"prompt\"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("posts selected pages using the backend-supported range scope", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = async (_requestUrl, init) => {
    request = init;
    return Response.json({
      id: "root", title: "Root", summary: "", page_references: [6, 7], children: [],
    });
  };
  try {
    await requestMindMap({
      documentId: "lesson-01",
      content: [{ page: 6, text: "Slide 6" }, { page: 7, text: "Slide 7" }],
      scope: "selected_pages",
      depth: "normal",
    });
    assert.deepEqual(JSON.parse(String(request?.body)), {
      content: [{ page: 6, text: "Slide 6" }, { page: 7, text: "Slide 7" }],
      scope: "selected_pages",
      depth: "normal",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createMindMapCacheKey,
  parseMindMapResponse,
} from "../src/lib/mindMap";
import {
  readMindMapCache,
  removeMindMapCache,
  writeMindMapCache,
} from "../src/lib/mindMapCache";


const response = {
  mind_map: {
    id: "root",
    title: "Bài học",
    summary: "Tổng quan bài học.",
    page_references: [2],
    children: [{
      id: "actor",
      title: "Actor",
      summary: "Người thực hiện công việc.",
      page_references: [2],
      children: [],
    }],
  },
  scope: "selected_pages",
  depth: "normal",
  source_pages: [2, 3],
  source_signature: "abc123",
  node_count: 2,
};

test("chuẩn hóa cây Mind Map và giữ metadata nguồn", () => {
  const parsed = parseMindMapResponse(response);
  assert.equal(parsed.mindMap.children[0].title, "Actor");
  assert.deepEqual(parsed.sourcePages, [2, 3]);
  assert.equal(parsed.nodeCount, 2);
});

test("từ chối node dẫn trang ngoài phạm vi hoặc số node không khớp", () => {
  const wrongSource = structuredClone(response);
  wrongSource.mind_map.children[0].page_references = [9];
  assert.throws(() => parseMindMapResponse(wrongSource));
  assert.throws(() => parseMindMapResponse({ ...response, node_count: 99 }));
});

test("cache tách riêng phạm vi, độ sâu và phiên bản nội dung", () => {
  const base = {
    documentId: "lesson-01",
    scope: "selected_pages" as const,
    depth: "normal" as const,
    startPage: 2,
    endPage: 3,
  };
  assert.notEqual(
    createMindMapCacheKey(base, "source-a"),
    createMindMapCacheKey({ ...base, depth: "detailed" }, "source-a"),
  );
  assert.notEqual(
    createMindMapCacheKey(base, "source-a"),
    createMindMapCacheKey(base, "source-b"),
  );
});

test("ghi, đọc và xóa đúng một Mind Map trong localStorage", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  const parsed = parseMindMapResponse(response);
  writeMindMapCache("map-a", parsed);
  writeMindMapCache("map-b", parsed);
  assert.deepEqual(readMindMapCache("map-a"), parsed);
  removeMindMapCache("map-a");
  assert.equal(readMindMapCache("map-a"), null);
  assert.deepEqual(readMindMapCache("map-b"), parsed);
});

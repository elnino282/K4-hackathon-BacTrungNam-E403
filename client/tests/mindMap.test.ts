import test from "node:test";
import assert from "node:assert/strict";
import { createMindMapCacheKey, parseMindMapResponse } from "../src/lib/mindMap";

test("normalizes hierarchical JSON-only mind maps", () => {
  const result = parseMindMapResponse({ id: "root", title: "Bài giảng", summary: "Tổng quan", page_references: [1], children: [] });
  assert.deepEqual(result.pageReferences, [1]);
});

test("cache key separates document scopes", () => {
  const whole = createMindMapCacheKey({ documentId: "lesson-01", scope: "whole_lecture", depth: "normal", pages: [1, 2], content: "abc" });
  const current = createMindMapCacheKey({ documentId: "lesson-01", scope: "current_page", depth: "normal", pages: [1], content: "abc" });
  assert.notEqual(whole, current);
});

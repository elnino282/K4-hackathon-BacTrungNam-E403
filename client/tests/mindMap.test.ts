import test from "node:test";
import assert from "node:assert/strict";
import { createMindMapCacheKey, parseMindMapResponse } from "../src/lib/mindMap";
import { readMindMapCache, removeMindMapCache, writeMindMapCache } from "../src/lib/mindMapCache";

const validMap = {
  id: "root",
  title: "Root",
  summary: "Tổng quan",
  pageReferences: [1],
  children: [],
};

const installMemoryStorage = () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
};

test("normalizes hierarchical JSON-only mind maps", () => {
  const result = parseMindMapResponse({ id: "root", title: "Bài giảng", summary: "Tổng quan", page_references: [1], children: [] });
  assert.deepEqual(result.pageReferences, [1]);
});

test("cache key separates document scopes", () => {
  const whole = createMindMapCacheKey({ documentId: "lesson-01", scope: "whole_lecture", depth: "normal", pages: [1, 2], content: "abc" });
  const current = createMindMapCacheKey({ documentId: "lesson-01", scope: "current_page", depth: "normal", pages: [1], content: "abc" });
  assert.notEqual(whole, current);
});

test("rejects a mind map with duplicate node ids", () => {
  assert.throws(() => parseMindMapResponse({
    id: "root",
    title: "Root",
    summary: "",
    page_references: [1],
    children: [{
      id: "root",
      title: "Repeated",
      summary: "",
      page_references: [2],
      children: [],
    }],
  }));
});

test("removes only the requested mind-map cache entry", () => {
  installMemoryStorage();
  writeMindMapCache("mind-a", validMap);
  writeMindMapCache("mind-b", validMap);

  removeMindMapCache("mind-a");

  assert.equal(readMindMapCache("mind-a"), null);
  assert.deepEqual(readMindMapCache("mind-b"), validMap);
});

export type MindMapScope = "current_page" | "selected_pages" | "whole_lecture";
export type MindMapDepth = "overview" | "normal" | "detailed";
export interface MindMapNode { id: string; title: string; summary: string; pageReferences: number[]; children: MindMapNode[]; }
export interface MindMapCacheInput { documentId: string; scope: MindMapScope; depth: MindMapDepth; pages: number[]; content: string; }

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI trả về sơ đồ không hợp lệ.");
  return value as Record<string, unknown>;
};
export function parseMindMapResponse(value: unknown): MindMapNode {
  const record = asRecord(asRecord(value).mind_map ?? value);
  const id = record.id, title = record.title, summary = record.summary;
  const pages = record.page_references ?? record.pageReferences ?? [];
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof summary !== "string" || !Array.isArray(pages) || !pages.every((p) => Number.isInteger(p) && p > 0) || !Array.isArray(record.children)) throw new Error("AI trả về sơ đồ không đúng cấu trúc JSON.");
  return { id, title, summary, pageReferences: pages as number[], children: record.children.map(parseMindMapResponse) };
}
export function createMindMapCacheKey(input: MindMapCacheInput) {
  let hash = 5381; for (const char of input.content) hash = (hash * 33) ^ char.charCodeAt(0);
  return `vlearn:mind-map:${input.documentId}:${input.scope}:${input.depth}:${input.pages.join(",")}:${hash >>> 0}`;
}


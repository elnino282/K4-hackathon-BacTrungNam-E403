export type MindMapScope = "current_page" | "selected_pages" | "whole_lecture";
export type MindMapDepth = "overview" | "normal" | "detailed";

export interface MindMapNode {
  id: string;
  title: string;
  summary: string;
  pageReferences: number[];
  children: MindMapNode[];
}

export interface MindMapCacheInput {
  documentId: string;
  scope: MindMapScope;
  depth: MindMapDepth;
  pages: number[];
  content: string;
}

const MAX_MIND_MAP_DEPTH = 8;
const MAX_MIND_MAP_NODES = 200;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI trả về sơ đồ không hợp lệ.");
  }
  return value as Record<string, unknown>;
};

export function parseMindMapResponse(value: unknown): MindMapNode {
  const root = asRecord(value).mind_map ?? value;
  const seenIds = new Set<string>();

  const parseNode = (candidate: unknown, depth: number): MindMapNode => {
    if (depth > MAX_MIND_MAP_DEPTH || seenIds.size >= MAX_MIND_MAP_NODES) {
      throw new Error("Sơ đồ tư duy quá lớn hoặc quá sâu.");
    }

    const record = asRecord(candidate);
    const id = record.id;
    const title = record.title;
    const summary = record.summary;
    const pages = record.page_references ?? record.pageReferences ?? [];

    if (
      typeof id !== "string" || !id.trim() || typeof title !== "string" ||
      !title.trim() || typeof summary !== "string" || !Array.isArray(pages) ||
      !pages.every((page) => Number.isInteger(page) && page > 0) ||
      !Array.isArray(record.children)
    ) {
      throw new Error("AI trả về sơ đồ không đúng cấu trúc JSON.");
    }
    if (seenIds.has(id)) {
      throw new Error("AI trả về sơ đồ có node trùng lặp.");
    }

    seenIds.add(id);
    return {
      id,
      title,
      summary,
      pageReferences: pages as number[],
      children: record.children.map((child) => parseNode(child, depth + 1)),
    };
  };

  return parseNode(root, 0);
}

export function createMindMapCacheKey(input: MindMapCacheInput): string {
  let hash = 5381;
  for (const char of input.content) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return `vlearn:mind-map:${input.documentId}:${input.scope}:${input.depth}:${input.pages.join(",")}:${hash >>> 0}`;
}

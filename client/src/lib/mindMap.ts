export type MindMapScope =
  | "current_page"
  | "selected_pages"
  | "whole_lecture";
export type MindMapDepth = "overview" | "normal" | "detailed";
export type MindMapStatus =
  | "idle"
  | "preparing"
  | "generating"
  | "ready"
  | "error";

export interface MindMapNode {
  id: string;
  title: string;
  summary: string;
  pageReferences: number[];
  children: MindMapNode[];
}

export interface MindMapResult {
  mindMap: MindMapNode;
  scope: MindMapScope;
  depth: MindMapDepth;
  sourcePages: number[];
  sourceSignature: string;
  nodeCount: number;
}

export interface MindMapRequestInput {
  documentId: string;
  scope: MindMapScope;
  depth: MindMapDepth;
  currentPage?: number;
  startPage?: number;
  endPage?: number;
}

const MAX_DEPTH = 6;
const MAX_NODES = 200;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI trả về sơ đồ không hợp lệ.");
  }
  return value as Record<string, unknown>;
};

export function parseMindMapResponse(value: unknown): MindMapResult {
  const response = asRecord(value);
  const sourcePagesRaw = response.source_pages ?? response.sourcePages;
  const sourceSignature = response.source_signature ?? response.sourceSignature;
  const nodeCountRaw = response.node_count ?? response.nodeCount;
  if (
    !Array.isArray(sourcePagesRaw)
    || !sourcePagesRaw.every((page) => Number.isInteger(page) && page > 0)
    || typeof sourceSignature !== "string"
    || !sourceSignature
    || !Number.isInteger(nodeCountRaw)
  ) {
    throw new Error("Phản hồi sơ đồ thiếu thông tin nguồn.");
  }
  const sourcePages = sourcePagesRaw as number[];
  const allowedPages = new Set(sourcePages);
  const seenIds = new Set<string>();
  let actualNodeCount = 0;

  const parseNode = (candidate: unknown, depth: number): MindMapNode => {
    if (depth > MAX_DEPTH || actualNodeCount >= MAX_NODES) {
      throw new Error("Sơ đồ tư duy quá lớn hoặc quá sâu.");
    }
    const record = asRecord(candidate);
    const pages = record.page_references ?? record.pageReferences;
    if (
      typeof record.id !== "string"
      || !record.id.trim()
      || typeof record.title !== "string"
      || !record.title.trim()
      || typeof record.summary !== "string"
      || !record.summary.trim()
      || !Array.isArray(pages)
      || pages.length === 0
      || !pages.every((page) => Number.isInteger(page) && allowedPages.has(page as number))
      || !Array.isArray(record.children)
    ) {
      throw new Error("AI trả về node không đúng cấu trúc hoặc sai nguồn trang.");
    }
    if (seenIds.has(record.id)) {
      throw new Error("AI trả về sơ đồ có node trùng lặp.");
    }
    seenIds.add(record.id);
    actualNodeCount += 1;
    return {
      id: record.id,
      title: record.title,
      summary: record.summary,
      pageReferences: pages as number[],
      children: record.children.map((child) => parseNode(child, depth + 1)),
    };
  };

  const mindMap = parseNode(response.mind_map ?? response.mindMap, 0);
  if (actualNodeCount !== nodeCountRaw) {
    throw new Error("Số node trong phản hồi không khớp dữ liệu sơ đồ.");
  }
  const scope = response.scope;
  const depth = response.depth;
  if (
    !["current_page", "selected_pages", "whole_lecture"].includes(String(scope))
    || !["overview", "normal", "detailed"].includes(String(depth))
  ) {
    throw new Error("Phản hồi sơ đồ có cấu hình không hợp lệ.");
  }
  return {
    mindMap,
    scope: scope as MindMapScope,
    depth: depth as MindMapDepth,
    sourcePages,
    sourceSignature,
    nodeCount: actualNodeCount,
  };
}

export function createMindMapCacheKey(
  input: MindMapRequestInput,
  sourceSignature: string,
): string {
  const scopeKey = input.scope === "current_page"
    ? `page-${input.currentPage}`
    : input.scope === "selected_pages"
      ? `pages-${input.startPage}-${input.endPage}`
      : "whole";
  return [
    "vlearn",
    "mind-map-v2",
    input.documentId,
    scopeKey,
    input.depth,
    sourceSignature,
  ].join(":");
}

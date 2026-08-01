import { MindMapResult, parseMindMapResponse } from "./mindMap";


export function readMindMapCache(key: string): MindMapResult | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parseMindMapResponse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeMindMapCache(key: string, result: MindMapResult): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      mind_map: serializeNode(result.mindMap),
      scope: result.scope,
      depth: result.depth,
      source_pages: result.sourcePages,
      source_signature: result.sourceSignature,
      node_count: result.nodeCount,
    }));
  } catch {
    // Cache là tối ưu tùy chọn; sơ đồ trong bộ nhớ vẫn sử dụng bình thường.
  }
}

export function removeMindMapCache(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Không cần làm gián đoạn luồng học nếu trình duyệt chặn localStorage.
  }
}

function serializeNode(node: MindMapResult["mindMap"]): Record<string, unknown> {
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    page_references: node.pageReferences,
    children: node.children.map(serializeNode),
  };
}

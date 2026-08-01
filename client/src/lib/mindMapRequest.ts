import { fetchWithTimeout } from "./apiClient";
import { MindMapDepth, MindMapNode, MindMapScope, parseMindMapResponse } from "./mindMap";
export interface MindMapRequestInput { documentId: string; content: { page: number; text: string }[]; scope: MindMapScope; depth: MindMapDepth; }
const prompt = "Return hierarchical JSON only. Each node must contain id, title, summary, page_references and children. Never return Markdown or HTML.";
export async function requestMindMap(input: MindMapRequestInput): Promise<MindMapNode> {
 const response = await fetchWithTimeout(`/api/documents/${input.documentId}/mind-map`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, prompt }) });
 if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "Không thể tạo sơ đồ tư duy.");
 return parseMindMapResponse(await response.json());
}

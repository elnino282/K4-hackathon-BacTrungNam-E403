import { fetchWithTimeout } from "./apiClient";
import { MindMapDepth, MindMapNode, MindMapScope, parseMindMapResponse } from "./mindMap";
export interface MindMapRequestInput { documentId: string; content: { page: number; text: string }[]; scope: MindMapScope; depth: MindMapDepth; }
export async function requestMindMap(input: MindMapRequestInput): Promise<MindMapNode> {
 const { documentId, ...payload } = input;
 const response = await fetchWithTimeout(`/api/documents/${documentId}/mind-map`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
 if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "Không thể tạo sơ đồ tư duy.");
 return parseMindMapResponse(await response.json());
}

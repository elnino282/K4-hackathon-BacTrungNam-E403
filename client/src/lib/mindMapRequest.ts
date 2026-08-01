import { fetchWithTimeout } from "./apiClient";
import {
  MindMapRequestInput,
  MindMapResult,
  parseMindMapResponse,
} from "./mindMap";


export async function requestMindMap(
  input: MindMapRequestInput,
): Promise<MindMapResult> {
  const body: Record<string, unknown> = {
    scope: input.scope,
    depth: input.depth,
  };
  if (input.scope === "current_page") {
    body.current_page = input.currentPage;
  } else if (input.scope === "selected_pages") {
    body.start_page = input.startPage;
    body.end_page = input.endPage;
  }

  const response = await fetchWithTimeout(
    `/api/documents/${input.documentId}/mind-map`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    90_000,
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : "Không thể tạo sơ đồ tư duy.",
    );
  }
  return parseMindMapResponse(await response.json());
}

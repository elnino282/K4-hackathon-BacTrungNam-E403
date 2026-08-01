import { fetchWithTimeout } from "./apiClient";
import type { MindMapScope } from "./mindMap";

interface ExtractedPage {
  page_number: number;
  clean_text?: string;
  text?: string;
}

interface ExtractedDocument {
  pages?: ExtractedPage[];
}

interface LoadMindMapContentInput {
  documentId: string;
  scope: MindMapScope;
  currentPage: number;
  startPage: number;
  endPage: number;
}

export async function loadMindMapContent({
  documentId,
  scope,
  currentPage,
  startPage,
  endPage,
}: LoadMindMapContentInput): Promise<{ page: number; text: string }[]> {
  const response = await fetchWithTimeout(`/api/documents/${documentId}`);
  if (!response.ok) {
    throw new Error("Không thể đọc nội dung tài liệu để tạo sơ đồ tư duy.");
  }

  const document = await response.json() as ExtractedDocument;
  const pages = Array.isArray(document.pages) ? document.pages : [];
  const isInScope = (page: number) => {
    if (scope === "current_page") return page === currentPage;
    if (scope === "selected_pages") return page >= startPage && page <= endPage;
    return true;
  };

  return pages
    .filter((item) => Number.isInteger(item.page_number) && isInScope(item.page_number))
    .map((item) => ({ page: item.page_number, text: (item.clean_text ?? item.text ?? "").trim() }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => left.page - right.page);
}

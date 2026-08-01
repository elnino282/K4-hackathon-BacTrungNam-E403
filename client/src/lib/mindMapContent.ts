import { fetchWithTimeout } from "./apiClient";
import type { MindMapRequestInput } from "./mindMap";


interface ExtractedPage {
  page_number: number;
  clean_text?: string;
  text?: string;
}

interface ExtractedDocument {
  pages?: ExtractedPage[];
}

export interface MindMapSourceInfo {
  pages: Array<{ page: number; text: string }>;
  sourceSignature: string;
}

export async function loadMindMapSource(
  input: MindMapRequestInput,
): Promise<MindMapSourceInfo> {
  const response = await fetchWithTimeout(
    `/api/documents/${input.documentId}`,
  );
  if (!response.ok) {
    throw new Error("Không thể đọc nội dung tài liệu để tạo sơ đồ tư duy.");
  }
  const document = await response.json() as ExtractedDocument;
  const allPages = (Array.isArray(document.pages) ? document.pages : [])
    .filter((page) => Number.isInteger(page.page_number))
    .map((page) => ({
      page: page.page_number,
      text: (page.clean_text ?? page.text ?? "").trim(),
    }))
    .filter((page) => page.text.length > 0)
    .sort((left, right) => left.page - right.page);

  const pages = allPages.filter(({ page }) => {
    if (input.scope === "current_page") return page === input.currentPage;
    if (input.scope === "selected_pages") {
      return page >= (input.startPage ?? 0) && page <= (input.endPage ?? 0);
    }
    return true;
  });
  if (pages.length === 0) {
    throw new Error("Không tìm thấy nội dung trong phạm vi trang đã chọn.");
  }

  const signatureInput = pages
    .map(({ page, text }) => `${page}\0${text}\0`)
    .join("");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(signatureInput),
  );
  const sourceSignature = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);

  return { pages, sourceSignature };
}

export type SummaryScope = {
  current_page?: number;
  start_page?: number;
  end_page?: number;
};

const PAGE_REFERENCE =
  /(?:slides?|slid\s*e?|trang)\s*[:#-]?\s*(\d+)/;

export function normalizeForIntent(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function getReferencedPage(message: string): number | null {
  const match = normalizeForIntent(message).match(PAGE_REFERENCE);
  return match ? Number(match[1]) : null;
}

export function getSummaryScope(
  message: string,
  defaultPage: number,
): SummaryScope | null {
  const normalized = normalizeForIntent(message);

  // Chấp nhận cả "tóm tắt", lỗi gõ phổ biến "tóm tắm" và tiếng Anh.
  if (!/tom\s*ta[tm]|summari[sz]e|summary/.test(normalized)) {
    return null;
  }

  const asksForWholeDeck =
    /tom\s*ta[tm]\s*(?:het|toan\s*bo|ca\s*(?:bai|bo)|tat\s*ca)|(?:summari[sz]e|summary).*(?:all|entire|whole)/.test(
      normalized,
    );
  if (asksForWholeDeck) {
    return {};
  }

  const rangeMatch = normalized.match(
    /(?:slides?|slid\s*e?|trang)\s*[:#-]?\s*(\d+)\s*(?:va|&|,|-|den|to)\s*(?:(?:slides?|slid\s*e?|trang)\s*)?(\d+)/,
  );
  if (rangeMatch) {
    const firstPage = Number(rangeMatch[1]);
    const secondPage = Number(rangeMatch[2]);
    return {
      start_page: Math.min(firstPage, secondPage),
      end_page: Math.max(firstPage, secondPage),
    };
  }

  return { current_page: getReferencedPage(message) ?? defaultPage };
}

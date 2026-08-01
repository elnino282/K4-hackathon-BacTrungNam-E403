export type SummaryScope = {
  current_page?: number;
  start_page?: number;
  end_page?: number;
};

export type SummaryIntentResult =
  | { kind: "not_summary" }
  | { kind: "valid"; scope: SummaryScope }
  | { kind: "invalid"; error: string };

const PAGE_WORD = String.raw`(?:slides?|pages?|slid\s*e?|trang)`;
const PAGE_REFERENCE = new RegExp(
  String.raw`${PAGE_WORD}\s*(?:thu\s*)?[:#]?\s*(\d+)`,
);
const PAGE_SEQUENCE = new RegExp(
  String.raw`${PAGE_WORD}\s*(?:thu\s*)?[:#]?\s*(\d+)((?:(?:\s*(?:va|&|,|-|den|to)\s*|\s+)(?:${PAGE_WORD}\s*)?(?:thu\s*)?\d+)*)`,
);
const LAST_PAGE_REFERENCE = new RegExp(
  String.raw`(?:${PAGE_WORD}\s+(?:cuoi(?:\s+cung)?|last|final)|(?:last|final)\s+${PAGE_WORD})\b`,
);
const SUMMARY_PATTERN = /tom\s*ta[tm]|summari[sz]e|summary/;
const WHOLE_DECK_PATTERN =
  /tom\s*ta[tm]\s*(?:het|toan\s*bo|ca\s*(?:bai|bo)|tat\s*ca)|(?:summari[sz]e|summary).*(?:all|entire|whole)/;
const EXCLUSION_PATTERN =
  /\b(?:tru|ngoai\s+tru|except|excluding|without)\b/;

export function normalizeForIntent(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function getReferencedPage(
  message: string,
  totalPages?: number,
): number | null {
  const normalized = normalizeForIntent(message);
  if (
    new RegExp(
      String.raw`${PAGE_WORD}\s*(?:thu\s*)?[:#]?\s*-\s*\d+`,
    ).test(normalized)
  ) {
    return null;
  }
  const match = normalized.match(PAGE_REFERENCE);
  if (match) return Number(match[1]);
  if (LAST_PAGE_REFERENCE.test(normalized) && totalPages && totalPages >= 1) {
    return totalPages;
  }
  return null;
}

export function parseSummaryIntent(
  message: string,
  defaultPage: number,
  totalPages: number,
): SummaryIntentResult {
  const normalized = normalizeForIntent(message);
  if (!SUMMARY_PATTERN.test(normalized)) {
    return { kind: "not_summary" };
  }

  if (EXCLUSION_PATTERN.test(normalized)) {
    return {
      kind: "invalid",
      error:
        "Hiện chưa hỗ trợ phạm vi có điều kiện “trừ/ngoại trừ”. Hãy chọn một trang, một khoảng liên tiếp hoặc toàn bộ tài liệu.",
    };
  }

  if (WHOLE_DECK_PATTERN.test(normalized)) {
    return { kind: "valid", scope: {} };
  }

  const negativePage = new RegExp(
    String.raw`${PAGE_WORD}\s*(?:thu\s*)?[:#]?\s*-\s*\d+`,
  );
  const decimalPage = new RegExp(
    String.raw`${PAGE_WORD}\s*(?:thu\s*)?[:#]?\s*\d+\.\d+`,
  );
  if (negativePage.test(normalized) || decimalPage.test(normalized)) {
    return {
      kind: "invalid",
      error: "Số trang phải là số nguyên dương.",
    };
  }

  if (LAST_PAGE_REFERENCE.test(normalized)) {
    return { kind: "valid", scope: { current_page: totalPages } };
  }

  const sequenceMatch = normalized.match(PAGE_SEQUENCE);
  const numbers = sequenceMatch
    ? (sequenceMatch[0].match(/\d+/g) ?? []).map(Number)
    : [];

  if (numbers.length === 0) {
    if (defaultPage < 1 || defaultPage > totalPages) {
      return {
        kind: "invalid",
        error: `Trang đang mở nằm ngoài tài liệu 1-${totalPages}.`,
      };
    }
    return { kind: "valid", scope: { current_page: defaultPage } };
  }

  const invalidPage = numbers.find(
    (page) => page < 1 || page > totalPages,
  );
  if (invalidPage !== undefined) {
    return {
      kind: "invalid",
      error: `Trang ${invalidPage} nằm ngoài tài liệu 1-${totalPages}.`,
    };
  }

  if (numbers.length === 1) {
    return { kind: "valid", scope: { current_page: numbers[0] } };
  }

  const firstPage = numbers[0];
  const lastPage = numbers[numbers.length - 1];
  if (numbers.some((page, index) => index > 0 && page <= numbers[index - 1])) {
    return {
      kind: "invalid",
      error: "Các trang phải được nhập theo thứ tự tăng dần.",
    };
  }

  const explicitRange =
    numbers.length === 2 &&
    /(?:\bden\b|\bto\b|\d+\s*-\s*\d+)/.test(sequenceMatch?.[0] ?? "");
  const contiguousList = numbers.every(
    (page, index) => page === firstPage + index,
  );
  if (!explicitRange && !contiguousList) {
    return {
      kind: "invalid",
      error:
        "Hiện chỉ hỗ trợ một trang hoặc một khoảng trang liên tiếp. Ví dụ: “trang 7 đến 9”.",
    };
  }
  if (explicitRange && numbers.length !== 2) {
    return {
      kind: "invalid",
      error: "Khoảng trang chỉ được có một trang bắt đầu và một trang kết thúc.",
    };
  }

  return {
    kind: "valid",
    scope: {
      start_page: firstPage,
      end_page: lastPage,
    },
  };
}

export function getSummaryScope(
  message: string,
  defaultPage: number,
  totalPages = Number.MAX_SAFE_INTEGER,
): SummaryScope | null {
  const result = parseSummaryIntent(
    message,
    defaultPage,
    totalPages,
  );
  return result.kind === "valid" ? result.scope : null;
}

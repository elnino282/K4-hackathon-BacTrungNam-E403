import { Language } from "../types";


interface MessageSourceLabelInput {
  scopeDescription?: string;
  learningPages?: number[];
  contextPage?: number;
  fallbackPage: number;
  language: Language;
}

function formatPages(pages: number[]): string {
  if (pages.length === 1) return String(pages[0]);

  const contiguous = pages.every(
    (page, index) => index === 0 || page === pages[index - 1] + 1,
  );
  return contiguous
    ? `${pages[0]}–${pages[pages.length - 1]}`
    : pages.join(", ");
}

export function getMessageSourceLabel({
  scopeDescription,
  learningPages,
  contextPage,
  fallbackPage,
  language,
}: MessageSourceLabelInput): string {
  if (scopeDescription) return scopeDescription;

  const pages = learningPages?.length
    ? learningPages
    : [contextPage ?? fallbackPage];
  const pageLabel = formatPages(pages);
  return language === "VI"
    ? `Nội dung bài học Trang ${pageLabel}`
    : `Lesson content Pages ${pageLabel}`;
}

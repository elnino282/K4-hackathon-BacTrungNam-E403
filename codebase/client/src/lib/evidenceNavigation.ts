export type SpanRange = {
  startIndex: number;
  endIndex: number;
};

export function normalizeEvidenceNavigationText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function findEvidenceSpanRange(
  spanTexts: string[],
  evidenceQuote: string,
): SpanRange | null {
  const normalizedQuote = normalizeEvidenceNavigationText(evidenceQuote);
  if (!normalizedQuote) return null;

  const normalizedSpans = spanTexts.map(normalizeEvidenceNavigationText);
  const offsets: Array<{ start: number; end: number }> = [];
  let combined = "";

  normalizedSpans.forEach((text) => {
    if (combined && text) combined += " ";
    const start = combined.length;
    combined += text;
    offsets.push({ start, end: combined.length });
  });

  const quoteWords = normalizedQuote.split(" ").filter(Boolean);
  const candidates = [
    normalizedQuote,
    quoteWords.slice(0, Math.min(14, quoteWords.length)).join(" "),
    quoteWords.slice(0, Math.min(8, quoteWords.length)).join(" "),
  ].filter((candidate, index, values) => (
    candidate.length >= 12 && values.indexOf(candidate) === index
  ));

  let matchStart = -1;
  let matchLength = 0;
  for (const candidate of candidates) {
    const candidateStart = combined.indexOf(candidate);
    if (candidateStart >= 0) {
      matchStart = candidateStart;
      matchLength = candidate.length;
      break;
    }
  }
  if (matchStart < 0) return null;

  const matchEnd = matchStart + matchLength;
  const startIndex = offsets.findIndex(
    (offset) => offset.end > matchStart,
  );
  let endIndex = offsets.length - 1;
  for (let index = startIndex; index < offsets.length; index += 1) {
    if (offsets[index].start >= matchEnd) {
      endIndex = Math.max(startIndex, index - 1);
      break;
    }
  }

  return startIndex >= 0 ? { startIndex, endIndex } : null;
}

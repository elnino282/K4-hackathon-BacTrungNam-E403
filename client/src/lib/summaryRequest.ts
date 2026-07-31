import { SummaryScope } from "./summaryIntent";
import { Language, SummaryDepth } from "../types";


export interface SummaryApiRequest extends SummaryScope {
  doc_id: string;
  language: Language;
  depth: SummaryDepth;
}

export function buildSummaryApiRequest(
  scope: SummaryScope,
  language: Language,
  depth: SummaryDepth,
): SummaryApiRequest {
  return {
    doc_id: "lesson-01",
    ...scope,
    language,
    depth,
  };
}

export function getSummaryScopePages(
  scope: SummaryScope,
  maximumPages = 5,
): number[] {
  if (scope.current_page !== undefined) {
    return [scope.current_page];
  }
  if (
    scope.start_page === undefined ||
    scope.end_page === undefined ||
    scope.end_page < scope.start_page
  ) {
    return [];
  }

  return Array.from(
    {
      length: Math.min(
        scope.end_page - scope.start_page + 1,
        maximumPages,
      ),
    },
    (_, index) => scope.start_page! + index,
  );
}

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

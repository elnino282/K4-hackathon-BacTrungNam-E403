export type Language = "VI" | "EN";

export interface ContextSnippet {
  text: string;
  pageNumber: number;
  slideTitle?: string;
  sourceLabel?: string;
}

export interface SummaryKeyPointData {
  claim: string;
  page: number;
  source_id?: string | null;
  evidence_quote: string;
  verified: boolean;
  verification_method: string;
}

export interface SummaryCoverageData {
  requested_pages: number;
  processed_pages: number;
  verified_points: number;
  rejected_points: number;
  target_min_points: number;
  target_max_points: number;
}

export type SummaryStatus =
  | "verified"
  | "partial"
  | "fallback"
  | "error"
  | "not_applicable";

export interface SummaryData {
  summary: string;
  key_points: SummaryKeyPointData[];
  scope_description: string;
  coverage: SummaryCoverageData;
  status: SummaryStatus;
  provider: string;
  notice?: string | null;
  cached?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  context?: ContextSnippet;
  isLoading?: boolean;
  summaryData?: SummaryData;
  suppressFollowUps?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  pageNumber: number;
  messages: ChatMessage[];
}

export interface SlideData {
  pageNumber: number;
  title: string;
  subtitle: string;
  contentLines: string[];
  instructor: string;
  notesCount: number;
}

export interface PDFDocumentData {
  fileName: string;
  numPages: number;
  fileUrl?: string;
  fileBuffer?: ArrayBuffer;
  extractedTextByPage?: { [pageNumber: number]: string };
}




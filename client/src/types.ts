export type Language = "VI" | "EN";

export interface ContextSnippet {
  text: string;
  pageNumber: number;
  slideTitle?: string;
  sourceLabel?: string;
}

export interface EvidenceNavigationTarget {
  pageNumber: number;
  evidenceQuote?: string;
  requestId: number;
}

export interface NoteSelection {
  id: string;
  pageNumber: number;
  text: string;
  kind: "text" | "rectangle" | "freehand";
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageDataUrl?: string;
}

export interface SavedNoteRegion {
  noteId: string;
  regionIndex: number;
  noteTitle: string;
  pageNumber: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AINote {
  id: string;
  docId: string;
  title: string;
  summary: string;
  keyTakeaways: string[];
  example?: string | null;
  misconception?: string | null;
  sourcePages: number[];
  sourceExcerpts: string[];
  selectionCount: number;
  verifiedSelections: number;
  selectionBounds: Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  userText: string;
  provider: string;
  status: "generated" | "fallback" | "merged";
  originNoteIds?: string[];
  viewCount?: number;
  lastViewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningContext {
  priorAnswer: string;
  pages: number[];
}

export interface SummaryKeyPointData {
  claim: string;
  page: number;
  source_id?: string | null;
  evidence_quote: string;
  verified: boolean;
  verification_method: string;
}

export type AssessmentVerdict = "correct" | "partial" | "incorrect";

export interface LearningMeasurementRecord {
  id: string;
  docId: string;
  page: number;
  claim: string;
  preScore: 0 | 50 | 100;
  postScore: 0 | 50 | 100;
  delta: number;
  durationSeconds: number;
  sourceOpenCount: number;
  helpful: boolean | null;
  provider: string;
  completedAt: string;
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
export type SummaryDepth = "quick" | "standard" | "study";

export interface SummaryData {
  summary: string;
  key_points: SummaryKeyPointData[];
  scope_description: string;
  coverage: SummaryCoverageData;
  status: SummaryStatus;
  provider: string;
  notice?: string | null;
  cached?: boolean;
  depth?: SummaryDepth;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  context?: ContextSnippet;
  isLoading?: boolean;
  summaryData?: SummaryData;
  learningContext?: LearningContext;
  responseKind?: "answer" | "example" | "quiz";
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




export type Language = "VI" | "EN";

export interface ContextSnippet {
  text: string;
  pageNumber: number;
  slideTitle?: string;
  sourceLabel?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  context?: ContextSnippet;
  isLoading?: boolean;
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




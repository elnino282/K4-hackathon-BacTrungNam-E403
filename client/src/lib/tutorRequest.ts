import { Language, LearningContext } from "../types";


export interface TutorApiRequest {
  message: string;
  selected_text?: string;
  page_context: number;
  slide_title: string;
  language: Language;
  context_pages?: number[];
  prior_answer?: string;
}

interface TutorApiRequestInput {
  message: string;
  selectedText?: string;
  pageContext: number;
  slideTitle: string;
  language: Language;
  learningContext?: LearningContext;
}

interface ResolveLearningContextInput {
  explicitContext?: LearningContext;
  previousContext?: LearningContext;
  hasSelectedText: boolean;
  referencedPage: number | null;
  isSummaryRequest: boolean;
}

export function resolveTutorLearningContext({
  explicitContext,
  previousContext,
  hasSelectedText,
  referencedPage,
  isSummaryRequest,
}: ResolveLearningContextInput): LearningContext | undefined {
  if (explicitContext) return explicitContext;
  if (isSummaryRequest || hasSelectedText || referencedPage !== null) {
    return undefined;
  }
  return previousContext;
}

export function buildTutorApiRequest(
  input: TutorApiRequestInput,
): TutorApiRequest {
  return {
    message: input.message,
    selected_text: input.selectedText,
    page_context: input.pageContext,
    slide_title: input.slideTitle,
    language: input.language,
    ...(input.learningContext
      ? {
          context_pages: input.learningContext.pages,
          prior_answer: input.learningContext.priorAnswer,
        }
      : {}),
  };
}

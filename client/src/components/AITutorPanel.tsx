import React, {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Plus,
  Send,
  X,
  Copy,
  Check,
  Volume2,
  Square,
  ThumbsUp,
  FileText,
  Sparkles,
  ChevronRight,
  HelpCircle,
  ArrowUp,
  BookMarked,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  getReferencedPage,
  parseSummaryIntent,
} from "../lib/summaryIntent";
import { fetchWithTimeout } from "../lib/apiClient";
import {
  buildSummaryApiRequest,
  getSummaryScopePages,
} from "../lib/summaryRequest";
import {
  buildTutorApiRequest,
  resolveTutorLearningContext,
} from "../lib/tutorRequest";
import { getMessageSourceLabel } from "../lib/messageSourceLabel";
import {
  shouldOfferUnderstandingCheck,
  shouldShowSummaryFollowUps,
} from "../lib/learningExperience";
import {
  ChatMessage,
  ChatSession,
  ContextSnippet,
  Language,
  LearningContext,
  SummaryData,
  SummaryDepth,
  SummaryKeyPointData,
  TutorEvidenceData,
  TutorSuggestedSourceData,
} from "../types";
const InlineQuiz = lazy(() => import("./InlineQuiz").then(
  (module) => ({ default: module.InlineQuiz }),
));

interface AITutorPanelProps {
  currentPage: number;
  totalPages?: number;
  selectedContext: ContextSnippet | null;
  onClearContext: () => void;
  language: Language;
  onClose?: () => void;
  onNavigateToPage?: (page: number, evidenceQuote?: string) => void;
  fileName?: string;
}

interface ActionCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  query: string;
}

async function apiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .map((item: { msg?: string }) => item?.msg)
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
  } catch {
    // Phản hồi không phải JSON; dùng thông báo có status bên dưới.
  }
  return `${fallback} (${response.status})`;
}

function learningContextFromSummary(
  data: SummaryData,
  scopePages: number[] = [],
): LearningContext {
  const pages = scopePages.length > 0
    ? scopePages
    : Array.from(
      new Set(data.key_points.map((point) => point.page)),
    ).slice(0, 5);
  const priorAnswer = [
    data.summary,
    ...data.key_points.map(
      (point) => `- ${point.claim} — Trang ${point.page}`,
    ),
  ].join("\n");
  return {
    pages,
    priorAnswer: priorAnswer.slice(0, 6000),
  };
}

export const AITutorPanel: React.FC<AITutorPanelProps> = ({
  currentPage,
  totalPages = 45,
  selectedContext,
  onClearContext,
  language,
  onClose,
  onNavigateToPage,
  fileName = "Day02.pdf",
}) => {
  // Chat Messages State - starts empty to show Vlearn AI Hero state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  const [summaryDepth, setSummaryDepth] =
    useState<SummaryDepth>("standard");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const handleToggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stop TTS when component unmounts
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
    };
  }, []);

  // Global Escape key listener to close panel & stop TTS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          utteranceRef.current = null;
          setReadingId(null);
        }
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isNearBottom = () => {
    if (!scrollContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 140;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 140;
    setShowJumpToBottom(isFar);
  };

  const scrollToBottom = (force = false) => {
    if (force || isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowJumpToBottom(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setIsSlowResponse(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIsSlowResponse(true),
      8000,
    );
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  // Auto-resize textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Context-Aware Action Cards Specification (Vlearn AI Inspired)
  const actionCards: ActionCard[] = selectedContext
    ? [
      {
        id: "summary_context",
        icon: <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Tóm tắt đoạn văn chọn" : "Summarize selected text",
        description:
          language === "VI"
            ? `Tóm tắt nội dung đoạn văn từ trang ${selectedContext.pageNumber}.`
            : `Summarize key takeaways of selected text from page ${selectedContext.pageNumber}.`,
        query:
          language === "VI"
            ? `Tóm tắt đoạn văn sau từ trang ${selectedContext.pageNumber}: "${selectedContext.text}"`
            : `Summarize the following text from page ${selectedContext.pageNumber}: "${selectedContext.text}"`,
      },
      {
        id: "explain_context",
        icon: <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Giải thích đoạn văn chọn" : "Explain selected text",
        description:
          language === "VI"
            ? "Giải thích đoạn văn này một cách đơn giản, dễ hiểu."
            : "Explain this selection in clear, simple terms.",
        query:
          language === "VI"
            ? `Giải thích chi tiết đoạn văn sau từ trang ${selectedContext.pageNumber}: "${selectedContext.text}"`
            : `Explain in detail the following text from page ${selectedContext.pageNumber}: "${selectedContext.text}"`,
      },
      {
        id: "terms_context",
        icon: <BookMarked className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Thuật ngữ trong đoạn chọn" : "Review key terms",
        description:
          language === "VI"
            ? "Trích xuất và giải thích các thuật ngữ trong đoạn này."
            : "List and explain terms in this selection.",
        query:
          language === "VI"
            ? `Liệt kê các thuật ngữ chính trong đoạn văn sau từ trang ${selectedContext.pageNumber}: "${selectedContext.text}"`
            : `List and explain key terms in this text from page ${selectedContext.pageNumber}: "${selectedContext.text}"`,
      },
    ]
    : [
      {
        id: "summary",
        icon: <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Tóm tắt slide này" : "Summarize this slide",
        description:
          language === "VI"
            ? "Tóm tắt những ý chính của slide hiện tại."
            : "Summarize the key takeaways of this slide.",
        query:
          language === "VI"
            ? "Tóm tắt những ý chính của trang hiện tại."
            : "Summarize the key points of the current page.",
      },
      {
        id: "explain",
        icon: <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Giải thích dễ hiểu" : "Explain simply",
        description:
          language === "VI"
            ? "Giải thích nội dung theo cách đơn giản và dễ hiểu."
            : "Explain concepts in simple and clear terms.",
        query:
          language === "VI"
            ? "Giải thích nội dung trang này theo cách đơn giản và dễ hiểu."
            : "Explain the content of this page simply and clearly.",
      },
      {
        id: "terms",
        icon: <BookMarked className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: language === "VI" ? "Ôn lại thuật ngữ" : "Review key terms",
        description:
          language === "VI"
            ? "Lọc các thuật ngữ quan trọng ngay trong slide."
            : "Review the important terms found on this slide.",
        query:
          language === "VI"
            ? "Liệt kê các thuật ngữ chính và giải thích ngắn gọn theo đúng nội dung trang này."
            : "List the key terms and explain them briefly using only this page.",
      },
    ];

  // Handle New Message Submission
  const handleSendMessage = async (
    textToSend?: string,
    inheritedLearningContext?: LearningContext,
    responseKind: ChatMessage["responseKind"] = "answer",
  ) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    // Filter out previous failed error message bubble if retrying the same question
    setMessages((prev) => prev.filter((m) => !(m.isError && m.failedQuery === messageContent)));

    const userMsgId = Date.now().toString();
    const activeSnippet = selectedContext ? { ...selectedContext } : undefined;
    const summaryIntent = parseSummaryIntent(
      messageContent,
      currentPage,
      totalPages,
    );
    const referencedPage = getReferencedPage(messageContent);
    const previousLearningContext = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && message.learningContext,
      )?.learningContext;
    const effectiveLearningContext = resolveTutorLearningContext({
      explicitContext: inheritedLearningContext,
      previousContext: previousLearningContext,
      hasSelectedText: Boolean(activeSnippet?.text),
      referencedPage,
      isSummaryRequest: summaryIntent.kind === "valid",
    });

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      context: activeSnippet,
      learningContext: effectiveLearningContext,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);
    setTimeout(() => scrollToBottom(true), 50);
    if (summaryIntent.kind === "invalid") {
      const validationMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: summaryIntent.error,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        suppressFollowUps: true,
      };
      setMessages((prev) => [...prev, validationMessage]);
      setIsLoading(false);
      if (selectedContext) {
        onClearContext();
      }
      return;
    }

    const defaultPage =
      referencedPage ||
      activeSnippet?.pageNumber ||
      effectiveLearningContext?.pages[0] ||
      currentPage;
    const summaryScope =
      summaryIntent.kind === "valid"
        ? summaryIntent.scope
        : null;
    const relevantSnippet =
      activeSnippet?.pageNumber === defaultPage ? activeSnippet : undefined;
    let summaryData: SummaryData | undefined;

    try {
      let botReply = "";
      let tutorRefused = false;
      let tutorEvidence: TutorEvidenceData[] = [];
      let tutorStatus: ChatMessage["tutorStatus"];
      let tutorAnswerMode: ChatMessage["tutorAnswerMode"];
      let tutorRefusalReason: ChatMessage["tutorRefusalReason"];
      let tutorSuggestedSources: TutorSuggestedSourceData[] = [];

      if (summaryScope) {
        const response = await fetchWithTimeout("/api/summaries/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSummaryApiRequest(
            summaryScope,
            language,
            summaryDepth,
          )),
        });
        if (!response.ok) {
          throw new Error(
            await apiErrorMessage(response, "Summary API error"),
          );
        }

        const data = await response.json();
        summaryData = data as SummaryData;
        botReply = data.summary;
      } else {
        const response = await fetchWithTimeout("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildTutorApiRequest({
            message: messageContent,
            selectedText: relevantSnippet?.text,
            pageContext: defaultPage,
            slideTitle:
              relevantSnippet?.slideTitle || `${fileName} (Trang ${defaultPage})`,
            language,
            learningContext: effectiveLearningContext,
          })),
        });
        if (!response.ok) {
          throw new Error(
            await apiErrorMessage(response, "Tutor API error"),
          );
        }

        const data = await response.json();
        botReply = [data.reply, data.notice].filter(Boolean).join("\n\n");
        tutorStatus = data.status;
        tutorAnswerMode = data.answer_mode ?? undefined;
        tutorRefused = data.status !== "answered";
        tutorRefusalReason = data.refusal_reason ?? undefined;
        tutorEvidence = Array.isArray(data.evidence)
          ? data.evidence
          : [];
        tutorSuggestedSources = Array.isArray(data.suggested_sources)
          ? data.suggested_sources
          : [];
      }

      if (!botReply) {
        botReply = language === "VI"
          ? "Xin lỗi, đã xảy ra lỗi khi tạo phản hồi."
          : "Sorry, an error occurred while creating a response.";
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        summaryData,
        tutorEvidence,
        tutorStatus,
        tutorAnswerMode,
        tutorRefusalReason,
        tutorSuggestedSources,
        originalRequest: messageContent,
        learningContext: tutorRefused
          ? undefined
          : summaryData
          ? learningContextFromSummary(
            summaryData,
            summaryScope ? getSummaryScopePages(summaryScope) : [],
          )
          : {
              pages: tutorEvidence.length > 0
                ? Array.from(new Set(
                    tutorEvidence.map((evidence) => evidence.page),
                  ))
                : effectiveLearningContext?.pages ?? [defaultPage],
              priorAnswer: botReply.slice(0, 6000),
            },
        responseKind,
        suppressFollowUps: tutorRefused,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Failed to send message to VLearn Tutor:", error);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          language === "VI"
            ? `${summaryScope ? "Không thể kết nối dịch vụ tóm tắt." : "Không thể kết nối AI Tutor."} Vui lòng kiểm tra kết nối backend (cổng 8000) và thử lại.`
            : `${summaryScope ? "Could not connect to summary service." : "Could not connect to AI Tutor."} Please check backend connection (port 8000) and try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
        failedQuery: messageContent,
        suppressFollowUps: true,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
      if (selectedContext) {
        onClearContext();
      }
    }
  };

  // Reset chat to Vlearn Hero State
  const handleNewChat = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setReadingId(null);
    setMessages([]);
    onClearContext();
  };

  // Copy text to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to clean raw text for speech synthesis:
  const cleanTextForSpeech = (rawText: string): string => {
    if (!rawText) return "";
    let text = rawText;

    // 1. Remove code blocks (```...```)
    text = text.replace(/```[\s\S]*?```/g, "");

    // 2. Remove inline code backticks but keep inner content
    text = text.replace(/`([^`]+)`/g, "$1");

    // 3. Remove citations & slide metadata references
    text = text.replace(/\[\d+(?:,\s*\d+)*\]/g, "");
    text = text.replace(/\[(?:Nguồn|Source|Slide|Trang|Page)[^\]]*\]/gi, "");
    text = text.replace(/\((?:Nguồn|Source|Slide|Trang|Page)[^\)]*\)/gi, "");

    // 4. Remove Markdown images and link URLs
    text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");
    text = text.replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1");

    // 5. Remove Markdown headers
    text = text.replace(/^#{1,6}\s+/gm, "");

    // 6. Remove bold/italic formatting delimiters
    text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");
    text = text.replace(/[*_~]+/g, "");

    // 7. Remove LaTeX math delimiters
    text = text.replace(/\\[()\[\]]/g, "");
    text = text.replace(/\$+/g, "");

    // 8. Remove HTML tags
    text = text.replace(/<[^>]*>/g, "");

    // 9. Remove bullet point markers at line beginnings
    text = text.replace(/^[\s*+\-•]+\s*/gm, "");

    // 10. Normalize spacing
    return text.replace(/\s+/g, " ").trim();
  };

  // Voice playback using Web Speech API with Play / Stop toggle
  const handleToggleSpeak = (id: string, text: string) => {
    if (!("speechSynthesis" in window)) return;

    if (readingId === id) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setReadingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === "VI" ? "vi-VN" : "en-US";
    utterance.rate = 1.0;

    utterance.onend = () => {
      setReadingId(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setReadingId(null);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    setReadingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Suggested follow-up actions below AI response
  const suggestedFollowUps =
    language === "VI"
      ? [
        {
          id: "more",
          label: "💡 Giải thích thêm",
          query: "Giải thích chi tiết hơn về phần này.",
          kind: "answer" as const,
        },
        {
          id: "example",
          label: "🧩 Cho ví dụ",
          query: (
            "Tạo một ví dụ đời thường thật ngắn để minh họa nội dung vừa "
            + "trả lời. Ghi rõ đây là ví dụ do AI tạo."
          ),
          kind: "example" as const,
        },
        {
          id: "quiz",
          label: "❓ Tạo quiz ôn tập",
          query: "Tạo câu hỏi ôn tập dựa trên nội dung vừa trả lời.",
          kind: "quiz" as const,
        },
        {
          id: "terms",
          label: "📚 Ôn thuật ngữ",
          query: "Liệt kê các thuật ngữ chính và giải thích theo đúng nội dung slide.",
          kind: "answer" as const,
        },
        {
          id: "summary",
          label: "📄 Tóm tắt ý chính",
          query: "Tóm tắt lại các ý chính bằng gạch đầu dòng.",
          kind: "answer" as const,
        },
      ]
      : [
        {
          id: "more",
          label: "💡 Explain more",
          query: "Explain more details about this part.",
          kind: "answer" as const,
        },
        {
          id: "example",
          label: "🧩 Show an example",
          query: (
            "Create one short everyday example for the previous answer. "
            + "Clearly label it as AI-generated."
          ),
          kind: "example" as const,
        },
        {
          id: "quiz",
          label: "❓ Review quiz",
          query: "Generate a review quiz based on this response.",
          kind: "quiz" as const,
        },
        {
          id: "terms",
          label: "📚 Review terms",
          query: "List and explain the key terms using only the current slide.",
          kind: "answer" as const,
        },
        {
          id: "summary",
          label: "📄 Key takeaways",
          query: "Summarize key points in bullet format.",
          kind: "answer" as const,
        },
      ];
  return (
    <aside
      role="region"
      aria-label={language === "VI" ? "Khung trò chuyện VLearn Tutor" : "VLearn Tutor Chatbot Panel"}
      className="w-full h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-lg relative font-sans transition-colors overflow-hidden"
    >
      {/* 1. Header (64-72px Height, No text clipping, items-start layout with vertically centered action buttons) */}
      <div className="px-4 py-3 min-h-[68px] border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs sticky top-0 z-20 shrink-0">
        {/* Left: VLearn Tutor Logo & Two-Line Title Stack */}
        <div className="flex items-start gap-3 min-w-0 pt-0.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-950/60 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs shrink-0 mt-0.5">
            <Bot className="w-4.5 h-4.5" />
          </div>

          <div className="flex flex-col min-w-0">
            {/* Line 1: Title */}
            <h2 className="font-bold text-sm md:text-base text-slate-900 dark:text-white leading-normal truncate">
              VLearn Tutor
            </h2>
            {/* Line 2: Live Page Context */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 leading-normal truncate">
                {language === "VI"
                  ? `Trang ${currentPage}/${totalPages}`
                  : `Page ${currentPage}/${totalPages}`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Vertically Centered Action Controls */}
        <div className="flex items-center gap-1 shrink-0 self-center">
          <button
            onClick={handleNewChat}
            aria-label={language === "VI" ? "Cuộc trò chuyện mới" : "New Chat"}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={language === "VI" ? "Cuộc trò chuyện mới" : "New Chat"}
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          {onClose && (
            <button
              onClick={() => {
                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  utteranceRef.current = null;
                  setReadingId(null);
                }
                onClose();
              }}
              aria-label={language === "VI" ? "Đóng VLearn Tutor (Phím Esc)" : "Close VLearn Tutor (Esc key)"}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === "VI" ? "Đóng (Esc)" : "Close (Esc)"}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 overflow-y-auto px-4 py-3.5 md:px-5 space-y-3.5 bg-white dark:bg-slate-900 relative"
      >
        {/* State A: VLearn AI Empty Hero State */}
        {messages.length === 0 ? (
          <div className="flex flex-col space-y-3 max-w-lg mx-auto py-0.5">
            {/* Hero Section - Compact */}
            <div className="flex flex-col space-y-0.5">
              <h1 className="text-base md:text-lg font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                {language === "VI" ? "Xin chào! 👋" : "Hello there! 👋"}
              </h1>
              <h2 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                {language === "VI"
                  ? "Mình có thể giúp gì cho bạn hôm nay?"
                  : "How can I help you learn today?"}
              </h2>
            </div>

            {/* Selected Context Highlight Pill */}
            {selectedContext && (
              <div className="bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-2.5 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300">
                    <BookMarked className="w-3.5 h-3.5" />
                    {language === "VI"
                      ? `Đoạn văn đã chọn từ Trang ${selectedContext.pageNumber}`
                      : `Selected text from Page ${selectedContext.pageNumber}`}
                  </span>
                  <button
                    onClick={onClearContext}
                    aria-label={language === "VI" ? "Bỏ chọn ngữ cảnh" : "Clear selected context"}
                    title={language === "VI" ? "Bỏ chọn ngữ cảnh" : "Clear selected context"}
                    className="w-8 h-8 flex items-center justify-center text-blue-500 hover:text-blue-800 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="line-clamp-2 italic text-[11px] text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 p-2 rounded border border-blue-100 dark:border-blue-900/50">
                  "{selectedContext.text}"
                </p>
              </div>
            )}

            {/* Action Cards Grid */}
            <div className="flex flex-col space-y-2 pt-0.5">
              {actionCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleSendMessage(card.query)}
                  aria-label={`${card.title}: ${card.description}`}
                  className="w-full h-[52px] min-h-[52px] bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3 flex items-center justify-between gap-2.5 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 shrink-0"
                >
                  {/* Left Icon & Title */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100/60 dark:border-blue-900/50 flex items-center justify-center shrink-0 group-hover:scale-105 group-focus-visible:scale-105 transition-transform">
                      {card.icon}
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus-visible:text-blue-600 dark:group-focus-visible:text-blue-400 transition-colors truncate">
                        {card.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {card.description}
                      </span>
                    </div>
                  </div>

                  {/* Right Chevron Arrow */}
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 transition-all shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* State B: Conversation Experience */
          <div
            className="flex flex-col space-y-4 w-full"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {/* Selected Context Chip */}
            {selectedContext && (
              <div className="bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300">
                    <BookMarked className="w-3.5 h-3.5" />
                    {language === "VI"
                      ? `Đoạn văn đã chọn từ Trang ${selectedContext.pageNumber}`
                      : `Selected text from Page ${selectedContext.pageNumber}`}
                  </span>
                  <button
                    onClick={onClearContext}
                    aria-label={language === "VI" ? "Bỏ chọn ngữ cảnh" : "Clear selected context"}
                    title={language === "VI" ? "Bỏ chọn ngữ cảnh" : "Clear selected context"}
                    className="w-8 h-8 flex items-center justify-center text-blue-500 hover:text-blue-800 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="line-clamp-2 italic text-[11px] text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 p-2 rounded border border-blue-100 dark:border-blue-900/50">
                  "{selectedContext.text}"
                </p>
              </div>
            )}

            {/* Conversation Items List */}
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex flex-col items-end w-full animate-in fade-in slide-in-from-bottom-1 duration-200 my-1">
                    {msg.context && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 max-w-[85%] mb-1">
                        <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate">
                          Trang {msg.context.pageNumber}: "{msg.context.text}"
                        </span>
                      </div>
                    )}

                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs md:text-sm leading-relaxed max-w-[85%] shadow-2xs">
                      <p>{msg.content}</p>
                    </div>
                  </div>
                );
              }

              {/* Render Dedicated Error State Card */ }
              if (msg.isError) {
                return (
                  <div
                    key={msg.id}
                    className="w-full bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70 rounded-2xl p-4 md:p-4.5 space-y-3 animate-in fade-in duration-200 shadow-2xs text-xs md:text-sm"
                    role="alert"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <span className="font-semibold text-amber-900 dark:text-amber-200 block">
                          {language === "VI" ? "Không thể hoàn thành yêu cầu" : "Unable to complete request"}
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>

                    {msg.failedQuery && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleSendMessage(msg.failedQuery)}
                          aria-label={language === "VI" ? "Thử lại câu hỏi" : "Retry question"}
                          className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium text-xs rounded-lg transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{language === "VI" ? "Thử lại" : "Retry"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // AI Single Response Card
              return (
                <div
                  key={msg.id}
                  className="w-full bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 md:p-4 shadow-2xs space-y-3 animate-in fade-in duration-200"
                >
                  <div className="w-full">
                    {msg.summaryData ? (
                      <EvidenceSummary
                        data={msg.summaryData}
                        language={language}
                        onNavigateToPage={onNavigateToPage}
                        onRequestExample={(point) => {
                          handleSendMessage(
                            language === "VI"
                              ? (
                                "Tạo một ví dụ đời thường thật ngắn để minh "
                                + "họa đúng ý này. Ghi rõ đây là ví dụ do AI tạo."
                              )
                              : (
                                "Create one short everyday example for this "
                                + "point and label it as AI-generated."
                              ),
                            {
                              pages: [point.page],
                              priorAnswer: [
                                point.claim,
                                `Nguồn: ${point.evidence_quote}`,
                              ].join("\n"),
                            },
                            "answer",
                          );
                        }}
                        onRequestExplain={(point) => {
                          handleSendMessage(
                            language === "VI"
                              ? (
                                "Người học vừa trả lời chưa đúng hoặc chưa đủ. "
                                + "Hãy giải thích sâu hơn theo từng bước, chỉ ra "
                                + "điểm dễ nhầm và giữ nguyên số liệu quan trọng."
                              )
                              : (
                                "The learner's answer was incomplete or incorrect. "
                                + "Explain the point step by step, identify the likely "
                                + "confusion, and preserve important numbers."
                              ),
                            {
                              pages: [point.page],
                              priorAnswer: [
                                point.claim,
                                `Nguồn: ${point.evidence_quote}`,
                              ].join("\n"),
                            },
                            "answer",
                          );
                        }}
                      />
                    ) : (
                      <>
                        {msg.tutorAnswerMode === "background" && (
                          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Info className="h-3 w-3" />
                            {language === "VI"
                              ? "Kiến thức nền · đã đối chiếu bối cảnh slide"
                              : "Background knowledge · slide context verified"}
                          </div>
                        )}
                        {msg.responseKind === "example" && (
                          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                            <Sparkles className="h-3 w-3" />
                            {language === "VI"
                              ? "Ví dụ minh họa do AI tạo · không phải nguyên văn slide"
                              : "AI-generated example · not verbatim slide content"}
                          </div>
                        )}
                        {renderDocumentMarkdown(msg.content)}
                        {msg.tutorEvidence &&
                          msg.tutorEvidence.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              {language === "VI"
                                ? "Bằng chứng đã xác minh"
                                : "Verified evidence"}
                            </p>
                            {msg.tutorEvidence.map((evidence, index) => (
                              <button
                                key={`${evidence.source_id}-${index}`}
                                type="button"
                                onClick={() => onNavigateToPage?.(
                                  evidence.page,
                                  evidence.evidence_quote,
                                )}
                                className="block w-full rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-left transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                              >
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  {language === "VI"
                                    ? `Mở nguồn trang ${evidence.page}`
                                    : `Open source page ${evidence.page}`}
                                </span>
                                <span className="mt-1 line-clamp-3 block text-[11px] italic leading-relaxed text-slate-600 dark:text-slate-300">
                                  “{evidence.evidence_quote}”
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.tutorSuggestedSources &&
                          msg.tutorSuggestedSources.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.tutorSuggestedSources.map((source) => (
                              <div
                                key={`${msg.id}-${source.page}`}
                                className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-950/30"
                              >
                                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                                  {language === "VI"
                                    ? `Tìm thấy ở trang ${source.page}: ${source.title}`
                                    : `Found on page ${source.page}: ${source.title}`}
                                </p>
                                <p className="mt-1 line-clamp-3 text-[11px] italic leading-relaxed text-slate-600 dark:text-slate-300">
                                  “{source.evidence_quote}”
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToPage?.(
                                      source.page,
                                      source.evidence_quote,
                                    )}
                                    className="rounded-full border border-blue-300 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:border-blue-700 dark:text-blue-300"
                                  >
                                    {language === "VI"
                                      ? "Mở nguồn"
                                      : "Open source"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onNavigateToPage?.(
                                        source.page,
                                        source.evidence_quote,
                                      );
                                      handleSendMessage(
                                        msg.originalRequest,
                                        {
                                          pages: [source.page],
                                          priorAnswer: "",
                                        },
                                      );
                                    }}
                                    className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                                  >
                                    {language === "VI"
                                      ? "Mở & giải thích"
                                      : "Open & explain"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.tutorStatus === "refused" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSendMessage(
                                language === "VI"
                                  ? "Tóm tắt slide hiện tại"
                                  : "Summarize the current slide",
                              )}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              {language === "VI"
                                ? "Tóm tắt trang hiện tại"
                                : "Summarize current page"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendMessage(
                                language === "VI"
                                  ? "Giải thích nội dung slide hiện tại"
                                  : "Explain the current slide",
                              )}
                              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                            >
                              {language === "VI"
                                ? "Giải thích trang hiện tại"
                                : "Explain current page"}
                            </button>
                            {msg.tutorRefusalReason === "service_unavailable" &&
                              msg.originalRequest && (
                              <button
                                type="button"
                                onClick={() => handleSendMessage(
                                  msg.originalRequest,
                                )}
                                className="rounded-full border border-slate-300 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              >
                                {language === "VI" ? "Thử lại" : "Retry"}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 2. Source Section */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-lg shadow-2xs font-medium text-slate-700 dark:text-slate-300">
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {language === "VI" ? "Nguồn:" : "Source:"} Trang {msg.learningContext?.pages?.[0] ?? msg.context?.pageNumber ?? currentPage} ({fileName})
                      </span>
                    </div>
                  </div>

                  {/* 3. Actions Section */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      aria-label={
                        copiedId === msg.id
                          ? language === "VI" ? "Đã sao chép" : "Copied"
                          : language === "VI" ? "Sao chép" : "Copy"
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      title={language === "VI" ? "Sao chép" : "Copy"}
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="font-medium text-[11px]">
                        {copiedId === msg.id ? (language === "VI" ? "Đã chép" : "Copied") : (language === "VI" ? "Sao chép" : "Copy")}
                      </span>
                    </button>

                    <button
                      onClick={() => handleToggleSpeak(msg.id, msg.content)}
                      aria-pressed={readingId === msg.id}
                      aria-label={
                        readingId === msg.id
                          ? language === "VI" ? "Dừng đọc" : "Stop reading"
                          : language === "VI" ? "Đọc thành tiếng" : "Read aloud"
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${readingId === msg.id
                        ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 font-semibold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        }`}
                      title={
                        readingId === msg.id
                          ? language === "VI"
                            ? "Dừng đọc"
                            : "Stop reading"
                          : language === "VI"
                            ? "Đọc thành tiếng"
                            : "Read aloud"
                      }
                    >
                      {readingId === msg.id ? (
                        <Square className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 fill-current animate-pulse" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      <span className="font-medium text-[11px]">
                        {readingId === msg.id
                          ? language === "VI"
                            ? "Dừng"
                            : "Stop"
                          : language === "VI"
                            ? "Đọc"
                            : "Listen"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleToggleLike(msg.id)}
                      aria-pressed={likedIds.has(msg.id)}
                      aria-label={
                        likedIds.has(msg.id)
                          ? language === "VI" ? "Đã đánh giá hữu ích" : "Marked as helpful"
                          : language === "VI" ? "Đánh giá hữu ích" : "Mark as helpful"
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${likedIds.has(msg.id)
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 font-semibold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        }`}
                      title={
                        likedIds.has(msg.id)
                          ? language === "VI" ? "Bỏ đánh giá hữu ích" : "Unmark helpful"
                          : language === "VI" ? "Hữu ích" : "Helpful"
                      }
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${likedIds.has(msg.id) ? "fill-current" : ""}`} />
                      <span className="font-medium text-[11px]">
                        {likedIds.has(msg.id)
                          ? language === "VI" ? "Đã thích" : "Liked"
                          : language === "VI" ? "Hữu ích" : "Helpful"}
                      </span>
                    </button>
                  </div>

                  {/* 4. Suggested Prompts Section */}
                  {!msg.suppressFollowUps &&
                    (!msg.summaryData ||
                      shouldShowSummaryFollowUps(msg.summaryData.depth)) &&
                    (!msg.summaryData ||
                      msg.summaryData.status === "verified" ||
                      msg.summaryData.status === "partial") && (
                      <div className="flex flex-col space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {language === "VI" ? "Gợi ý tiếp theo:" : "Suggested follow-ups:"}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {suggestedFollowUps.map((action) => (
                            <button
                              key={action.id}
                              onClick={() => handleSendMessage(
                                action.query,
                                msg.learningContext,
                                action.kind,
                              )}
                              aria-label={`${language === "VI" ? "Hỏi gợi ý" : "Ask suggestion"}: ${action.label}`}
                              className="px-3 py-1.5 rounded-full border border-blue-200/80 dark:border-slate-700 bg-blue-50/60 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 text-[11px] font-medium transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <span>{action.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })}

            {/* Enhanced Loading Indicator */}
            {isLoading && (
              <div
                role="status"
                aria-busy="true"
                aria-label={
                  language === "VI"
                    ? "VLearn Tutor đang soạn câu trả lời"
                    : "VLearn Tutor is generating a response"
                }
                className="w-full flex flex-col pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2 animate-pulse"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {isSlowResponse
                      ? (
                        language === "VI"
                          ? "AI đang đối chiếu nguồn; phản hồi thật có thể cần thêm ít giây..."
                          : "AI is checking sources; the live response may need a few more seconds..."
                      )
                      : (
                        language === "VI"
                          ? "VLearn Tutor đang suy nghĩ..."
                          : "VLearn Tutor is thinking..."
                      )}
                  </span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-3.5 bg-slate-200/80 dark:bg-slate-700/60 rounded-full w-5/6" />
                  <div className="h-3.5 bg-slate-200/80 dark:bg-slate-700/60 rounded-full w-2/3" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Floating "Jump to latest" Button */}
        {showJumpToBottom && (
          <div className="sticky bottom-2 z-30 flex justify-center w-full pointer-events-none">
            <button
              onClick={() => scrollToBottom(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-full shadow-lg border border-blue-400/30 animate-in fade-in zoom-in-90 duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={language === "VI" ? "Cuộn xuống mới nhất" : "Jump to latest"}
            >
              <ArrowUp className="w-3.5 h-3.5 rotate-180" />
              <span>{language === "VI" ? "Mới nhất" : "Jump to latest"}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Sticky Bottom Input Section */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 sticky bottom-0 z-10 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {language === "VI" ? "Độ sâu tóm tắt" : "Summary depth"}
          </span>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            {([
              ["standard", language === "VI" ? "Chuẩn" : "Standard"],
              ["study", language === "VI" ? "Học sâu" : "Study"],
            ] as Array<[SummaryDepth, string]>).map(([depth, label]) => (
              <button
                key={depth}
                type="button"
                onClick={() => setSummaryDepth(depth)}
                aria-pressed={summaryDepth === depth}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${summaryDepth === depth
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center bg-slate-50/80 dark:bg-slate-800/60 border border-blue-200/80 dark:border-slate-700 focus-within:border-blue-500 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 rounded-2xl p-1.5 pl-3.5 pr-1.5 transition-all shadow-xs"
        >
          {/* Auto-expanding Input Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              } else if (e.key === "Escape" && input.trim()) {
                e.preventDefault();
                e.stopPropagation();
                setInput("");
              }
            }}
            placeholder={
              language === "VI"
                ? "Hỏi về bài học hoặc nhập câu hỏi..."
                : "Ask about the lesson or type a question..."
            }
            aria-label={
              language === "VI"
                ? "Hỏi về bài học hoặc nhập câu hỏi"
                : "Ask about the lesson or type a question"
            }
            className="w-full py-1.5 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none resize-none max-h-32 min-h-[32px] leading-relaxed flex items-center"
          />

          {/* Quick Clear Input Button */}
          {Boolean(input.trim()) && (
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label={
                language === "VI" ? "Xóa câu hỏi đã nhập" : "Clear prompt input"
              }
              title={language === "VI" ? "Xóa nhập liệu" : "Clear input"}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all duration-200 active:scale-95 shadow-md shrink-0 flex items-center justify-center ml-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={language === "VI" ? "Gửi câu hỏi" : "Send Question"}
            aria-label={language === "VI" ? "Gửi câu hỏi" : "Send Question"}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Disclaimer Footer Text */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-normal px-2">
          {language === "VI"
            ? "VLearn Tutor có thể mắc sai sót. Đối chiếu với tài liệu học khi cần."
            : "VLearn Tutor may make mistakes. Please verify important information."}
        </p>
      </div>
    </aside>
  );
};

interface EvidenceSummaryProps {
  data: SummaryData;
  language: Language;
  onNavigateToPage?: (page: number, evidenceQuote?: string) => void;
  onRequestExample?: (point: SummaryKeyPointData) => void;
  onRequestExplain?: (point: SummaryKeyPointData) => void;
}

const EvidenceSummary: React.FC<EvidenceSummaryProps> = ({
  data,
  language,
  onNavigateToPage,
  onRequestExample,
  onRequestExplain,
}) => {
  const [quizPoint, setQuizPoint] = useState<number | null>(null);
  const coverage = data.coverage;
  const status =
    data.status ?? "verified";

  useEffect(() => {
    setQuizPoint(null);
  }, [data.scope_description, data.summary]);

  const statusClasses =
    status === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : status === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
        : status === "not_applicable"
          ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";

  return (
    <section className="space-y-2.5">
      <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
        {data.summary}
      </p>

      {data.notice && status !== "verified" && (
        <p className={`rounded-lg border px-3 py-2 text-[10px] ${statusClasses}`}>
          {data.notice}
        </p>
      )}

      {data.key_points.length > 0 && <div className="space-y-2.5">
        {data.key_points.map((point, index) => {
          return (
            <article
              key={`${point.page}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-800 dark:text-slate-100 md:text-sm">
                  {point.claim}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToPage?.(
                      point.page,
                      point.evidence_quote,
                    );
                  }}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900"
                >
                  {language === "VI"
                    ? `Mở & kiểm tra trang ${point.page}`
                    : `Open & verify page ${point.page}`}
                </button>
                {shouldOfferUnderstandingCheck(
                  data.depth,
                  point.verified,
                ) && (
                    <button
                      type="button"
                      onClick={() => setQuizPoint(
                        quizPoint === index ? null : index,
                      )}
                      className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                    >
                      <HelpCircle className="h-3 w-3" />
                      {language === "VI"
                        ? "Kiểm tra độ hiểu"
                        : "Check understanding"}
                    </button>
                  )}
              </div>

              {shouldOfferUnderstandingCheck(data.depth, point.verified) &&
                quizPoint === index && (
                  <Suspense
                    fallback={
                      <div className="mt-3 ml-7 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
                        {language === "VI"
                          ? "Đang mở câu kiểm tra..."
                          : "Opening checkpoint..."}
                      </div>
                    }
                  >
                    <InlineQuiz
                      point={point}
                      language={language}
                      onNavigateToPage={onNavigateToPage}
                      onRequestDeepExplain={() => onRequestExplain?.(point)}
                      onRequestExample={() => onRequestExample?.(point)}
                    />
                  </Suspense>
                )}
            </article>
          );
        })}
      </div>}

      {coverage.rejected_points > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {language === "VI"
            ? `${coverage.rejected_points} ý đã bị ẩn vì không khớp nguồn.`
            : `${coverage.rejected_points} unsupported points were hidden.`}
        </p>
      )}
    </section>
  );
};

// Helper function to render bold (**text**) and inline code (`code`)
function formatInlineFormatting(text: string): React.ReactNode {
  const codeParts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {codeParts.map((codePart, i) => {
        if (codePart.startsWith("`") && codePart.endsWith("`") && codePart.length > 2) {
          return (
            <code
              key={i}
              className="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono text-[11px] md:text-xs border border-slate-200 dark:border-slate-700/80 mx-0.5"
            >
              {codePart.slice(1, -1)}
            </code>
          );
        }
        const boldParts = codePart.split(/(\*\*.*?\*\*)/g);
        return (
          <React.Fragment key={i}>
            {boldParts.map((boldPart, j) => {
              if (boldPart.startsWith("**") && boldPart.endsWith("**")) {
                return (
                  <strong key={j} className="font-semibold text-slate-900 dark:text-white">
                    {boldPart.slice(2, -2)}
                  </strong>
                );
              }
              return boldPart;
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

// Helper function to clean greeting fillers from AI text
function cleanAIResponseText(text: string): string {
  return text
    .replace(/^(Xin chào[!,.]?|Chào bạn[!,.]?|Rất vui được đồng hành[^\n]*|Mình là VLearn Tutor[^\n]*)\s*/gi, "")
    .trim();
}

// Helper function to render rich Document Markdown notes for AI response
function renderDocumentMarkdown(rawContent: string): React.ReactNode {
  const content = cleanAIResponseText(rawContent);
  const lines = content.split("\n");

  const sectionKeywords = [
    "Mục tiêu cốt lõi",
    "Khái niệm quan trọng",
    "Ứng dụng thực tế",
    "Nội dung trọng tâm",
    "Tóm tắt bài học",
    "Các điểm chính",
    "Kết luận",
  ];

  const elements: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`space-${idx}`} className="h-1" />);
      idx++;
      continue;
    }

    // Check for GFM Markdown Table (e.g. | col | col |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (idx < lines.length && lines[idx].trim().startsWith("|") && lines[idx].trim().endsWith("|")) {
        tableLines.push(lines[idx].trim());
        idx++;
      }
      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        const isDivider = tableLines[1].includes("---");
        const rowStartIndex = isDivider ? 2 : 1;
        const bodyRows = tableLines.slice(rowStartIndex).map((r) =>
          r
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${idx}`} className="overflow-x-auto my-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold">
                  {headerCells.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5">
                      {formatInlineFormatting(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-slate-700 dark:text-slate-300">
                        {formatInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Callout card for "Lưu ý", "Mẹo học", "Note", "Chú ý"
    const calloutMatch = line.match(/^(\*\*|\>|\-|\*)*\s*(Lưu ý|Mẹo học|Chú ý|Note):\s*(.*)/i);
    if (calloutMatch) {
      const calloutTitle = calloutMatch[2];
      const calloutBody = calloutMatch[3].replace(/\*\*/g, "");
      elements.push(
        <div
          key={idx}
          className="my-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 dark:text-slate-200 flex items-start gap-2.5 shadow-2xs"
        >
          <span className="text-base shrink-0">💡</span>
          <div className="flex-1">
            <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-0.5">
              💡 {calloutTitle}
            </span>
            <span>{formatInlineFormatting(calloutBody)}</span>
          </div>
        </div>
      );
      idx++;
      continue;
    }

    // Section Headings conversion
    const sectionMatch = sectionKeywords.find((sec) =>
      line.toLowerCase().includes(sec.toLowerCase())
    );
    if (
      sectionMatch &&
      (line.startsWith("#") ||
        line.startsWith("- **") ||
        line.startsWith("* **") ||
        line.startsWith("**") ||
        line.endsWith(":"))
    ) {
      const titleText = line.replace(/^[#\-\*\s]+/, "").replace(/[:\*\*]+/g, "").trim();
      elements.push(
        <h2
          key={idx}
          className="text-sm md:text-base font-bold text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200/70 dark:border-slate-800 mt-3 mb-1"
        >
          {titleText}
        </h2>
      );
      idx++;
      continue;
    }

    // Headings (H1, H2, H3)
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={idx} className="text-base md:text-lg font-bold text-slate-900 dark:text-white pt-3 pb-1 leading-snug">
          {formatInlineFormatting(line.substring(2))}
        </h1>
      );
      idx++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={idx} className="text-sm md:text-base font-bold text-slate-900 dark:text-white pt-2.5 pb-1 leading-snug">
          {formatInlineFormatting(line.substring(3))}
        </h2>
      );
      idx++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="text-xs md:text-sm font-bold text-slate-900 dark:text-white pt-2 pb-0.5 leading-snug">
          {formatInlineFormatting(line.substring(4))}
        </h3>
      );
      idx++;
      continue;
    }

    // Bullet lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 pl-1 my-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
          <span className="flex-1">{formatInlineFormatting(line.substring(2))}</span>
        </div>
      );
      idx++;
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s(.*)/);
      if (match) {
        elements.push(
          <div key={idx} className="flex items-start gap-2 pl-1 my-1">
            <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">{match[1]}</span>
            <span className="flex-1">{formatInlineFormatting(match[2])}</span>
          </div>
        );
        idx++;
        continue;
      }
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={idx}
          className="border-l-3 border-blue-500 pl-3 py-1.5 italic bg-blue-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 my-2 rounded-r text-xs md:text-sm"
        >
          {formatInlineFormatting(line.substring(2))}
        </blockquote>
      );
      idx++;
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      elements.push(
        <pre key={idx} className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-xs overflow-x-auto my-2 border border-slate-800">
          <code>{line.replace(/```/g, "")}</code>
        </pre>
      );
      idx++;
      continue;
    }

    elements.push(<p key={idx} className="leading-relaxed my-1">{formatInlineFormatting(line)}</p>);
    idx++;
  }

  return (
    <div className="space-y-3.5 text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-relaxed font-sans pt-1">
      {elements}
    </div>
  );
}


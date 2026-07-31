import React, {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bot,
  History,
  Plus,
  Send,
  X,
  Copy,
  Check,
  Volume2,
  ThumbsUp,
  FileText,
  Sparkles,
  ChevronRight,
  HelpCircle,
  ArrowUp,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Quote,
  AlertTriangle,
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
  // Chat History & Messages State - starts empty to show Vlearn AI Hero state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  const [summaryDepth, setSummaryDepth] =
    useState<SummaryDepth>("standard");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions] = useState<ChatSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
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

  // Action Cards Specification (Vlearn AI Inspired)
  const actionCards: ActionCard[] = [
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
          ? "Tóm tắt những ý chính của slide hiện tại."
          : "Summarize the key points of the current slide.",
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
          ? "Giải thích nội dung slide này theo cách đơn giản và dễ hiểu."
          : "Explain the content of this slide simply and clearly.",
    },
    {
      id: "quiz",
      icon: <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      title: language === "VI" ? "Tạo câu hỏi ôn tập" : "Create review quiz",
      description:
        language === "VI"
          ? "Sinh câu hỏi để kiểm tra mức độ hiểu bài."
          : "Generate questions to test understanding.",
      query:
        language === "VI"
          ? "Tạo các câu hỏi ôn tập để kiểm tra mức độ hiểu bài."
          : "Generate review questions to check understanding.",
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
          ? "Liệt kê các thuật ngữ chính và giải thích ngắn gọn theo đúng nội dung slide."
          : "List the key terms and explain them briefly using only this slide.",
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
              relevantSnippet?.slideTitle || `${fileName} (Slide ${defaultPage})`,
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
        learningContext: summaryData
          ? learningContextFromSummary(
              summaryData,
              summaryScope ? getSummaryScopePages(summaryScope) : [],
            )
          : {
              pages: effectiveLearningContext?.pages ?? [defaultPage],
              priorAnswer: botReply.slice(0, 6000),
            },
        responseKind,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Failed to send message to VLearn Tutor:", error);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          language === "VI"
            ? `${
                summaryScope ? "Không thể gọi dịch vụ tóm tắt" : "Không thể gọi AI Tutor"
              }. ${error instanceof Error ? error.message : "Lỗi không xác định"}. Hãy kiểm tra backend cổng 8000.`
            : `${
                summaryScope ? "Could not call the summary service" : "Could not call AI Tutor"
              }. ${error instanceof Error ? error.message : "Unknown error"}. Please check the backend on port 8000.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
    setMessages([]);
    onClearContext();
  };

  // Copy text to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Voice playback using Web Speech API
  const handleSpeak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#>`]/g, ""));
      utterance.lang = language === "VI" ? "vi-VN" : "en-US";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
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
    <aside className="w-full h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-lg relative font-sans transition-colors overflow-hidden">
      {/* 1. Header (Preserved exactly per requirement) */}
      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-20 shrink-0">
        {/* Left: VLearn Tutor Logo & Title & Green Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-950/60 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              VLearn Tutor
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 leading-none">
                {language === "VI" ? "Trợ lý học theo ngữ cảnh" : "Contextual Learning Assistant"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Slide Indicator & Action Icons */}
        <div className="flex items-center gap-2">
          {/* Slide Indicator Badge */}
          <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60 rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Slide {currentPage} / {totalPages}</span>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => setHistoryOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={language === "VI" ? "Lịch sử trò chuyện" : "Chat History"}
            >
              <History className="w-4 h-4" />
            </button>

            <button
              onClick={handleNewChat}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={language === "VI" ? "Cuộc trò chuyện mới" : "New Chat"}
            >
              <Plus className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={language === "VI" ? "Đóng" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 space-y-4 bg-white dark:bg-slate-900">
        {/* State A: VLearn AI Empty Hero State */}
        {messages.length === 0 ? (
          <div className="flex flex-col space-y-4 max-w-lg mx-auto py-1">
            {/* Hero Section */}
            <div className="flex flex-col space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                Xin chào!
              </h1>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                Mình có thể giúp gì cho bạn hôm nay?
              </h2>
            </div>

            {/* Selected Context Highlight Pill (If user selected text on slide) */}
            {selectedContext && (
              <div className="bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300">
                    <BookMarked className="w-3.5 h-3.5" />
                    {language === "VI"
                      ? `Đoạn văn đã chọn từ Slide ${selectedContext.pageNumber}`
                      : `Selected text from Slide ${selectedContext.pageNumber}`}
                  </span>
                  <button
                    onClick={onClearContext}
                    className="text-blue-500 hover:text-blue-800 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="line-clamp-2 italic text-[11px] text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 p-2 rounded border border-blue-100 dark:border-blue-900/50">
                  "{selectedContext.text}"
                </p>
              </div>
            )}

            {/* Action Cards Grid - Compact Style */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {actionCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleSendMessage(card.query)}
                  className="w-full bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-[14px] px-3.5 py-3 flex items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-xs hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer group text-left"
                >
                  {/* Left Icon & Title */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100/60 dark:border-blue-900/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {card.icon}
                    </div>
                    <span className="font-semibold text-xs md:text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {card.title}
                    </span>
                  </div>

                  {/* Right Chevron Arrow */}
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* State B: Coursera AI Document Reading Experience */
          <div className="flex flex-col space-y-5 w-full">
            {/* Selected Context Chip */}
            {selectedContext && (
              <div className="bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300">
                    <BookMarked className="w-3.5 h-3.5" />
                    {language === "VI"
                      ? `Đoạn văn đã chọn từ Slide ${selectedContext.pageNumber}`
                      : `Selected text from Slide ${selectedContext.pageNumber}`}
                  </span>
                  <button
                    onClick={onClearContext}
                    className="text-blue-500 hover:text-blue-800 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    <X className="w-3.5 h-3.5" />
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
                  <div key={msg.id} className="flex flex-col items-end w-full my-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {msg.context && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 max-w-[85%] mb-1">
                        <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate">
                          Slide {msg.context.pageNumber}: "{msg.context.text}"
                        </span>
                      </div>
                    )}

                    <div className="bg-blue-600 text-white rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed max-w-[85%] shadow-xs">
                      <p>{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // AI Document Note Style (Coursera AI / NotebookLM Experience)
              return (
                <div
                  key={msg.id}
                  className="w-full flex flex-col pt-4 border-t border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-200 space-y-3"
                >
                  {/* Contextual Document Title instead of VLearn Tutor & timestamp */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <BookMarked className="w-4 h-4" />
                      <span>
                        {getMessageSourceLabel({
                          scopeDescription:
                            msg.summaryData?.scope_description,
                          learningPages: msg.learningContext?.pages,
                          contextPage: msg.context?.pageNumber,
                          fallbackPage: currentPage,
                          language,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Clean Document Markdown Rendering */}
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
                            "example",
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
                        {msg.responseKind === "example" && (
                          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                            <Sparkles className="h-3 w-3" />
                            {language === "VI"
                              ? "Ví dụ minh họa do AI tạo · không phải nguyên văn slide"
                              : "AI-generated example · not verbatim slide content"}
                          </div>
                        )}
                        {renderDocumentMarkdown(msg.content)}
                      </>
                    )}
                  </div>

                  {/* Document Footer Action Bar */}
                  <div className="flex items-center justify-between text-[11px] pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/60 text-slate-400">
                    <span className="text-[10px] text-slate-400 italic">
                      {language === "VI" ? "Tài liệu học tập AI" : "AI Learning Document"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 hover:text-slate-700 dark:hover:text-white rounded transition-colors flex items-center gap-1 text-[11px]"
                        title={language === "VI" ? "Sao chép" : "Copy"}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === msg.id ? (language === "VI" ? "Đã chép" : "Copied") : (language === "VI" ? "Sao chép" : "Copy")}</span>
                      </button>

                      <button
                        onClick={() => handleSpeak(msg.content)}
                        className="p-1 hover:text-slate-700 dark:hover:text-white rounded transition-colors flex items-center gap-1 text-[11px]"
                        title={language === "VI" ? "Đọc thành tiếng" : "Read aloud"}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{language === "VI" ? "Đọc" : "Listen"}</span>
                      </button>

                      <button
                        className="p-1 hover:text-blue-600 rounded transition-colors"
                        title={language === "VI" ? "Hữu ích" : "Helpful"}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Chỉ gợi ý học tiếp khi phản hồi có nội dung AI dùng được. */}
                  {!msg.suppressFollowUps &&
                    (!msg.summaryData ||
                      shouldShowSummaryFollowUps(msg.summaryData.depth)) &&
                    (!msg.summaryData ||
                      msg.summaryData.status === "verified" ||
                      msg.summaryData.status === "partial") && (
                  <div className="flex flex-col space-y-1.5 pt-2">
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
                          className="px-3 py-1.5 rounded-full border border-blue-200/80 dark:border-slate-700 bg-blue-50/60 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 text-[11px] font-medium transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
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

            {/* Loading Indicator */}
            {isLoading && (
              <div className="w-full flex flex-col pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2 animate-pulse">
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
                            ? "VLearn Tutor đang soạn ghi chú..."
                            : "VLearn Tutor is preparing your note..."
                        )}
                  </span>
                </div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            )}

            <div ref={messagesEndRef} />
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
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                  summaryDepth === depth
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
              }
            }}
            placeholder={
              language === "VI"
                ? "Hỏi về bài học hoặc nhập câu hỏi..."
                : "Ask about the lesson or type a question..."
            }
            className="w-full py-1.5 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none resize-none max-h-32 min-h-[32px] leading-relaxed flex items-center"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all duration-200 active:scale-95 shadow-md shrink-0 flex items-center justify-center ml-1.5"
            title={language === "VI" ? "Gửi câu hỏi" : "Send Question"}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Disclaimer Footer Text */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-normal px-2">
          {language === "VI"
            ? "Công cụ này được hỗ trợ bởi AI, vui lòng kiểm tra lại thông tin và không chia sẻ thông tin nhạy cảm. Dữ liệu của bạn sẽ được sử dụng theo Chính sách quyền riêng tư của Vlearn."
            : "This tool is powered by AI, please verify information and do not share sensitive data. Your data is processed per Vlearn Privacy Policy."}
        </p>
      </div>

      {/* 4. Past History Sessions Drawer */}
      {historyOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-40 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl p-4 max-h-[85%] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <History className="w-4 h-4 text-blue-600" />
                <span>{language === "VI" ? "Lịch sử học tập" : "Learning History"}</span>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {pastSessions.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  {language === "VI"
                    ? "Chưa có lịch sử trò chuyện."
                    : "No conversation history yet."}
                </p>
              ) : (
                pastSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (session.messages.length > 0) {
                        setMessages(session.messages);
                      }
                      setHistoryOpen(false);
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 cursor-pointer transition-all flex items-start justify-between group"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600">
                        {session.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {session.createdAt} · Slide {session.pageNumber}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => {
                handleNewChat();
                setHistoryOpen(false);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "VI" ? "Bắt đầu cuộc trò chuyện mới" : "Start New Conversation"}</span>
            </button>
          </div>
        </div>
      )}
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
  const [expandedPoint, setExpandedPoint] = useState<number | null>(null);
  const [quizPoint, setQuizPoint] = useState<number | null>(null);
  const coverage = data.coverage;
  const status =
    data.status ?? (data.provider === "xah" ? "verified" : "fallback");
  const sourceTotal =
    coverage.verified_points + coverage.rejected_points;

  useEffect(() => {
    setExpandedPoint(null);
    setQuizPoint(null);
  }, [data.scope_description, data.summary]);

  const StatusIcon =
    status === "verified"
      ? CheckCircle2
      : status === "not_applicable"
        ? Info
        : AlertTriangle;
  const statusLabel =
    language === "VI"
      ? {
          verified: `Nguồn khớp ${coverage.verified_points}/${sourceTotal} ý`,
          partial: `Chỉ ${coverage.verified_points}/${sourceTotal} ý có nguồn`,
          fallback: "Đang dùng dữ liệu dự phòng",
          error: "Không đủ bằng chứng",
          not_applicable: "Không có kiến thức cần tóm tắt",
        }[status]
      : {
          verified: `Sources matched ${coverage.verified_points}/${sourceTotal}`,
          partial: `Only ${coverage.verified_points}/${sourceTotal} points are sourced`,
          fallback: "Using fallback data",
          error: "Insufficient evidence",
          not_applicable: "No learning content to summarize",
        }[status];
  const statusClasses =
    status === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : status === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
        : status === "not_applicable"
          ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${statusClasses}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLabel}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {language === "VI"
            ? `Đã đọc ${coverage.processed_pages}/${coverage.requested_pages} trang`
            : `Read ${coverage.processed_pages}/${coverage.requested_pages} pages`}
        </span>
        {data.cached && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
            <Sparkles className="h-3 w-3" />
            {language === "VI" ? "Phản hồi tức thì" : "Instant response"}
          </span>
        )}
        {data.depth && (
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
            {
              data.depth === "quick"
                ? (language === "VI" ? "30 giây" : "Quick")
                : data.depth === "study"
                  ? (language === "VI" ? "Học sâu" : "Study")
                  : (language === "VI" ? "Tiêu chuẩn" : "Standard")
            }
          </span>
        )}
      </div>

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
          const isExpanded = expandedPoint === index;
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
                    setExpandedPoint(index);
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
                <button
                  type="button"
                  onClick={() => setExpandedPoint(isExpanded ? null : index)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <Quote className="h-3 w-3" />
                  {language === "VI" ? "Xem bằng chứng" : "View evidence"}
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <blockquote className="mt-2 ml-7 rounded-lg border-l-2 border-emerald-500 bg-emerald-50/70 px-3 py-2 text-[11px] italic leading-relaxed text-slate-700 dark:bg-emerald-950/30 dark:text-slate-200">
                  “{point.evidence_quote}”
                </blockquote>
              )}
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

// Helper function to render bold markdown (**text**)
function formatInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
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

  return (
    <div className="space-y-3.5 text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-relaxed font-sans pt-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Callout card for "Lưu ý", "Mẹo học", "Note", "Chú ý"
        const calloutMatch = line.match(/^(\*\*|\>|\-|\*)*\s*(Lưu ý|Mẹo học|Chú ý|Note):\s*(.*)/i);
        if (calloutMatch) {
          const calloutTitle = calloutMatch[2];
          const calloutBody = calloutMatch[3].replace(/\*\*/g, "");
          return (
            <div
              key={idx}
              className="my-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 dark:text-slate-200 flex items-start gap-2.5 shadow-2xs"
            >
              <span className="text-base shrink-0">💡</span>
              <div className="flex-1">
                <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-0.5">
                  💡 {calloutTitle}
                </span>
                <span>{formatInlineBold(calloutBody)}</span>
              </div>
            </div>
          );
        }

        // Section Headings conversion (e.g. "- **Mục tiêu cốt lõi**:", "**Khái niệm quan trọng**")
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
          return (
            <h2
              key={idx}
              className="text-sm md:text-base font-bold text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200/70 dark:border-slate-800 mt-3 mb-1"
            >
              {titleText}
            </h2>
          );
        }

        // Headings (H1, H2, H3)
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-base md:text-lg font-bold text-slate-900 dark:text-white pt-3 pb-1 leading-snug">
              {formatInlineBold(line.substring(2))}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-sm md:text-base font-bold text-slate-900 dark:text-white pt-2.5 pb-1 leading-snug">
              {formatInlineBold(line.substring(3))}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-xs md:text-sm font-bold text-slate-900 dark:text-white pt-2 pb-0.5 leading-snug">
              {formatInlineBold(line.substring(4))}
            </h3>
          );
        }

        // Bullet lists
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span className="flex-1">{formatInlineBold(line.substring(2))}</span>
            </div>
          );
        }

        // Numbered lists
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+\.)\s(.*)/);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 my-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">{match[1]}</span>
                <span className="flex-1">{formatInlineBold(match[2])}</span>
              </div>
            );
          }
        }

        // Blockquotes
        if (line.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-3 border-blue-500 pl-3 py-1.5 italic bg-blue-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 my-2 rounded-r text-xs md:text-sm"
            >
              {formatInlineBold(line.substring(2))}
            </blockquote>
          );
        }

        // Code blocks
        if (line.startsWith("```")) {
          return (
            <pre key={idx} className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-xs overflow-x-auto my-2 border border-slate-800">
              <code>{line.replace(/```/g, "")}</code>
            </pre>
          );
        }

        return <p key={idx} className="leading-relaxed my-1">{formatInlineBold(line)}</p>;
      })}
    </div>
  );
}


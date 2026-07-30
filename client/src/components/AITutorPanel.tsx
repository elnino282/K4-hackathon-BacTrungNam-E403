import React, { useState, useRef, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  Quote,
  Info,
} from "lucide-react";
import {
  getReferencedPage,
  parseSummaryIntent,
} from "../lib/summaryIntent";
import {
  ChatMessage,
  ChatSession,
  ContextSnippet,
  Language,
  SummaryData,
} from "../types";

interface AITutorPanelProps {
  currentPage: number;
  totalPages?: number;
  selectedContext: ContextSnippet | null;
  onClearContext: () => void;
  language: Language;
  onClose?: () => void;
  onNavigateToPage?: (page: number) => void;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

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

  const isNearBottom = () => {
    if (!scrollContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 120;
  };

  const scrollToBottom = (force = false) => {
    if (force || isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages, isLoading]);

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
      title: language === "VI" ? "Tóm tắt trang này" : "Summarize this page",
      description:
        language === "VI"
          ? "Tóm tắt những ý chính của trang hiện tại."
          : "Summarize the key takeaways of this page.",
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
          ? "Lọc các thuật ngữ quan trọng ngay trong trang này."
          : "Review the important terms found on this page.",
      query:
        language === "VI"
          ? "Liệt kê các thuật ngữ chính và giải thích ngắn gọn theo đúng nội dung trang này."
          : "List the key terms and explain them briefly using only this page.",
    },
  ];

  // Handle New Message Submission
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsgId = Date.now().toString();
    const activeSnippet = selectedContext ? { ...selectedContext } : undefined;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      context: activeSnippet,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);
    setTimeout(() => scrollToBottom(true), 50);
    const summaryIntent = parseSummaryIntent(
      messageContent,
      currentPage,
      totalPages,
    );
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

    const referencedPage = getReferencedPage(messageContent);
    const defaultPage =
      referencedPage || activeSnippet?.pageNumber || currentPage;
    const summaryScope =
      summaryIntent.kind === "valid" ? summaryIntent.scope : null;
    const relevantSnippet =
      activeSnippet?.pageNumber === defaultPage ? activeSnippet : undefined;
    let summaryData: SummaryData | undefined;

    try {
      let botReply = "";

      if (summaryScope) {
        const response = await fetch("/api/summaries/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc_id: "lesson-01",
            ...summaryScope,
            language,
          }),
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
        const response = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageContent,
            selected_text: relevantSnippet?.text,
            page_context: defaultPage,
            slide_title:
              relevantSnippet?.slideTitle || `${fileName} (Trang ${defaultPage})`,
            language,
          }),
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
  // Strips code blocks, inline code formatting, citations, metadata headers, markdown elements, and HTML tags
  const cleanTextForSpeech = (rawText: string): string => {
    if (!rawText) return "";
    let text = rawText;

    // 1. Remove code blocks (```...```)
    text = text.replace(/```[\s\S]*?```/g, "");

    // 2. Remove inline code backticks but keep inner content
    text = text.replace(/`([^`]+)`/g, "$1");

    // 3. Remove citations & slide metadata references e.g. [1], [Slide 2], [Nguồn: Slide 3], (Slide 4)
    text = text.replace(/\[\d+(?:,\s*\d+)*\]/g, "");
    text = text.replace(/\[(?:Nguồn|Source|Slide|Trang|Page)[^\]]*\]/gi, "");
    text = text.replace(/\((?:Nguồn|Source|Slide|Trang|Page)[^\)]*\)/gi, "");

    // 4. Remove Markdown images and strip link URLs, keeping link text [text](url) -> text
    text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");
    text = text.replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1");

    // 5. Remove Markdown headers
    text = text.replace(/^#{1,6}\s+/gm, "");

    // 6. Remove bold/italic formatting delimiters
    text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");
    text = text.replace(/[*_~]+/g, "");

    // 7. Remove LaTeX math delimiters \( \), \[ \], $, $$
    text = text.replace(/\\[()\[\]]/g, "");
    text = text.replace(/\$+/g, "");

    // 8. Remove HTML tags
    text = text.replace(/<[^>]*>/g, "");

    // 9. Remove bullet point markers at line beginnings
    text = text.replace(/^[\s*+\-•]+\s*/gm, "");

    // 10. Normalize spacing
    return text.replace(/\s+/g, " ").trim();
  };

  // Voice playback using Web Speech API with Play / Stop toggle for individual messages
  const handleToggleSpeak = (id: string, text: string) => {
    if (!("speechSynthesis" in window)) return;

    // If currently reading this message, stop immediately
    if (readingId === id) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setReadingId(null);
      return;
    }

    // Stop any active speech before starting a new message
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
        },
        {
          id: "quiz",
          label: "❓ Tạo quiz ôn tập",
          query: "Tạo câu hỏi ôn tập dựa trên nội dung vừa trả lời.",
        },
        {
          id: "terms",
          label: "📚 Ôn thuật ngữ",
          query: "Liệt kê các thuật ngữ chính và giải thích theo đúng nội dung slide.",
        },
        {
          id: "summary",
          label: "📄 Tóm tắt ý chính",
          query: "Tóm tắt lại các ý chính bằng gạch đầu dòng.",
        },
      ]
    : [
        {
          id: "more",
          label: "💡 Explain more",
          query: "Explain more details about this part.",
        },
        {
          id: "quiz",
          label: "❓ Review quiz",
          query: "Generate a review quiz based on this response.",
        },
        {
          id: "terms",
          label: "📚 Review terms",
          query: "List and explain the key terms using only the current slide.",
        },
        {
          id: "summary",
          label: "📄 Key takeaways",
          query: "Summarize key points in bullet format.",
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
              onClick={onClose}
              aria-label={language === "VI" ? "Đóng VLearn Tutor" : "Close VLearn Tutor"}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === "VI" ? "Đóng" : "Close"}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 overflow-y-auto px-4 py-3.5 md:px-5 space-y-3.5 bg-white dark:bg-slate-900"
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

            {/* Selected Context Highlight Pill (If user selected text on slide) */}
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
                    className="text-blue-500 hover:text-blue-800 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="line-clamp-2 italic text-[11px] text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 p-2 rounded border border-blue-100 dark:border-blue-900/50">
                  "{selectedContext.text}"
                </p>
              </div>
            )}

            {/* Action Cards Grid - 52px Compact Height (All 4 Cards Displayed Directly) */}
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
          /* State B: Coursera AI Conversation Experience */
          <div className="flex flex-col space-y-4 w-full">
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
                    className="text-blue-500 hover:text-blue-800 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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

              {/* Render Dedicated Error State Card */}
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium text-xs rounded-lg transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{language === "VI" ? "Thử lại" : "Retry"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // AI Single Response Card (Coursera AI Experience)
              return (
                <div
                  key={msg.id}
                  className="w-full bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4.5 md:p-5 shadow-2xs space-y-4 animate-in fade-in duration-200"
                >
                  {/* Contextual Document Title instead of VLearn Tutor & timestamp */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <BookMarked className="w-4 h-4" />
                      <span>
                        {msg.summaryData
                          ? msg.summaryData.scope_description
                          : msg.context?.pageNumber
                          ? `Tóm tắt Slide ${msg.context.pageNumber}`
                          : `Nội dung bài học Slide ${currentPage}`}
                      </span>
                    </div>
                  </div>
                  <div className="w-full">
                    {msg.summaryData ? (
                      <EvidenceSummary
                        data={msg.summaryData}
                        language={language}
                        onNavigateToPage={onNavigateToPage}
                      />
                    ) : (
                      renderDocumentMarkdown(msg.content)
                    )}
                  </div>

                  {/* 2. Source Section */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-lg shadow-2xs font-medium text-slate-700 dark:text-slate-300">
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {language === "VI" ? "Nguồn:" : "Source:"} Trang {msg.context?.pageNumber || currentPage} ({fileName})
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        readingId === msg.id
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
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        likedIds.has(msg.id)
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
                  {!msg.suppressFollowUps && (!msg.summaryData ||
                    msg.summaryData.status === "verified" ||
                    msg.summaryData.status === "partial") && (
                  <div className="flex flex-col space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {language === "VI" ? "Gợi ý tiếp theo:" : "Suggested follow-ups:"}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {suggestedFollowUps.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSendMessage(action.query)}
                          aria-label={action.label}
                          className="px-3 py-1.5 min-h-[34px] rounded-full border border-blue-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                        >
                          {action.label}
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
                aria-label={language === "VI" ? "VLearn Tutor đang soạn câu trả lời" : "VLearn Tutor is generating a response"}
                className="w-full bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4.5 md:p-5 space-y-3 animate-pulse shadow-2xs"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>
                    {language === "VI" ? "VLearn Tutor đang suy nghĩ..." : "VLearn Tutor is thinking..."}
                  </span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-3.5 bg-slate-200/80 dark:bg-slate-700/60 rounded-full w-5/6" />
                  <div className="h-3.5 bg-slate-200/80 dark:bg-slate-700/60 rounded-full w-2/3" />
                  <div className="h-3.5 bg-slate-200/80 dark:bg-slate-700/60 rounded-full w-3/4" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. Sticky Bottom Input Section */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 sticky bottom-0 z-10 shrink-0 space-y-1.5">
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
            aria-label={
              language === "VI"
                ? "Hỏi về bài học hoặc nhập câu hỏi"
                : "Ask about the lesson or type a question"
            }
            className="w-full py-1.5 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none resize-none max-h-32 min-h-[32px] leading-relaxed flex items-center"
          />

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
            ? "Công cụ này được hỗ trợ bởi AI, vui lòng kiểm tra lại thông tin và không chia sẻ thông tin nhạy cảm. Dữ liệu của bạn sẽ được sử dụng theo Chính sách quyền riêng tư của Vlearn."
            : "This tool is powered by AI, please verify information and do not share sensitive data. Your data is processed per Vlearn Privacy Policy."}
        </p>
      </div>
    </aside>
  );
};

interface EvidenceSummaryProps {
  data: SummaryData;
  language: Language;
  onNavigateToPage?: (page: number) => void;
}

const EvidenceSummary: React.FC<EvidenceSummaryProps> = ({
  data,
  language,
  onNavigateToPage,
}) => {
  const [expandedPoint, setExpandedPoint] = useState<number | null>(null);
  const coverage = data.coverage;
  const status =
    data.status ?? (data.provider === "xah" ? "verified" : "fallback");
  const sourceTotal =
    coverage.verified_points + coverage.rejected_points;
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

              <div className="mt-2 flex items-center justify-between gap-2 pl-7">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedPoint(index);
                    onNavigateToPage?.(point.page);
                  }}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900"
                >
                  {language === "VI"
                    ? `Mở & kiểm tra trang ${point.page}`
                    : `Open & verify page ${point.page}`}
                </button>
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


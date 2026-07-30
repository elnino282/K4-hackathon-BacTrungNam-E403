import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import {
  getReferencedPage,
  getSummaryScope,
} from "../lib/summaryIntent";
import { ChatMessage, ContextSnippet, Language, ChatSession } from "../types";

interface AITutorPanelProps {
  currentPage: number;
  totalPages?: number;
  selectedContext: ContextSnippet | null;
  onClearContext: () => void;
  language: Language;
  onClose?: () => void;
  fileName?: string;
}

interface ActionCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  query: string;
}

export const AITutorPanel: React.FC<AITutorPanelProps> = ({
  currentPage,
  totalPages = 45,
  selectedContext,
  onClearContext,
  language,
  onClose,
  fileName = "Day02.pdf",
}) => {
  // Chat History & Messages State - starts empty to show Vlearn AI Hero state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    const referencedPage = getReferencedPage(messageContent);
    const defaultPage =
      referencedPage || activeSnippet?.pageNumber || currentPage;
    const summaryScope = getSummaryScope(messageContent, defaultPage);
    const relevantSnippet =
      activeSnippet?.pageNumber === defaultPage ? activeSnippet : undefined;

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
          throw new Error(`Summary API returned ${response.status}`);
        }

        const data = await response.json();
        const points = Array.isArray(data.key_points)
          ? data.key_points.map((point: string) => `- ${point}`).join("\n")
          : "";
        botReply = [data.summary, points, data.notice]
          .filter(Boolean)
          .join("\n\n");
      } else {
        const response = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageContent,
            selected_text: relevantSnippet?.text,
            page_context: defaultPage,
            slide_title:
              relevantSnippet?.slideTitle || `${fileName} (Slide ${defaultPage})`,
            language,
          }),
        });
        if (!response.ok) {
          throw new Error(`Tutor API returned ${response.status}`);
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
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-white dark:bg-slate-900">
        {/* State A: Vlearn AI Empty Hero State */}
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

            {/* Action Cards Grid - Compact Vlearn AI Style */}
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
          /* State B: Active Conversation Messages */
          <div className="flex flex-col space-y-4">
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

            {/* Message History List */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"
                  } animate-in fade-in slide-in-from-bottom-1 duration-200`}
              >
                {/* Context snippet header if attached */}
                {msg.context && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 max-w-[85%]">
                    <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                    <span className="truncate">
                      Slide {msg.context.pageNumber}: "{msg.context.text}"
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className="flex items-start gap-2.5 max-w-[90%] group">
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-xs md:text-sm leading-relaxed shadow-xs ${msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs"
                      }`}
                  >
                    <div className="whitespace-pre-wrap space-y-1.5">
                      {msg.content.split("\n").map((line, idx) => {
                        if (line.startsWith("- ") || line.startsWith("* ")) {
                          return (
                            <li key={idx} className="ml-3 list-disc">
                              {formatInlineBold(line.substring(2))}
                            </li>
                          );
                        }
                        if (line.startsWith("> ")) {
                          return (
                            <blockquote
                              key={idx}
                              className="border-l-2 border-blue-400 pl-2 italic text-slate-600 dark:text-slate-300 my-1 bg-blue-50/50 dark:bg-slate-900/40 py-1 rounded-r"
                            >
                              {formatInlineBold(line.substring(2))}
                            </blockquote>
                          );
                        }
                        return <p key={idx}>{formatInlineBold(line)}</p>;
                      })}
                    </div>

                    {/* Toolbar Footer */}
                    <div
                      className={`mt-2 flex items-center justify-between text-[10px] pt-1.5 border-t ${msg.role === "user"
                        ? "border-blue-500/40 text-blue-100"
                        : "border-slate-200/60 dark:border-slate-700/60 text-slate-400"
                        }`}
                    >
                      <span>{msg.timestamp}</span>

                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1 hover:text-slate-700 dark:hover:text-white rounded transition-colors"
                            title={language === "VI" ? "Sao chép" : "Copy"}
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleSpeak(msg.content)}
                            className="p-1 hover:text-slate-700 dark:hover:text-white rounded transition-colors"
                            title={language === "VI" ? "Đọc thành tiếng" : "Read aloud"}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            className="p-1 hover:text-blue-600 rounded transition-colors"
                            title={language === "VI" ? "Hữu ích" : "Helpful"}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-xs">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                  <span className="text-xs text-slate-400 ml-1">
                    {language === "VI" ? "VLearn Tutor đang suy nghĩ..." : "VLearn Tutor is thinking..."}
                  </span>
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

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
  ThumbsDown,
  Sparkles,
  HelpCircle,
  BookMarked,
  FileText,
  RotateCcw,
  MessageSquare
} from "lucide-react";
import { ChatMessage, ContextSnippet, Language, ChatSession } from "../types";

interface AITutorPanelProps {
  currentPage: number;
  selectedContext: ContextSnippet | null;
  onClearContext: () => void;
  language: Language;
  onSelectContext: (text: string) => void;
}

export const AITutorPanel: React.FC<AITutorPanelProps> = ({
  currentPage,
  selectedContext,
  onClearContext,
  language,
  onSelectContext,
}) => {
  // Chat History & Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        language === "VI"
          ? "Xin chào! Mình là VLearn Tutor. Bạn có thể bôi đen một đoạn trên slide để hỏi hoặc gửi câu hỏi tự do nhé!"
          : "Hello! I am VLearn Tutor. You can highlight any text on the slide to ask a question or type your prompt directly!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([
    {
      id: "sess-1",
      title: "COMP2010 - Intro & AI Problem Definition",
      createdAt: "Yesterday, 14:30",
      pageNumber: 1,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Problem Statement là gì?",
          timestamp: "14:30",
        },
        {
          id: "m2",
          role: "assistant",
          content: "Problem Statement trong AI là câu tuyên bố rõ ràng về vấn đề cần giải quyết...",
          timestamp: "14:31",
        },
      ],
    },
    {
      id: "sess-2",
      title: "Slide 2 - Mai Anh Nguyen Instructor",
      createdAt: "2 days ago",
      pageNumber: 2,
      messages: [],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
    setIsLoading(true);

    try {
      const response = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          selectedText: activeSnippet?.text,
          pageContext: activeSnippet?.pageNumber || currentPage,
          slideTitle: activeSnippet?.slideTitle || `Slide ${currentPage}`,
          language,
        }),
      });

      const data = await response.json();
      const botReply = data.reply || (language === "VI" ? "Xin lỗi, đã xảy ra lỗi khi tạo phản hồi." : "Sorry, an error occurred while creating a response.");

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
            ? "Mình đã ghi nhận câu hỏi của bạn! Trên slide này, yếu tố cốt lõi là làm rõ định nghĩa bài toán cho mô hình AI."
            : "I've noted your question! On this slide, the essential factor is clarifying the problem statement definition for the AI model.",
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

  // New Chat session
  const handleNewChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        content:
          language === "VI"
            ? "Đã tạo đoạn chat mới! Bạn có câu hỏi gì về bài giảng hôm nay không?"
            : "Started a new chat! What questions do you have about today's lecture?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
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

  // Suggested quick prompts
  const quickPrompts =
    language === "VI"
      ? [
          "💡 Tóm tắt nội dung slide này",
          "❓ 'Problem Statement' là gì?",
          "📝 Tạo 2 câu hỏi kiểm tra",
          "🎯 Cho ví dụ áp dụng thực tế",
        ]
      : [
          "💡 Summarize this slide",
          "❓ What is a 'Problem Statement'?",
          "📝 Generate 2 quiz questions",
          "🎯 Give a real-world example",
        ];

  return (
    <aside className="w-full md:w-[360px] lg:w-[380px] shrink-0 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col h-full shadow-lg relative font-sans transition-colors">
      {/* 1. Header Section */}
      <div className="p-3.5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-2xs">
        {/* Left: Avatar & Title & Green Status */}
        <div className="flex items-center gap-2.5">
          {/* Avatar / Logo badge */}
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs shrink-0">
            <Bot className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
              VLearn Tutor
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]">
                {language === "VI" ? "Trợ lý học theo ngữ cảnh" : "Context-aware learning assistant"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions (History, New Chat, Page Context Badge) */}
        <div className="flex items-center gap-1">
          {/* Page Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
            <span>
              {language === "VI" ? `Trang slide: ${currentPage}` : `Slide page: ${currentPage}`}
            </span>
          </div>

          {/* History Icon */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title={language === "VI" ? "Lịch sử trò chuyện" : "Chat History"}
          >
            <History className="w-4 h-4" />
          </button>

          {/* New Chat Icon */}
          <button
            onClick={handleNewChat}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title={language === "VI" ? "Cuộc trò chuyện mới" : "New Chat"}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Active Context Chip (if text selected on slide) */}
        {selectedContext && (
          <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/80 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300">
                <BookMarked className="w-3.5 h-3.5" />
                {language === "VI"
                  ? `Ngữ cảnh: Slide trang ${selectedContext.pageNumber}`
                  : `Context: Slide page ${selectedContext.pageNumber}`}
              </span>
              <button
                onClick={onClearContext}
                className="text-blue-500 hover:text-blue-800 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="line-clamp-2 italic text-slate-700 dark:text-blue-100/90 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded-md border border-blue-100 dark:border-blue-900/50">
              "{selectedContext.text}"
            </p>
          </div>
        )}

        {/* Conversation Message List */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Context tag on user message if attached */}
            {msg.context && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 flex items-center gap-1 max-w-[85%]">
                <FileText className="w-3 h-3 text-blue-500" />
                <span className="truncate">
                  {language === "VI"
                    ? `Slide ${msg.context.pageNumber}: "${msg.context.text}"`
                    : `Slide ${msg.context.pageNumber}: "${msg.context.text}"`}
                </span>
              </div>
            )}

            {/* Message Bubble Container */}
            <div className="flex items-start gap-2 max-w-[90%] group">
              {/* Bot Avatar Icon for assistant messages */}
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center text-xs shrink-0 mt-0.5 border border-blue-200 dark:border-blue-900">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 text-xs md:text-sm leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-xs"
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-bl-xs"
                }`}
              >
                {/* Formatted Text Content */}
                <div className="whitespace-pre-wrap space-y-2">
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

                {/* Message Timestamp & Interaction Toolbar */}
                <div
                  className={`mt-2 flex items-center justify-between text-[10px] pt-1.5 border-t ${
                    msg.role === "user"
                      ? "border-blue-500/40 text-blue-100"
                      : "border-gray-100 dark:border-slate-700/60 text-slate-400"
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 hover:text-slate-700 dark:hover:text-white rounded"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>

                      {/* Speak voice */}
                      <button
                        onClick={() => handleSpeak(msg.content)}
                        className="p-1 hover:text-slate-700 dark:hover:text-white rounded"
                        title="Read aloud"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>

                      {/* Thumbs up/down */}
                      <button className="p-1 hover:text-blue-600 rounded" title="Helpful">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Streaming/Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
              <span className="text-[11px] text-slate-400 ml-1">
                {language === "VI" ? "VLearn Tutor đang suy nghĩ..." : "VLearn Tutor is thinking..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Suggested Prompts Bar */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
        {quickPrompts.map((promptText, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(promptText.replace(/^[💡❓📝🎯]\s*/, ""))}
            className="shrink-0 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-300 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700 transition-all font-medium text-[11px]"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* 4. Sticky Input Area */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 sticky bottom-0 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              language === "VI"
                ? "Nhập câu hỏi hoặc bôi đen tài liệu..."
                : "Ask about the lecture or selected content..."
            }
            className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs md:text-sm rounded-full focus:outline-none transition-all shadow-inner"
          />

          {/* Circular Blue Send Button matching screenshot */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center"
            title={language === "VI" ? "Gửi câu hỏi" : "Send Question"}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 5. Past History Sessions Modal / Drawer */}
      {historyOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-30 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 rounded-t-2xl p-4 max-h-[80%] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-slate-800">
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
              {pastSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    if (session.messages.length > 0) {
                      setMessages(session.messages);
                    }
                    setHistoryOpen(false);
                  }}
                  className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 cursor-pointer transition-all flex items-start justify-between group"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600">
                      {session.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {session.createdAt} · Slide {session.pageNumber}
                    </span>
                  </div>
                  <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                </div>
              ))}
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

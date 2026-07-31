import React, { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, Bot, Sparkles, GripVertical } from "lucide-react";
import { HeaderNav } from "./components/HeaderNav";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { SlideViewer } from "./components/SlideViewer";
import { AITutorPanel } from "./components/AITutorPanel";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "./data/mockSlides";
import { Language, ContextSnippet } from "./types";

const CHAT_WIDTH_STORAGE_KEY = "vlearn_chat_panel_width";
const TOOLTIP_STORAGE_KEY = "vlearn_resize_tooltip_seen";
const DEFAULT_CHAT_WIDTH = 480;
const MIN_CHAT_WIDTH = 420;
const MAX_CHAT_WIDTH = 620;
const MIN_PDF_WIDTH = 600;

const getClampedChatWidth = (width: number): number => {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const maxAllowedWidth = Math.max(
    MIN_CHAT_WIDTH,
    Math.min(MAX_CHAT_WIDTH, viewportWidth - MIN_PDF_WIDTH)
  );
  return Math.min(Math.max(width, MIN_CHAT_WIDTH), maxAllowedWidth);
};

const getInitialChatWidth = (): number => {
  if (typeof window === "undefined") return DEFAULT_CHAT_WIDTH;
  try {
    const saved = localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) {
        return getClampedChatWidth(parsed);
      }
    }
  } catch (e) {
    console.error("Failed to read chat width preference:", e);
  }
  return DEFAULT_CHAT_WIDTH;
};

export default function App() {
  const [language, setLanguage] = useState<Language>("VI");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [panelOnlyMode, setPanelOnlyMode] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activeTool, setActiveTool] = useState<"read" | "pen" | "highlight">("read");

  const [pdfTotalPages, setPdfTotalPages] = useState<number>(44);
  const [, setPageTexts] = useState<Record<number, string>>({});

  const [selectedContext, setSelectedContext] = useState<ContextSnippet | null>(null);

  // Desktop Resizable Chat Width & Tooltip States
  const [chatWidth, setChatWidth] = useState<number>(getInitialChatWidth);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDesktopScreen, setIsDesktopScreen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [showResizeTooltip, setShowResizeTooltip] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return !localStorage.getItem(TOOLTIP_STORAGE_KEY);
    } catch (e) {
      return false;
    }
  });

  const dismissResizeTooltip = () => {
    if (showResizeTooltip) {
      setShowResizeTooltip(false);
      try {
        localStorage.setItem(TOOLTIP_STORAGE_KEY, "true");
      } catch (e) {
        console.error("Failed to save tooltip preference:", e);
      }
    }
  };

  // Apply dark mode class to root HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Persist chat width preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, chatWidth.toString());
    } catch (e) {
      console.error("Failed to save chat width preference:", e);
    }
  }, [chatWidth]);

  // Handle viewport resize: re-clamp width and update desktop screen status
  useEffect(() => {
    const handleWindowResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsDesktopScreen(isDesktop);
      setChatWidth((prev) => getClampedChatWidth(prev));
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Disable text selection and set col-resize cursor globally while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dismissResizeTooltip();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rawWidth = window.innerWidth - moveEvent.clientX;
      setChatWidth(getClampedChatWidth(rawWidth));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleDoubleClick = () => {
    setChatWidth(DEFAULT_CHAT_WIDTH);
    dismissResizeTooltip();
  };

  // Reference to open button for focus restoration when closing panel
  const openButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseSidebar = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSidebarOpen(false);
    setTimeout(() => {
      openButtonRef.current?.focus();
    }, 50);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setChatWidth((prev) => getClampedChatWidth(prev + 16));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setChatWidth((prev) => getClampedChatWidth(prev - 16));
    } else if (e.key === "Home") {
      e.preventDefault();
      setChatWidth(currentMaxChatWidth);
    } else if (e.key === "End") {
      e.preventDefault();
      setChatWidth(MIN_CHAT_WIDTH);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setChatWidth(DEFAULT_CHAT_WIDTH);
    }
  };

  const handlePDFLoaded = (numPages: number) => {
    if (numPages && numPages > 0) {
      setPdfTotalPages(numPages);
    }
  };

  const handleExtractPageText = (page: number, text: string) => {
    setPageTexts((prev) => ({ ...prev, [page]: text }));
  };

  const handleSelectTextFromSlide = (text: string) => {
    setSelectedContext({
      text,
      pageNumber: currentPage,
      slideTitle: `${DEFAULT_PDF_FILENAME} (Trang ${currentPage})`,
    });
    // Open sidebar if closed on text selection
    setIsSidebarOpen(true);
  };

  const handleClearContext = () => {
    setSelectedContext(null);
  };

  const currentMaxChatWidth = typeof window !== "undefined"
    ? Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, window.innerWidth - MIN_PDF_WIDTH))
    : MAX_CHAT_WIDTH;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors relative">
      {/* Top Application Navigation Bar */}
      <HeaderNav
        language={language}
        onLanguageChange={setLanguage}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        panelOnlyMode={panelOnlyMode}
        onTogglePanelOnlyMode={() => setPanelOnlyMode((prev) => !prev)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Document Slide Canvas */}
        {!panelOnlyMode && (
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 relative w-full h-full overflow-hidden">
            <DocumentToolbar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              currentPage={currentPage}
              totalPages={pdfTotalPages}
              zoomLevel={zoomLevel}
              onZoomIn={() => setZoomLevel((z) => Math.min(180, z + 10))}
              onZoomOut={() => setZoomLevel((z) => Math.max(70, z - 10))}
              language={language}
              notesCount={1}
              fileName={DEFAULT_PDF_FILENAME}
              onPageChange={setCurrentPage}
            />

            <SlideViewer
              pdfUrl={DEFAULT_PDF_URL}
              fileName={DEFAULT_PDF_FILENAME}
              currentPage={currentPage}
              totalPages={pdfTotalPages}
              onPageChange={setCurrentPage}
              onSelectText={handleSelectTextFromSlide}
              language={language}
              zoomLevel={zoomLevel}
              activeTool={activeTool}
              onPDFLoaded={handlePDFLoaded}
              onExtractPageText={handleExtractPageText}
            />
          </div>
        )}

        {/* Desktop Vertical Resize Handle */}
        {isSidebarOpen && !panelOnlyMode && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={MIN_CHAT_WIDTH}
            aria-valuemax={currentMaxChatWidth}
            aria-valuenow={chatWidth}
            aria-valuetext={`${chatWidth}px width`}
            aria-label={language === "VI" ? "Thay đổi kích thước khung VLearn Tutor" : "Resize VLearn Tutor panel"}
            title={language === "VI" ? "Kéo để thay đổi kích thước, nhấp kép hoặc phím Enter để đặt lại (Phím mũi tên, Home, End)" : "Drag to resize, double-click or Enter to reset (Arrow keys, Home, End)"}
            onPointerDown={handlePointerDown}
            onKeyDown={handleResizeKeyDown}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={dismissResizeTooltip}
            className={`
              hidden lg:flex items-center justify-center relative
              w-4.5 cursor-col-resize select-none h-full z-30 shrink-0
              bg-transparent group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              ${isDragging ? "transition-none" : "transition-all duration-150"}
            `}
            style={{ width: "18px" }}
          >
            {/* Center Thin Divider Line (2px default, 4px when dragging) */}
            <div
              className={`
                h-full rounded-full transition-all duration-150
                ${
                  isDragging
                    ? "transition-none w-[4px] bg-blue-600 dark:bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                    : "w-[2px] bg-slate-200 dark:bg-slate-800 group-hover:bg-blue-500 group-focus-visible:bg-blue-500"
                }
              `}
            />

            {/* First Visit Tooltip */}
            {showResizeTooltip && (
              <div
                className="absolute top-12 right-6 z-50 flex items-center gap-1.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl border border-slate-700/80 animate-bounce pointer-events-auto whitespace-nowrap"
              >
                <span>Kéo để thay đổi kích thước</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissResizeTooltip();
                  }}
                  className="ml-1 text-slate-400 hover:text-white font-bold cursor-pointer text-xs leading-none"
                  title="Đóng"
                >
                  ✕
                </button>
                {/* Pointer Arrow */}
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-slate-900 dark:border-l-slate-800" />
              </div>
            )}
          </div>
        )}

        {/* Desktop Re-open Button (Shown only when panel is closed) */}
        {!panelOnlyMode && !isSidebarOpen && (
          <button
            ref={openButtonRef}
            onClick={() => setIsSidebarOpen(true)}
            className="hidden lg:flex items-center justify-center absolute top-1/2 -translate-y-1/2 right-0 z-40 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-l-xl shadow-lg transition-all cursor-pointer group hover:pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Mở AI Tutor"
            aria-label="Mở AI Tutor"
          >
            <Bot className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Right Side: Responsive VLearn AI Tutor Panel */}
        {isSidebarOpen && (
          <>
            {/* Backdrop for Tablet & Mobile when drawer is open */}
            <div
              className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
              onClick={handleCloseSidebar}
            />

            {/* Chatbot Container */}
            <div
              className={
                panelOnlyMode
                  ? "w-full max-w-xl mx-auto border-x border-gray-200 dark:border-slate-800"
                  : `
                    /* Desktop (>1024px): custom width from style */
                    hidden lg:flex shrink-0 h-full

                    /* Tablet (768-1024px): Right drawer overlay */
                    md:max-lg:flex md:max-lg:fixed md:max-lg:right-0 md:max-lg:top-14 md:max-lg:bottom-0 md:max-lg:w-[380px] md:max-lg:z-50 md:max-lg:shadow-2xl

                    /* Mobile (<768px): Fullscreen Bottom Sheet */
                    max-md:flex max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-12 max-md:z-50 max-md:rounded-t-2xl max-md:shadow-2xl
                  `
              }
              style={
                !panelOnlyMode && isDesktopScreen
                  ? { width: `${chatWidth}px` }
                  : undefined
              }
            >
              <AITutorPanel
                currentPage={currentPage}
                totalPages={pdfTotalPages}
                selectedContext={selectedContext}
                onClearContext={handleClearContext}
                language={language}
                onClose={handleCloseSidebar}
                onNavigateToPage={(page) => {
                  setCurrentPage(page);
                  setPanelOnlyMode(false);
                }}
                fileName={DEFAULT_PDF_FILENAME}
              />
            </div>
          </>
        )}

        {/* Mobile & Tablet Floating AI Launcher Button */}
        {!isSidebarOpen && !panelOnlyMode && (
          <button
            ref={openButtonRef}
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full p-3.5 shadow-xl flex items-center gap-2 transition-all duration-200 animate-in zoom-in-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Mở Trợ lý VLearn Tutor"
            aria-label="Mở Trợ lý VLearn Tutor"
          >
            <Bot className="w-5 h-5" />
            <span className="text-xs font-semibold pr-1">VLearn Tutor</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
          </button>
        )}
      </div>
    </div>
  );
}


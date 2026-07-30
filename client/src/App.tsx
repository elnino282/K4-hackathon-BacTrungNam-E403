import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Bot, Sparkles } from "lucide-react";
import { HeaderNav } from "./components/HeaderNav";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { SlideViewer } from "./components/SlideViewer";
import { AITutorPanel } from "./components/AITutorPanel";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "./data/mockSlides";
import { Language, ContextSnippet } from "./types";

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

  // Apply dark mode class to root HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

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
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 relative w-full lg:w-[70%] 2xl:w-[68%] transition-all">
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

        {/* Desktop Divider Toggle Button */}
        {!panelOnlyMode && (
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-l-xl shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            style={{ right: isSidebarOpen ? (panelOnlyMode ? "0px" : "var(--chatbot-width, 30%)") : "0px" }}
            title={isSidebarOpen ? "Thu gọn VLearn Tutor" : "Mở rộng VLearn Tutor"}
          >
            {isSidebarOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Right Side: Responsive VLearn AI Tutor Panel */}
        {isSidebarOpen && (
          <>
            {/* Backdrop for Tablet & Mobile when drawer is open */}
            <div
              className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
              onClick={() => setIsSidebarOpen(false)}
            />

            {/* Chatbot Container */}
            <div
              className={
                panelOnlyMode
                  ? "w-full max-w-xl mx-auto border-x border-gray-200 dark:border-slate-800"
                  : `
                    /* Desktop (>1440px): 32%, Laptop (1024-1440px): 30% */
                    hidden lg:flex lg:w-[30%] 2xl:w-[32%] shrink-0 h-full

                    /* Tablet (768-1024px): Right drawer overlay */
                    md:max-lg:flex md:max-lg:fixed md:max-lg:right-0 md:max-lg:top-14 md:max-lg:bottom-0 md:max-lg:w-[380px] md:max-lg:z-50 md:max-lg:shadow-2xl

                    /* Mobile (<768px): Fullscreen Bottom Sheet */
                    max-md:flex max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-12 max-md:z-50 max-md:rounded-t-2xl max-md:shadow-2xl
                  `
              }
            >
              <AITutorPanel
                currentPage={currentPage}
                totalPages={pdfTotalPages}
                selectedContext={selectedContext}
                onClearContext={handleClearContext}
                language={language}
                onClose={() => setIsSidebarOpen(false)}
                onNavigateToPage={(page) => {
                  setCurrentPage(page);
                  setPanelOnlyMode(false);
                }}
                fileName={DEFAULT_PDF_FILENAME}
              />
            </div>
          </>
        )}

        {/* Mobile & Tablet Floating AI Launcher Button (Goal 10) */}
        {!isSidebarOpen && !panelOnlyMode && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full p-3.5 shadow-xl flex items-center gap-2 transition-all duration-200 animate-in zoom-in-50 cursor-pointer"
            title="Mở Trợ lý VLearn Tutor"
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

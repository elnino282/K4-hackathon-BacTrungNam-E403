import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
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

  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [, setPageTexts] = useState<Record<number, string>>({});

  const [selectedContext, setSelectedContext] = useState<ContextSnippet | null>({
    text: "Xin chào! Mình là VLearn Tutor. Bạn có thể bôi đen một đoạn trên slide để hỏi hoặc gửi câu hỏi tự do nhé!",
    pageNumber: 1,
    slideTitle: DEFAULT_PDF_FILENAME,
  });

  // Apply dark mode class to root HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handlePDFLoaded = (numPages: number) => {
    setPdfTotalPages(numPages);
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
  };

  const handleClearContext = () => {
    setSelectedContext(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
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
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 relative">
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
              onPDFLoaded={handlePDFLoaded}
              onExtractPageText={handleExtractPageText}
            />
          </div>
        )}

        {/* Collapsible Divider Toggle Button (Matching Screenshot UI) */}
        {!panelOnlyMode && (
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-l-xl shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            style={{ right: isSidebarOpen ? "380px" : "0px" }}
            title={isSidebarOpen ? "Thu gọn VLearn Tutor" : "Mở rộng VLearn Tutor"}
          >
            {isSidebarOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Right Side: Recreated VLearn AI Tutor Panel */}
        {isSidebarOpen && (
          <div className={panelOnlyMode ? "w-full max-w-xl mx-auto border-x border-gray-200 dark:border-slate-800" : "w-[380px] shrink-0"}>
            <AITutorPanel
              currentPage={currentPage}
              selectedContext={selectedContext}
              onClearContext={handleClearContext}
              language={language}
              onSelectContext={handleSelectTextFromSlide}
            />
          </div>
        )}
      </div>
    </div>
  );
}

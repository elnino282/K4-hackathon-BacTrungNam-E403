import React, { useState, useEffect } from "react";
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

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activeTool, setActiveTool] = useState<"read" | "pen" | "highlight">("read");

  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});

  const [selectedContext, setSelectedContext] = useState<ContextSnippet | null>({
    text: "Xin chào! Mình là VLearn Tutor. Bạn có thể bôi đen hoặc nhấp dòng bất kỳ trên slide Day02.pdf để đặt câu hỏi nhé!",
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
        {/* Left Side: Document Slide Canvas (Hidden if panelOnlyMode is enabled) */}
        {!panelOnlyMode && (
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800">
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

        {/* Right Side: Recreated VLearn AI Tutor Panel */}
        <div className={panelOnlyMode ? "w-full max-w-xl mx-auto border-x border-gray-200 dark:border-slate-800" : ""}>
          <AITutorPanel
            currentPage={currentPage}
            selectedContext={selectedContext}
            onClearContext={handleClearContext}
            language={language}
            onSelectContext={handleSelectTextFromSlide}
          />
        </div>
      </div>
    </div>
  );
}

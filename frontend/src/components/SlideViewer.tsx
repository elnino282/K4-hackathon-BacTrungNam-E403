import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Highlighter, BookOpen } from "lucide-react";
import { SlideData, Language } from "../types";

interface SlideViewerProps {
  slides: SlideData[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelectText: (text: string) => void;
  language: Language;
  zoomLevel: number;
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  slides,
  currentPage,
  onPageChange,
  onSelectText,
  language,
  zoomLevel,
}) => {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [highlightedSnippet, setHighlightedSnippet] = useState<string>("");
  const slideRef = useRef<HTMLDivElement>(null);

  const currentSlide = slides.find((s) => s.pageNumber === currentPage) || slides[0];

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (slideRef.current) {
        const slideRect = slideRef.current.getBoundingClientRect();
        setTooltipPos({
          x: rect.left - slideRect.left + rect.width / 2,
          y: rect.top - slideRect.top - 42,
        });
        setHighlightedSnippet(text);
      }
    } else {
      setTooltipPos(null);
    }
  };

  const handleSendHighlightToTutor = () => {
    if (highlightedSnippet) {
      onSelectText(highlightedSnippet);
      setTooltipPos(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 md:p-8 overflow-y-auto flex flex-col items-center relative select-text transition-colors">
      {/* Slide Container Wrapper */}
      <div
        ref={slideRef}
        onMouseUp={handleMouseUp}
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
        className="w-full max-w-3xl flex flex-col gap-6 transition-transform duration-200"
      >
        {/* Floating Selection Tooltip */}
        {tooltipPos && (
          <div
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            className="absolute -translate-x-1/2 z-20 animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              onClick={handleSendHighlightToTutor}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>{language === "VI" ? "Hỏi VLearn Tutor" : "Ask VLearn Tutor"}</span>
            </button>
          </div>
        )}

        {/* Slide 1 Header Info */}
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-mono">
          <span>{language === "VI" ? `Trang ${currentPage} / 76` : `Page ${currentPage} / 76`}</span>
          <span>material_95eb786b4d9e.pdf</span>
        </div>

        {/* Main Slide Presentation Canvas Card */}
        <div className="bg-amber-50/30 dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-shadow hover:shadow-lg relative overflow-hidden">
          {/* Lined Notebook Pattern in Background */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Green Slide Graphic Container matching screenshot */}
          <div className="bg-[#789e87] text-slate-900 rounded-xl p-8 md:p-12 min-h-[360px] flex flex-col justify-between shadow-sm relative overflow-hidden group">
            {/* Soft decorative background watermark */}
            <div className="absolute -right-8 -bottom-8 opacity-10 text-white font-black text-8xl pointer-events-none select-none">
              AI
            </div>

            {/* Top Eyebrow */}
            <div className="text-xs font-bold tracking-widest text-slate-800 uppercase">
              {currentSlide.title}
            </div>

            {/* Center Headline */}
            <div className="my-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {currentSlide.subtitle}
              </h1>

              {/* Bullet / Paragraph lines */}
              <div className="mt-4 space-y-2 text-slate-800 text-sm md:text-base font-medium">
                {currentSlide.contentLines.map((line, idx) => (
                  <p
                    key={idx}
                    onClick={() => onSelectText(line)}
                    className="cursor-pointer hover:bg-emerald-600/20 px-2 py-1 rounded transition-colors"
                    title={language === "VI" ? "Nhấp để gửi đoạn này cho VLearn Tutor" : "Click to send snippet to Tutor"}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Footer Instructor info */}
            <div className="text-xs font-semibold text-slate-800 pt-4 border-t border-slate-900/10 flex items-center justify-between">
              <span>{currentSlide.instructor}</span>
              <span className="text-[10px] bg-slate-900/10 px-2 py-0.5 rounded-full">
                COMP2010
              </span>
            </div>
          </div>

          {/* Interactive hint banner */}
          <div className="mt-4 flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              {language === "VI"
                ? "Bôi đen văn bản trên slide hoặc nhấp vào dòng bất kỳ để đặt câu hỏi"
                : "Highlight text on slide or click any line to ask VLearn Tutor"}
            </span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              {language === "VI" ? "Kéo để mở ghi chú riêng" : "Drag for private notes"}
            </span>
          </div>
        </div>

        {/* Page Navigation Floating Control */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full px-4 py-2 shadow-md flex items-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[80px] text-center">
              {language === "VI" ? `Trang ${currentPage} / ${slides.length}` : `Page ${currentPage} / ${slides.length}`}
            </span>
            <button
              onClick={() => onPageChange(Math.min(slides.length, currentPage + 1))}
              disabled={currentPage === slides.length}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

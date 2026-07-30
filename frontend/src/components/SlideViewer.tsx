import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, BookOpen, FileText, Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { Language } from "../types";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "../data/mockSlides";

// Configure PDF.js worker via CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface SlideViewerProps {
  pdfUrl?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectText: (text: string) => void;
  language: Language;
  zoomLevel: number;
  fileName?: string;
  onPDFLoaded?: (numPages: number) => void;
  onExtractPageText?: (page: number, text: string) => void;
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  pdfUrl = DEFAULT_PDF_URL,
  currentPage,
  totalPages,
  onPageChange,
  onSelectText,
  language,
  zoomLevel,
  fileName = DEFAULT_PDF_FILENAME,
  onPDFLoaded,
  onExtractPageText,
}) => {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [highlightedSnippet, setHighlightedSnippet] = useState<string>("");

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [extractedLines, setExtractedLines] = useState<string[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);

  const slideRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Load PDF Document from URL when pdfUrl changes
  useEffect(() => {
    if (!pdfUrl) return;

    let isCancelled = false;
    setIsLoadingPdf(true);
    setRenderError(null);

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    loadingTask.promise
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc);
          setIsLoadingPdf(false);
          onPDFLoaded?.(doc.numPages);
        }
      })
      .catch((err) => {
        console.error("Failed to load PDF document:", err);
        if (!isCancelled) {
          setRenderError(language === "VI" ? "Không thể tải file PDF Day02.pdf" : "Failed to load PDF document.");
          setIsLoadingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // 2. Render Page onto Canvas whenever pdfDoc, currentPage, or zoomLevel changes
  useEffect(() => {
    if (!pdfDoc || currentPage < 1 || currentPage > pdfDoc.numPages) return;

    let isCancelled = false;
    setIsLoadingPdf(true);

    pdfDoc
      .getPage(currentPage)
      .then((page) => {
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: (zoomLevel / 100) * 1.4 });
        const canvas = canvasRef.current;

        if (canvas) {
          const context = canvas.getContext("2d");
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            page.render(renderContext).promise.then(() => {
              if (!isCancelled) setIsLoadingPdf(false);
            });
          }
        }

        // Extract text content for interactive reading and AI Tutor context
        page.getTextContent().then((textContent) => {
          if (isCancelled) return;

          const lines: string[] = [];
          let currentLine = "";

          textContent.items.forEach((item: any) => {
            if (item.str) {
              currentLine += item.str + " ";
              if (item.hasEOL || currentLine.length > 70) {
                const trimmed = currentLine.trim();
                if (trimmed) lines.push(trimmed);
                currentLine = "";
              }
            }
          });
          if (currentLine.trim()) lines.push(currentLine.trim());

          setExtractedLines(lines);
          const fullText = lines.join("\n");
          onExtractPageText?.(currentPage, fullText);
        });
      })
      .catch((err) => {
        console.error("Error rendering PDF page:", err);
        if (!isCancelled) setIsLoadingPdf(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoomLevel]);

  // Handle Mouse Selection for Floating "Ask VLearn Tutor" Tooltip
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
            className="absolute -translate-x-1/2 z-30 animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              onClick={handleSendHighlightToTutor}
              className="flex items-center gap-2 bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-300" />
              <span>{language === "VI" ? "Hỏi VLearn Tutor" : "Ask VLearn Tutor"}</span>
            </button>
          </div>
        )}

        {/* Slide Header Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span>
            {language === "VI"
              ? `Trang ${currentPage} / ${totalPages}`
              : `Page ${currentPage} / ${totalPages}`}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            {fileName}
          </span>
        </div>

        {/* Main Canvas / Slide Presentation Card */}
        <div className="bg-amber-50/30 dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-2xl p-6 shadow-md transition-shadow hover:shadow-lg relative overflow-hidden flex flex-col items-center">
          {/* Lined Notebook Pattern Background */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Real PDF Rendering Mode */}
          <div className="w-full flex flex-col items-center gap-4 relative z-10">
            {isLoadingPdf && (
              <div className="py-16 flex flex-col items-center justify-center gap-3 z-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {language === "VI" ? "Đang tải trang PDF Day02..." : "Rendering Day02 PDF page..."}
                </span>
              </div>
            )}

            {renderError ? (
              <div className="p-8 text-center text-rose-500 font-medium">
                {renderError}
              </div>
            ) : (
              <>
                {/* Canvas Container */}
                <div className={`rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-white ${isLoadingPdf ? "hidden" : "block"}`}>
                  <canvas ref={canvasRef} className="max-w-full h-auto block" />
                </div>

                {/* Interactive Text Lines Container */}
                {!isLoadingPdf && extractedLines.length > 0 && (
                  <div className="w-full mt-4 bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 border border-slate-200 dark:border-slate-700 backdrop-blur-xs shadow-2xs">
                    <div className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        {language === "VI"
                          ? "Nội dung slide (Nhấp dòng bất kỳ để đặt câu hỏi cho AI)"
                          : "Slide Text (Click any line to ask AI)"}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto text-xs md:text-sm text-slate-800 dark:text-slate-200">
                      {extractedLines.map((line, idx) => (
                        <p
                          key={idx}
                          onClick={() => onSelectText(line)}
                          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1.5 rounded transition-colors font-normal leading-relaxed"
                          title={language === "VI" ? "Nhấp để gửi đoạn này cho VLearn Tutor" : "Click to send snippet to Tutor"}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Interactive hint banner */}
          <div className="mt-4 w-full flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              {language === "VI"
                ? "Bôi đen văn bản trên slide hoặc nhấp vào dòng bất kỳ để đặt câu hỏi"
                : "Highlight text on slide or click any line to ask VLearn Tutor"}
            </span>
          </div>
        </div>

        {/* Page Navigation Floating Control */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full px-4 py-2 shadow-md flex items-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[80px] text-center font-mono">
              {language === "VI"
                ? `Trang ${currentPage} / ${totalPages}`
                : `Page ${currentPage} / ${totalPages}`}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

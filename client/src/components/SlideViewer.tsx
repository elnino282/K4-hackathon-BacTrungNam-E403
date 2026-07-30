import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, FileText, Loader2, RotateCcw } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Language } from "../types";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "../data/mockSlides";

// Bundle the worker locally so PDF rendering does not depend on a CDN/CORS.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface SlideViewerProps {
  pdfUrl?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectText: (text: string) => void;
  language: Language;
  zoomLevel: number;
  activeTool?: "read" | "pen" | "highlight";
  fileName?: string;
  onPDFLoaded?: (numPages: number) => void;
  onExtractPageText?: (page: number, text: string) => void;
}

interface PDFPageCardProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoomLevel: number;
  activeTool?: "read" | "pen" | "highlight";
  language: Language;
  fileName: string;
  onExtractPageText?: (page: number, text: string) => void;
}

const PDFPageCard: React.FC<PDFPageCardProps> = ({
  pdfDoc,
  pageNumber,
  zoomLevel,
  activeTool = "read",
  language,
  fileName,
  onExtractPageText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    pdfDoc
      .getPage(pageNumber)
      .then((page) => {
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: (zoomLevel / 100) * 1.35 });
        setDimensions({ width: viewport.width, height: viewport.height });

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

            page.render(renderContext).promise.then(async () => {
              if (isCancelled) return;

              // Render PDF.js Text Layer
              if (textLayerRef.current) {
                textLayerRef.current.innerHTML = "";
                textLayerRef.current.style.setProperty("--scale-factor", `${viewport.scale}`);
                try {
                  const textContent = await page.getTextContent();
                  if (!isCancelled && textLayerRef.current) {
                    const textLayer = new pdfjsLib.TextLayer({
                      textContentSource: textContent,
                      container: textLayerRef.current,
                      viewport: viewport,
                    });
                    await textLayer.render();
                  }
                } catch (err) {
                  console.error(`Error rendering text layer page ${pageNumber}:`, err);
                }
              }

              // Render PDF.js Annotation Layer
              if (annotationLayerRef.current) {
                annotationLayerRef.current.innerHTML = "";
                try {
                  const annotations = await page.getAnnotations();
                  if (!isCancelled && annotationLayerRef.current && annotations.length > 0) {
                    const annotationLayer = new pdfjsLib.AnnotationLayer({
                      div: annotationLayerRef.current,
                      page: page,
                      viewport: viewport,
                      linkService: null as any,
                      annotationCanvasMap: new Map(),
                      accessibilityManager: null,
                      annotationEditorUIManager: null,
                      structTreeLayer: null,
                      commentManager: null,
                      annotationStorage: null,
                    });
                    await annotationLayer.render({
                      viewport: viewport.clone({ dontFlip: true }),
                      div: annotationLayerRef.current,
                      annotations: annotations,
                      page: page,
                      linkService: null as any,
                      renderForms: false,
                    });
                  }
                } catch (err) {
                  console.error(`Error rendering annotation layer page ${pageNumber}:`, err);
                }
              }

              if (!isCancelled) setIsLoading(false);
            });
          }
        }

        // Extract page text for AI Tutor context
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

          onExtractPageText?.(pageNumber, lines.join("\n"));
        });
      })
      .catch((err) => {
        console.error(`Error rendering PDF page ${pageNumber}:`, err);
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, zoomLevel]);

  const isReadMode = activeTool === "read";

  return (
    <div
      data-page-number={pageNumber}
      className={`pdf-page-card w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all relative flex flex-col items-center ${
        isReadMode ? "select-text" : "select-none"
      }`}
    >
      {/* Slide Header Info */}
      <div className="w-full flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono mb-2 select-none">
        <span>{language === "VI" ? `Trang ${pageNumber}` : `Page ${pageNumber}`}</span>
        <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
          <FileText className="w-3 h-3 text-blue-500" />
          {fileName}
        </span>
      </div>

      {isLoading && (
        <div className="w-full min-h-[500px] py-16 flex flex-col items-center justify-center gap-2 select-none bg-slate-50/60 dark:bg-slate-850/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 animate-pulse">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-slate-500">
            {language === "VI" ? `Đang tải trang ${pageNumber}...` : `Loading page ${pageNumber}...`}
          </span>
        </div>
      )}

      {/* Canvas Container with TextLayer and AnnotationLayer */}
      <div
        className={`rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white relative ${
          isLoading ? "hidden" : "block"
        }`}
        style={{
          width: dimensions.width ? `${dimensions.width}px` : "auto",
          height: dimensions.height ? `${dimensions.height}px` : "auto",
        }}
      >
        <canvas ref={canvasRef} className="block" style={{ width: "100%", height: "100%" }} />

        {/* PDF.js Text Layer - active selection in read mode, user-select: none in pen/highlight modes */}
        <div
          ref={textLayerRef}
          className={`textLayer absolute inset-0 ${
            isReadMode ? "select-text pointer-events-auto" : "select-none pointer-events-none"
          }`}
          style={{
            width: dimensions.width ? `${dimensions.width}px` : "100%",
            height: dimensions.height ? `${dimensions.height}px` : "100%",
          }}
        />

        {/* PDF.js Annotation Layer */}
        <div
          ref={annotationLayerRef}
          className="annotationLayer absolute inset-0 pointer-events-auto"
          style={{
            width: dimensions.width ? `${dimensions.width}px` : "100%",
            height: dimensions.height ? `${dimensions.height}px` : "100%",
          }}
        />
      </div>
    </div>
  );
};

export const SlideViewer: React.FC<SlideViewerProps> = ({
  pdfUrl = DEFAULT_PDF_URL,
  currentPage,
  totalPages,
  onPageChange,
  onSelectText,
  language,
  zoomLevel,
  activeTool = "read",
  fileName = DEFAULT_PDF_FILENAME,
  onPDFLoaded,
  onExtractPageText,
}) => {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [highlightedSnippet, setHighlightedSnippet] = useState<string>("");

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load PDF Document from URL when pdfUrl or reloadToken changes
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
          setRenderError(language === "VI" ? "Không thể tải file PDF. Vui lòng kiểm tra kết nối mạng." : "Failed to load PDF document. Please check your network connection.");
          setIsLoadingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl, reloadToken]);

  // 2. IntersectionObserver to update currentPage state as user scrolls down
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !pdfDoc) return;

    const pageElements = container.querySelectorAll(".pdf-page-card");
    if (pageElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        });

        if (bestEntry && (bestEntry as IntersectionObserverEntry).target) {
          const pageAttr = (bestEntry as IntersectionObserverEntry).target.getAttribute("data-page-number");
          if (pageAttr) {
            const pageNum = parseInt(pageAttr, 10);
            if (!isNaN(pageNum) && pageNum !== currentPage) {
              onPageChange(pageNum);
            }
          }
        }
      },
      {
        root: container,
        threshold: [0.2, 0.5, 0.8],
      }
    );

    pageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [pdfDoc, totalPages]);

  // Handle Mouse Selection for Floating "Ask VLearn Tutor" Tooltip
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (scrollContainerRef.current) {
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 42,
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

  const handleNavigatePage = (targetPage: number) => {
    const validPage = Math.max(1, Math.min(totalPages, targetPage));
    onPageChange(validPage);
    const pageEl = scrollContainerRef.current?.querySelector(`[data-page-number="${validPage}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const pageNumbers = Array.from({ length: totalPages > 0 ? totalPages : 1 }, (_, i) => i + 1);

  return (
    <div
      ref={scrollContainerRef}
      onMouseUp={handleMouseUp}
      className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 md:p-8 overflow-y-auto flex flex-col items-center relative select-text transition-colors"
    >
      {/* Floating Selection Tooltip */}
      {tooltipPos && (
        <div
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          className="absolute -translate-x-1/2 z-30 animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            onClick={handleSendHighlightToTutor}
            aria-label={language === "VI" ? "Hỏi VLearn Tutor về đoạn văn đã chọn" : "Ask VLearn Tutor about selected text"}
            className="flex items-center gap-2 bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-300" />
            <span>{language === "VI" ? "Hỏi VLearn Tutor" : "Ask VLearn Tutor"}</span>
          </button>
        </div>
      )}

      {/* Main Continuous Scroll PDF List */}
      <div
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
        className="w-full flex flex-col items-center gap-6 transition-transform duration-200 pb-20"
      >
        {isLoadingPdf && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {language === "VI" ? "Đang tải file PDF..." : "Loading PDF document..."}
            </span>
          </div>
        )}

        {renderError && (
          <div className="p-8 text-center text-rose-600 dark:text-rose-400 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-lg flex flex-col items-center gap-4 max-w-md my-10 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <p className="text-sm leading-relaxed">{renderError}</p>
            <button
              onClick={() => setReloadToken((prev) => prev + 1)}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{language === "VI" ? "Thử lại" : "Retry"}</span>
            </button>
          </div>
        )}

        {!isLoadingPdf &&
          pdfDoc &&
          pageNumbers.map((pageNum) => (
            <PDFPageCard
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              zoomLevel={zoomLevel}
              activeTool={activeTool}
              language={language}
              fileName={fileName}
              onExtractPageText={onExtractPageText}
            />
          ))}
      </div>

      {/* Floating Bottom Navigation Bar with WCAG AA Touch Targets */}
      {!isLoadingPdf && totalPages > 0 && (
        <div className="fixed bottom-6 z-20 flex items-center justify-center">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-full px-4 py-1.5 shadow-xl flex items-center gap-3">
            <button
              onClick={() => handleNavigatePage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={language === "VI" ? "Trang trước" : "Previous Page"}
              className="p-2.5 md:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === "VI" ? "Trang trước" : "Previous Page"}
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[90px] text-center font-mono">
              {language === "VI"
                ? `Trang ${currentPage} / ${totalPages}`
                : `Page ${currentPage} / ${totalPages}`}
            </span>
            <button
              onClick={() => handleNavigatePage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label={language === "VI" ? "Trang tiếp theo" : "Next Page"}
              className="p-2.5 md:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === "VI" ? "Trang tiếp theo" : "Next Page"}
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

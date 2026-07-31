import React, { useState, useRef, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, FileText, Loader2, RotateCcw } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { findEvidenceSpanRange } from "../lib/evidenceNavigation";
import { getMostVisiblePage } from "../lib/visiblePage";
import {
  EvidenceNavigationTarget,
  Language,
  NoteSelection,
  SavedNoteRegion,
} from "../types";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "../data/mockSlides";

// Bundle the worker locally so PDF rendering does not depend on a CDN/CORS.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface SlideViewerProps {
  pdfUrl?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectText: (text: string, pageNumber: number) => void;
  language: Language;
  zoomLevel: number;
  activeTool?: "read" | "pen" | "highlight";
  fileName?: string;
  onPDFLoaded?: (numPages: number) => void;
  onExtractPageText?: (page: number, text: string) => void;
  navigationTarget?: EvidenceNavigationTarget | null;
  noteSelections?: NoteSelection[];
  savedNoteRegions?: SavedNoteRegion[];
  focusedNoteId?: string | null;
  onAddNoteSelection?: (selection: NoteSelection) => void;
  onRemoveNoteSelection?: (selectionId: string) => void;
  onOpenSavedNote?: (noteId: string) => void;
  onRemoveSavedNoteRegion?: (
    noteId: string,
    regionIndex: number,
  ) => void;
}

interface PDFPageCardProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoomLevel: number;
  activeTool?: "read" | "pen" | "highlight";
  language: Language;
  fileName: string;
  onExtractPageText?: (page: number, text: string) => void;
  evidenceTarget?: EvidenceNavigationTarget;
  noteSelections: NoteSelection[];
  savedNoteRegions: SavedNoteRegion[];
  focusedNoteId?: string | null;
  onAddNoteSelection?: (selection: NoteSelection) => void;
  onRemoveNoteSelection?: (selectionId: string) => void;
  onOpenSavedNote?: (noteId: string) => void;
  onRemoveSavedNoteRegion?: (
    noteId: string,
    regionIndex: number,
  ) => void;
}

const PDFPageCard: React.FC<PDFPageCardProps> = ({
  pdfDoc,
  pageNumber,
  zoomLevel,
  activeTool = "read",
  language,
  fileName,
  onExtractPageText,
  evidenceTarget,
  noteSelections,
  savedNoteRegions,
  focusedNoteId,
  onAddNoteSelection,
  onRemoveNoteSelection,
  onOpenSavedNote,
  onRemoveSavedNoteRegion,
}) => {
  const pageCardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const annotationLayerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [textLayerVersion, setTextLayerVersion] = useState<number>(0);
  const [evidenceFound, setEvidenceFound] = useState<boolean>(false);
  const [shouldRenderPage, setShouldRenderPage] = useState<boolean>(
    pageNumber <= 2,
  );
  const [draftSelection, setDraftSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  useEffect(() => {
    if (shouldRenderPage) return;
    const card = pageCardRef.current;
    if (!card || typeof IntersectionObserver === "undefined") {
      setShouldRenderPage(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderPage(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "900px 0px",
        threshold: 0.01,
      },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [shouldRenderPage]);

  useEffect(() => {
    if (evidenceTarget) setShouldRenderPage(true);
  }, [evidenceTarget?.requestId]);

  useEffect(() => {
    if (!shouldRenderPage) return;
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
                    if (!isCancelled) {
                      setTextLayerVersion((version) => version + 1);
                    }
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
  }, [pdfDoc, pageNumber, zoomLevel, shouldRenderPage]);

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container) return;

    const spans = Array.from(
      container.querySelectorAll("span"),
    ) as HTMLSpanElement[];
    spans.forEach((span) => (
      span.classList.remove("evidence-source-highlight")
    ));
    setEvidenceFound(false);

    if (!evidenceTarget?.evidenceQuote || spans.length === 0) return;
    const range = findEvidenceSpanRange(
      spans.map((span) => span.textContent ?? ""),
      evidenceTarget.evidenceQuote,
    );
    if (!range) return;

    for (
      let index = range.startIndex;
      index <= range.endIndex;
      index += 1
    ) {
      spans[index]?.classList.add("evidence-source-highlight");
    }
    setEvidenceFound(true);

    const clearHighlight = window.setTimeout(() => {
      spans.forEach((span) => (
        span.classList.remove("evidence-source-highlight")
      ));
      setEvidenceFound(false);
    }, 8000);

    return () => {
      window.clearTimeout(clearHighlight);
      spans.forEach((span) => (
        span.classList.remove("evidence-source-highlight")
      ));
    };
  }, [
    evidenceTarget?.requestId,
    evidenceTarget?.evidenceQuote,
    textLayerVersion,
  ]);

  const isReadMode = activeTool === "read";
  const isNotePenMode = activeTool === "pen";

  const selectionBounds = draftSelection
    ? {
        x: Math.min(draftSelection.startX, draftSelection.currentX),
        y: Math.min(draftSelection.startY, draftSelection.currentY),
        width: Math.abs(draftSelection.currentX - draftSelection.startX),
        height: Math.abs(draftSelection.currentY - draftSelection.startY),
      }
    : null;

  const pointerPosition = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      rect,
    };
  };

  const handleSelectionPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isNotePenMode) return;
    const point = pointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftSelection({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handleSelectionPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isNotePenMode || !draftSelection) return;
    const point = pointerPosition(event);
    setDraftSelection((current) => current && ({
      ...current,
      currentX: point.x,
      currentY: point.y,
    }));
  };

  const handleSelectionPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isNotePenMode || !draftSelection) return;
    const endPoint = pointerPosition(event);
    const overlayRect = endPoint.rect;
    const finalBounds = {
      x: Math.min(draftSelection.startX, endPoint.x),
      y: Math.min(draftSelection.startY, endPoint.y),
      width: Math.abs(endPoint.x - draftSelection.startX),
      height: Math.abs(endPoint.y - draftSelection.startY),
    };
    setDraftSelection(null);
    if (finalBounds.width < 12 || finalBounds.height < 12) return;

    const textSpans = Array.from(
      textLayerRef.current?.querySelectorAll("span") ?? [],
    ) as HTMLSpanElement[];
    const selectedText = textSpans
      .filter((span) => {
        const spanRect = span.getBoundingClientRect();
        const overlapX = Math.max(
          0,
          Math.min(
            overlayRect.left + finalBounds.x + finalBounds.width,
            spanRect.right,
          ) - Math.max(overlayRect.left + finalBounds.x, spanRect.left),
        );
        const overlapY = Math.max(
          0,
          Math.min(
            overlayRect.top + finalBounds.y + finalBounds.height,
            spanRect.bottom,
          ) - Math.max(overlayRect.top + finalBounds.y, spanRect.top),
        );
        return overlapX > 0 && overlapY > 0;
      })
      .map((span) => span.textContent?.trim())
      .filter(Boolean)
      .join(" ");

    let imageDataUrl: string | undefined;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const scaleX = canvas.width / overlayRect.width;
        const scaleY = canvas.height / overlayRect.height;
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = Math.max(
          1,
          Math.round(finalBounds.width * scaleX),
        );
        cropCanvas.height = Math.max(
          1,
          Math.round(finalBounds.height * scaleY),
        );
        const cropContext = cropCanvas.getContext("2d");
        cropContext?.drawImage(
          canvas,
          finalBounds.x * scaleX,
          finalBounds.y * scaleY,
          finalBounds.width * scaleX,
          finalBounds.height * scaleY,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );
        imageDataUrl = cropCanvas.toDataURL("image/jpeg", 0.82);
      } catch (error) {
        console.warn("Không tạo được ảnh vùng khoanh:", error);
      }
    }

    onAddNoteSelection?.({
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      pageNumber,
      text: selectedText,
      kind: "rectangle",
      bounds: {
        x: finalBounds.x / overlayRect.width,
        y: finalBounds.y / overlayRect.height,
        width: finalBounds.width / overlayRect.width,
        height: finalBounds.height / overlayRect.height,
      },
      imageDataUrl,
    });
  };

  return (
    <div
      ref={pageCardRef}
      data-page-number={pageNumber}
      className={`pdf-page-card w-full max-w-3xl bg-white dark:bg-slate-900 border rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all relative flex flex-col items-center ${
        evidenceTarget
          ? "border-blue-500 ring-4 ring-blue-200/70 dark:ring-blue-900/60"
          : "border-slate-200 dark:border-slate-800"
      } ${
        isReadMode ? "select-text" : "select-none"
      }`}
      style={
        shouldRenderPage
          ? undefined
          : {
              minHeight: `${Math.round(700 * (zoomLevel / 100))}px`,
            }
      }
    >
      {/* Slide Header Info */}
      <div className="w-full flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono mb-2 select-none">
        <span>{language === "VI" ? `Trang ${pageNumber}` : `Page ${pageNumber}`}</span>
        <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
          <FileText className="w-3 h-3 text-blue-500" />
          {fileName}
        </span>
      </div>

      {evidenceTarget && (
        <div
          className={`mb-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold ${
            evidenceFound
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          }`}
        >
          {language === "VI"
            ? evidenceFound
              ? "Đã làm nổi đoạn nguồn của ý đang kiểm tra."
              : "Đã mở đúng trang nguồn; đoạn chữ đang được đối chiếu."
            : evidenceFound
              ? "The source passage is highlighted."
              : "The source page is open; matching the passage."}
        </div>
      )}

      {!shouldRenderPage && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 select-none">
          <div className="h-2 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-medium text-slate-400">
            {language === "VI"
              ? `Trang ${pageNumber} sẽ tải khi bạn cuộn tới`
              : `Page ${pageNumber} will load as you approach`}
          </span>
        </div>
      )}

      {isLoading && shouldRenderPage && (
        <div className="py-16 flex flex-col items-center justify-center gap-2 select-none">
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
          className={`annotationLayer absolute inset-0 ${
            isNotePenMode ? "pointer-events-none" : "pointer-events-auto"
          }`}
          style={{
            width: dimensions.width ? `${dimensions.width}px` : "100%",
            height: dimensions.height ? `${dimensions.height}px` : "100%",
          }}
        />

        <div className="pointer-events-none absolute inset-0 z-20">
          {savedNoteRegions.map((region) => {
            const isFocused = focusedNoteId === region.noteId;
            return (
              <div
                key={`${region.noteId}-${region.regionIndex}`}
                className={`pointer-events-none absolute rounded-md border-2 transition-all ${
                  isFocused
                    ? "border-fuchsia-600 bg-fuchsia-300/25 ring-4 ring-fuchsia-300/45"
                    : "border-fuchsia-400/70 bg-fuchsia-200/10"
                }`}
                style={{
                  left: `${region.bounds.x * 100}%`,
                  top: `${region.bounds.y * 100}%`,
                  width: `${region.bounds.width * 100}%`,
                  height: `${region.bounds.height * 100}%`,
                }}
                title={region.noteTitle}
              >
                <button
                  type="button"
                  onClick={() => onOpenSavedNote?.(region.noteId)}
                  className={`pointer-events-auto absolute -top-3 -left-3 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[9px] font-bold text-white shadow-md transition-transform hover:scale-110 ${
                    isFocused ? "bg-fuchsia-700" : "bg-fuchsia-500"
                  }`}
                  aria-label={
                    language === "VI"
                      ? `Mở ghi chú ${region.noteTitle}`
                      : `Open note ${region.noteTitle}`
                  }
                >
                  <BookOpen className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveSavedNoteRegion?.(
                      region.noteId,
                      region.regionIndex,
                    );
                  }}
                  className="pointer-events-auto absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-xs font-black text-rose-600 shadow-md transition-transform hover:scale-110 hover:bg-rose-50"
                  aria-label={
                    language === "VI"
                      ? `Xóa vùng của ghi chú ${region.noteTitle} khỏi PDF`
                      : `Remove ${region.noteTitle} region from PDF`
                  }
                  title={
                    language === "VI"
                      ? "Xóa vùng khỏi PDF, vẫn giữ nội dung note"
                      : "Remove marker from PDF and keep the note"
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div
          className={`absolute inset-0 z-30 touch-none ${
            isNotePenMode
              ? "cursor-crosshair pointer-events-auto"
              : "pointer-events-none"
          }`}
          onPointerDown={handleSelectionPointerDown}
          onPointerMove={handleSelectionPointerMove}
          onPointerUp={handleSelectionPointerUp}
        >
          {noteSelections.map((selection, index) => (
            selection.bounds && (
              <div
                key={selection.id}
                className="absolute rounded-md border-2 border-fuchsia-500 bg-fuchsia-300/20 shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                style={{
                  left: `${selection.bounds.x * 100}%`,
                  top: `${selection.bounds.y * 100}%`,
                  width: `${selection.bounds.width * 100}%`,
                  height: `${selection.bounds.height * 100}%`,
                }}
              >
                <span className="absolute -top-3 -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white shadow">
                  {index + 1}
                </span>
                {isNotePenMode && (
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveNoteSelection?.(selection.id);
                    }}
                    className="pointer-events-auto absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-rose-600 shadow"
                    title={language === "VI" ? "Bỏ vùng này" : "Remove region"}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          ))}
          {selectionBounds && (
            <div
              className="absolute rounded-md border-2 border-dashed border-fuchsia-600 bg-fuchsia-300/15"
              style={{
                left: selectionBounds.x,
                top: selectionBounds.y,
                width: selectionBounds.width,
                height: selectionBounds.height,
              }}
            />
          )}
        </div>
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
  navigationTarget,
  noteSelections = [],
  savedNoteRegions = [],
  focusedNoteId,
  onAddNoteSelection,
  onRemoveNoteSelection,
  onOpenSavedNote,
  onRemoveSavedNoteRegion,
}) => {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [highlightedSnippet, setHighlightedSnippet] = useState<string>("");
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);

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

  // 2. The active page is whichever card occupies most of the visible reader.
  // IntersectionObserver callbacks only contain changed entries, which made the
  // old implementation lag one page behind during continuous scrolling.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !pdfDoc) return;

    let animationFrame: number | null = null;
    const updateCurrentPage = () => {
      animationFrame = null;
      const containerRect = container.getBoundingClientRect();
      const pageElements = container.querySelectorAll(
        ".pdf-page-card",
      ) as NodeListOf<HTMLElement>;
      const pages = (Array.from(pageElements) as HTMLElement[]).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          pageNumber: Number(element.dataset.pageNumber),
          top: rect.top,
          bottom: rect.bottom,
        };
      }).filter((page) => Number.isInteger(page.pageNumber));
      const visiblePage = getMostVisiblePage(
        containerRect.top,
        containerRect.bottom,
        pages,
      );
      if (visiblePage !== null) onPageChange(visiblePage);
    };
    const scheduleUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(updateCurrentPage);
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(container);
    container.querySelectorAll(".pdf-page-card").forEach((element) => {
      resizeObserver?.observe(element);
    });
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [pdfDoc, totalPages, zoomLevel, onPageChange]);

  useEffect(() => {
    if (!navigationTarget || !pdfDoc) return;
    const validPage = Math.max(
      1,
      Math.min(totalPages, navigationTarget.pageNumber),
    );
    onPageChange(validPage);

    const animationFrame = window.requestAnimationFrame(() => {
      const pageElement = scrollContainerRef.current?.querySelector(
        `[data-page-number="${validPage}"]`,
      );
      pageElement?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [navigationTarget?.requestId, pdfDoc, totalPages]);

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
        const pageCard = (
          range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer as Element
            : range.commonAncestorContainer.parentElement
        )?.closest<HTMLElement>(".pdf-page-card");
        const selectedPage = Number(pageCard?.dataset.pageNumber);
        setHighlightedPage(
          Number.isInteger(selectedPage) ? selectedPage : currentPage,
        );
      }
    } else {
      setTooltipPos(null);
      setHighlightedPage(null);
    }
  };

  const handleSendHighlightToTutor = () => {
    if (highlightedSnippet) {
      onSelectText(highlightedSnippet, highlightedPage ?? currentPage);
      setTooltipPos(null);
      setHighlightedPage(null);
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
          <div
            role="alert"
            aria-live="assertive"
            className="p-8 text-center text-rose-600 dark:text-rose-400 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-lg flex flex-col items-center gap-4 max-w-md my-10 animate-in fade-in zoom-in-95"
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <p className="text-sm leading-relaxed">{renderError}</p>
            <button
              onClick={() => setReloadToken((prev) => prev + 1)}
              aria-label={language === "VI" ? "Thử lại tải tài liệu PDF" : "Retry loading PDF document"}
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
              evidenceTarget={
                navigationTarget?.pageNumber === pageNum
                  ? navigationTarget
                  : undefined
              }
              noteSelections={noteSelections.filter(
                (selection) => selection.pageNumber === pageNum,
              )}
              savedNoteRegions={savedNoteRegions.filter(
                (region) => region.pageNumber === pageNum,
              )}
              focusedNoteId={focusedNoteId}
              onAddNoteSelection={onAddNoteSelection}
              onRemoveNoteSelection={onRemoveNoteSelection}
              onOpenSavedNote={onOpenSavedNote}
              onRemoveSavedNoteRegion={onRemoveSavedNoteRegion}
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
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[90px] text-center font-mono"
            >
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

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  Loader2,
  Minus,
  Navigation,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Language } from "../types";

interface DocumentToolbarProps {
  activeTool: "read" | "pen" | "highlight";
  onSelectTool: (tool: "read" | "pen" | "highlight") => void;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  language: Language;
  notesCount: number;
  fileName?: string;
  onPageChange?: (page: number) => void;
  selectionCount?: number;
  isGeneratingNote?: boolean;
  onCreateAINote?: () => void;
  onClearSelections?: () => void;
  onOpenNotes?: () => void;
  showSavedNoteRegions?: boolean;
  onToggleSavedNoteRegions?: () => void;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  activeTool,
  onSelectTool,
  currentPage,
  totalPages,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  language,
  notesCount,
  fileName = "Day02.pdf",
  onPageChange,
  selectionCount = 0,
  isGeneratingNote = false,
  onCreateAINote,
  onClearSelections,
  onOpenNotes,
  showSavedNoteRegions = true,
  onToggleSavedNoteRegions,
}) => {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [inputPageVal, setInputPageVal] = useState(currentPage.toString());

  useEffect(() => {
    setInputPageVal(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(inputPageVal, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange?.(pageNum);
      // Smooth scroll to page element if present
      const pageEl = document.querySelector(`[data-page-number="${pageNum}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      setInputPageVal(currentPage.toString());
    }
    setIsEditingPage(false);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs font-medium select-none shadow-2xs">
      {/* Left tool selector & PDF document info */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-2xs">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="truncate text-xs font-mono">{fileName}</span>
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-slate-700 mx-1" />

        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs" role="toolbar" aria-label={language === "VI" ? "Công cụ tương tác" : "Interactive tools"}>
          <button
            onClick={() => onSelectTool("read")}
            aria-pressed={activeTool === "read"}
            title={language === "VI" ? "Chế độ Đọc" : "Read Mode"}
            aria-label={language === "VI" ? "Chế độ Đọc" : "Read Mode"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTool === "read"
                ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Navigation className="w-3.5 h-3.5 rotate-45" />
            <span>{language === "VI" ? "Đọc" : "Read"}</span>
          </button>

          <button
            onClick={() => onSelectTool("pen")}
            aria-pressed={activeTool === "pen"}
            title={language === "VI" ? "Chế độ Bút" : "Pen Mode"}
            aria-label={language === "VI" ? "Chế độ Bút" : "Pen Mode"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTool === "pen"
                ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === "VI" ? "Bút AI" : "AI Pen"}</span>
          </button>

          <button
            onClick={() => onSelectTool("highlight")}
            aria-pressed={activeTool === "highlight"}
            title={language === "VI" ? "Chế độ Highlight" : "Highlight Mode"}
            aria-label={language === "VI" ? "Chế độ Highlight" : "Highlight Mode"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTool === "highlight"
                ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>{language === "VI" ? "Highlight" : "Highlight"}</span>
          </button>
        </div>
      </div>

      {selectionCount > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-1 dark:border-fuchsia-900 dark:bg-fuchsia-950/40">
          <span className="px-2 text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">
            {language === "VI"
              ? `${selectionCount} vùng đã khoanh`
              : `${selectionCount} selected`}
          </span>
          <button
            type="button"
            onClick={onCreateAINote}
            disabled={isGeneratingNote}
            aria-label={language === "VI" ? "Tạo AI Note" : "Create AI Note"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-fuchsia-700 disabled:cursor-wait disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
          >
            {isGeneratingNote ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {language === "VI" ? "Tạo AI Note" : "Create AI Note"}
          </button>
          <button
            type="button"
            onClick={onClearSelections}
            disabled={isGeneratingNote}
            aria-label={language === "VI" ? "Bỏ tất cả vùng chọn" : "Clear all selections"}
            className="rounded-lg p-1.5 text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-50 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
            title={language === "VI" ? "Bỏ tất cả vùng chọn" : "Clear all selections"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Middle: Interactive Direct Page Jump & Note Counter */}
      <div className="flex items-center gap-2">
        {isEditingPage ? (
          <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
            <div className="flex items-center bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-blue-500 shadow-2xs font-mono">
              <span className="text-slate-400 dark:text-slate-500 mr-1 text-xs">{language === "VI" ? "Trang" : "Page"}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={inputPageVal}
                onChange={(e) => setInputPageVal(e.target.value)}
                onBlur={handlePageSubmit}
                autoFocus
                aria-label={language === "VI" ? "Nhập số trang" : "Type page number"}
                className="w-12 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-transparent focus:outline-none"
              />
              <span className="text-slate-400 dark:text-slate-500 text-xs">/{totalPages}</span>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onOpenNotes) {
                onOpenNotes();
              } else {
                setIsEditingPage(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (e.shiftKey) {
                  e.preventDefault();
                  setIsEditingPage(true);
                }
              }
            }}
            onDoubleClick={() => setIsEditingPage(true)}
            title={language === "VI" ? "Nhấp để mở kho note, nhấp Shift+Enter/nhấp kép để nhập số trang" : "Click to open notes, Shift+Enter or double-click to jump page"}
            aria-label={
              language === "VI"
                ? `Trang ${currentPage} trên ${totalPages}, ${notesCount} note. Nhấn Shift+Enter để chuyển trang.`
                : `Page ${currentPage} of ${totalPages}, ${notesCount} notes. Press Shift+Enter to jump page.`
            }
            className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 font-medium shadow-2xs font-mono hover:bg-blue-50/50 dark:hover:bg-slate-800/80 transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              {language === "VI"
                ? `Trang ${currentPage}/${totalPages} · ${notesCount} note`
                : `Page ${currentPage}/${totalPages} · ${notesCount} notes`}
            </span>
          </button>
        )}

        {notesCount > 0 && (
          <button
            type="button"
            onClick={onToggleSavedNoteRegions}
            aria-pressed={showSavedNoteRegions}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 ${
              showSavedNoteRegions
                ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/30 dark:text-fuchsia-300"
                : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
            title={
              language === "VI"
                ? (
                    showSavedNoteRegions
                      ? "Ẩn tất cả vùng AI Note trên PDF"
                      : "Hiện lại các vùng AI Note trên PDF"
                  )
                : (
                    showSavedNoteRegions
                      ? "Hide all AI Note regions"
                      : "Show AI Note regions"
                  )
            }
            aria-label={
              language === "VI"
                ? (
                    showSavedNoteRegions
                      ? "Ẩn tất cả vùng AI Note trên PDF"
                      : "Hiện lại các vùng AI Note trên PDF"
                  )
                : (
                    showSavedNoteRegions
                      ? "Hide all AI Note regions"
                      : "Show AI Note regions"
                  )
            }
          >
            {showSavedNoteRegions ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {language === "VI"
              ? (
                  showSavedNoteRegions
                    ? "Ẩn vùng note"
                    : "Hiện vùng note"
                )
              : (
                  showSavedNoteRegions
                    ? "Hide markers"
                    : "Show markers"
                )}
          </button>
        )}

        {/* Zoom controls with full ARIA support */}
        <div
          role="group"
          aria-label={language === "VI" ? "Thu phóng tài liệu" : "Document zoom controls"}
          aria-valuenow={zoomLevel}
          aria-valuemin={70}
          aria-valuemax={180}
          className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs"
        >
          <button
            onClick={onZoomOut}
            disabled={zoomLevel <= 70}
            aria-disabled={zoomLevel <= 70}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-r border-gray-200 dark:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-lg transition-colors"
            title={
              zoomLevel <= 70
                ? language === "VI"
                  ? "Đã đạt mức thu nhỏ tối đa (70%)"
                  : "Minimum zoom level reached (70%)"
                : language === "VI"
                  ? "Thu nhỏ"
                  : "Zoom Out"
            }
            aria-label={
              zoomLevel <= 70
                ? language === "VI"
                  ? "Đã đạt mức thu nhỏ tối đa (70%)"
                  : "Minimum zoom level reached (70%)"
                : language === "VI"
                  ? "Thu nhỏ"
                  : "Zoom Out"
            }
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 py-1 text-slate-700 dark:text-slate-300 min-w-[50px] text-center font-mono">
            {zoomLevel}%
          </span>
          <button
            onClick={onZoomIn}
            disabled={zoomLevel >= 180}
            aria-disabled={zoomLevel >= 180}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-l border-gray-200 dark:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-lg transition-colors"
            title={
              zoomLevel >= 180
                ? language === "VI"
                  ? "Đã đạt mức phóng to tối đa (180%)"
                  : "Maximum zoom level reached (180%)"
                : language === "VI"
                  ? "Phóng to"
                  : "Zoom In"
            }
            aria-label={
              zoomLevel >= 180
                ? language === "VI"
                  ? "Đã đạt mức phóng to tối đa (180%)"
                  : "Maximum zoom level reached (180%)"
                : language === "VI"
                  ? "Phóng to"
                  : "Zoom In"
            }
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right action icons */}
      <div className="hidden lg:flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400">
        <button
          aria-label={language === "VI" ? "Tải xuống tài liệu" : "Download document"}
          title={language === "VI" ? "Tải xuống tài liệu" : "Download document"}
          className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          aria-label={language === "VI" ? "In tài liệu" : "Print document"}
          title={language === "VI" ? "In tài liệu" : "Print document"}
          className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          <Printer className="w-4 h-4" />
        </button>
        <button
          aria-label={language === "VI" ? "Hoàn tác" : "Undo"}
          title={language === "VI" ? "Hoàn tác" : "Undo"}
          className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          aria-label={language === "VI" ? "Xóa ghi chú" : "Delete notes"}
          title={language === "VI" ? "Xóa ghi chú" : "Delete notes"}
          className="p-1.5 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};



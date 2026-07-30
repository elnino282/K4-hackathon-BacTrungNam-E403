import React, { useState, useEffect } from "react";
import { Navigation, Edit2, Highlighter, Plus, Minus, Download, Printer, Undo2, Trash2, FileText } from "lucide-react";
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
            <span>{language === "VI" ? "Bút" : "Pen"}</span>
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

      {/* Middle: Interactive Direct Page Jump Counter Pill */}
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
            onClick={() => setIsEditingPage(true)}
            title={language === "VI" ? "Nhấp hoặc nhấn Enter để nhảy nhanh đến trang" : "Click or press Enter to jump to page"}
            aria-label={
              language === "VI"
                ? `Trang ${currentPage} trên ${totalPages}, nhấp để nhảy trang`
                : `Page ${currentPage} of ${totalPages}, click to jump to page`
            }
            className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 font-medium shadow-2xs font-mono hover:bg-blue-50/50 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {language === "VI"
              ? `Trang ${currentPage}/${totalPages} · ${notesCount} note`
              : `Page ${currentPage}/${totalPages} · ${notesCount} notes`}
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
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-r border-gray-200 dark:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-lg transition-colors"
            title={language === "VI" ? "Thu nhỏ" : "Zoom Out"}
            aria-label={language === "VI" ? "Thu nhỏ" : "Zoom Out"}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 py-1 text-slate-700 dark:text-slate-300 min-w-[50px] text-center font-mono">
            {zoomLevel}%
          </span>
          <button
            onClick={onZoomIn}
            disabled={zoomLevel >= 180}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-l border-gray-200 dark:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-lg transition-colors"
            title={language === "VI" ? "Phóng to" : "Zoom In"}
            aria-label={language === "VI" ? "Phóng to" : "Zoom In"}
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



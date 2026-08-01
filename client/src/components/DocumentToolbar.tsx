import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  Loader2,
  Minus,
  MoreHorizontal,
  GitBranch,
  Navigation,
  NotebookPen,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Undo2,
  Brain,
  Check,
} from "lucide-react";
import { Language } from "../types";
import { MindMapDepth, MindMapScope } from "../lib/mindMap";
import { MindMapPopover } from "./MindMapPopover";

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
  /** Called to toggle the Notes panel open/closed */
  onOpenNotes?: () => void;
  /** Whether the Notes panel is currently open — drives active state on the button */
  isNotesOpen?: boolean;
  onOpenMindMap?: () => void;
  isMindMapOpen?: boolean;
  showSavedNoteRegions?: boolean;
  onToggleSavedNoteRegions?: () => void;
  onUndo?: () => void;
  onDeleteNotes?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;

  // New Mind Map non-blocking workflow props
  mindMapStatus?: "idle" | "generating" | "ready" | "error";
  mindMapProgress?: number;
  mindMapReadPages?: number;
  mindMapTotalPages?: number;
  mindMapStepText?: string;
  mindMapScope?: MindMapScope;
  onSetMindMapScope?: (scope: MindMapScope) => void;
  mindMapStartPage?: number;
  onSetMindMapStartPage?: (page: number) => void;
  mindMapEndPage?: number;
  onSetMindMapEndPage?: (page: number) => void;
  mindMapDepth?: MindMapDepth;
  onSetMindMapDepth?: (depth: MindMapDepth) => void;
  onStartMindMapGeneration?: () => void;
  onToggleMindMapDrawer?: () => void;
  isMindMapDrawerOpen?: boolean;
  onToggleFloatingProgress?: () => void;
  justCompletedFlash?: boolean;
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
  isNotesOpen = false,
  onOpenMindMap,
  isMindMapOpen = false,
  showSavedNoteRegions = true,
  onToggleSavedNoteRegions,
  onUndo,
  onDeleteNotes,
  onDownload,
  onPrint,
  mindMapStatus = "idle",
  mindMapProgress = 0,
  mindMapReadPages = 0,
  mindMapTotalPages = 44,
  mindMapStepText = "",
  mindMapScope = "whole_lecture",
  onSetMindMapScope,
  mindMapStartPage = 1,
  onSetMindMapStartPage,
  mindMapEndPage = 44,
  onSetMindMapEndPage,
  mindMapDepth = "normal",
  onSetMindMapDepth,
  onStartMindMapGeneration,
  onToggleMindMapDrawer,
  isMindMapDrawerOpen = false,
  onToggleFloatingProgress,
  justCompletedFlash = false,
}) => {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [inputPageVal, setInputPageVal] = useState(currentPage.toString());
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMindMapPopoverOpen, setIsMindMapPopoverOpen] = useState(false);
  const [showConfigForced, setShowConfigForced] = useState(false);
  const [isMindMapHovering, setIsMindMapHovering] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const mindMapBtnRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputPageVal(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    if (isEditingPage) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingPage]);

  // Handle clicking outside of More dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle ESC key for dropdown & page input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
        if (isEditingPage) {
          setIsEditingPage(false);
          setInputPageVal(currentPage.toString());
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditingPage, currentPage]);

  const handlePageSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pageNum = parseInt(inputPageVal, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange?.(pageNum);
      const pageEl = document.querySelector(`[data-page-number="${pageNum}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      setInputPageVal(currentPage.toString());
    }
    setIsEditingPage(false);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      onPageChange?.(prev);
      const pageEl = document.querySelector(`[data-page-number="${prev}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      onPageChange?.(next);
      const pageEl = document.querySelector(`[data-page-number="${next}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      window.print();
    }
    setIsMoreOpen(false);
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
    setIsMoreOpen(false);
  };

  // ─── Shared class fragments ────────────────────────────────────────────────
  // Tool button base — used for Read / AI Pen / Highlight
  const toolBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      active
        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 shadow-sm"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60"
    }`;

  // Thin separator
  const Divider = () => (
    <div className="self-stretch w-px bg-slate-200 dark:bg-slate-700 my-2" aria-hidden="true" />
  );

  return (
    // Outer row: full-width, centers the floating card horizontally
    <div className="relative w-full flex flex-col items-center">
      {/* ══ Floating toolbar card ══════════════════════════════════════════════
          - fit-content width, max ~960px, centered
          - single rounded card with shadow — not a full-bleed bar
          - border-b kept on the outer container so the layout doesn't jump
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="w-full border-b border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-center px-3 py-2 transition-colors">
        <div
          className="inline-flex items-center gap-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-md h-11 px-1 select-none text-xs font-medium overflow-visible"
          role="toolbar"
          aria-label={language === "VI" ? "Thanh công cụ tài liệu" : "Document toolbar"}
        >
          {/* ── Group 1: Primary Tools ─── Read / AI Pen / Highlight ── */}
          <div
            className="flex items-center gap-0.5 px-1"
            role="group"
            aria-label={language === "VI" ? "Công cụ chính" : "Primary tools"}
          >
            <button
              onClick={() => onSelectTool("read")}
              aria-pressed={activeTool === "read"}
              title={language === "VI" ? "Chế độ Đọc" : "Read Mode"}
              aria-label={language === "VI" ? "Chế độ Đọc" : "Read Mode"}
              className={toolBtn(activeTool === "read")}
            >
              <Navigation className="w-3.5 h-3.5 rotate-45 shrink-0" />
              <span className="hidden sm:inline">{language === "VI" ? "Đọc" : "Read"}</span>
            </button>

            <button
              onClick={() => onSelectTool("pen")}
              aria-pressed={activeTool === "pen"}
              title={language === "VI" ? "Chế độ Bút AI" : "AI Pen Mode"}
              aria-label={language === "VI" ? "Chế độ Bút AI" : "AI Pen Mode"}
              className={toolBtn(activeTool === "pen")}
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
              <span className="hidden sm:inline">{language === "VI" ? "Bút" : "AI Pen"}</span>
            </button>

            <button
              onClick={() => onSelectTool("highlight")}
              aria-pressed={activeTool === "highlight"}
              title={language === "VI" ? "Chế độ Highlight" : "Highlight Mode"}
              aria-label={language === "VI" ? "Chế độ Highlight" : "Highlight Mode"}
              className={toolBtn(activeTool === "highlight")}
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Highlight</span>
            </button>
          </div>

          <Divider />

          {/* ── Group 2: Page status + navigation ── */}
          <div
            className="flex items-center gap-1 px-1"
            role="group"
            aria-label={language === "VI" ? "Điều hướng trang" : "Page navigation"}
          >
            {/* Prev */}
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              title={language === "VI" ? "Trang trước" : "Previous page"}
              aria-label={language === "VI" ? "Trang trước" : "Previous page"}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Status pill — page navigation */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
              {/* Clickable page number for direct edit */}
              {isEditingPage ? (
                <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="number"
                    min={1}
                    max={totalPages}
                    value={inputPageVal}
                    onChange={(e) => setInputPageVal(e.target.value)}
                    onBlur={() => handlePageSubmit()}
                    aria-label={language === "VI" ? "Nhập số trang" : "Type page number"}
                    className="w-9 text-center text-xs font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/80 border border-blue-400 rounded px-1 py-0.5 focus:outline-none"
                  />
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">
                    / {totalPages}
                  </span>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPage(true)}
                  title={language === "VI" ? "Nhấp để nhập trang trực tiếp" : "Click to jump page"}
                  aria-label={
                    language === "VI"
                      ? `Trang ${currentPage} trên ${totalPages}. Nhấp để nhập trang.`
                      : `Page ${currentPage} of ${totalPages}. Click to edit page.`
                  }
                  className="flex items-center gap-0.5 font-mono font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded whitespace-nowrap"
                >
                  <span className="text-xs font-bold">{currentPage}</span>
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500 mx-0.5">/</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{totalPages}</span>
                </button>
              )}
            </div>

            {/* Next */}
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              title={language === "VI" ? "Trang sau" : "Next page"}
              aria-label={language === "VI" ? "Trang sau" : "Next page"}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Divider />

          {/* ── Group 3: Zoom Controls ── − 110% + ── */}
          <div
            role="group"
            aria-label={language === "VI" ? "Thu phóng tài liệu" : "Document zoom controls"}
            className="flex items-center gap-0.5 px-1"
          >
            <button
              onClick={onZoomOut}
              disabled={zoomLevel <= 70}
              aria-disabled={zoomLevel <= 70}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150"
              title={
                zoomLevel <= 70
                  ? language === "VI"
                    ? "Đã đạt mức thu nhỏ tối đa (70%)"
                    : "Minimum zoom level reached (70%)"
                  : language === "VI"
                    ? "Thu nhỏ"
                    : "Zoom Out"
              }
              aria-label={language === "VI" ? "Thu nhỏ" : "Zoom Out"}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <span className="min-w-[42px] text-center text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 select-none tabular-nums">
              {zoomLevel}%
            </span>

            <button
              onClick={onZoomIn}
              disabled={zoomLevel >= 180}
              aria-disabled={zoomLevel >= 180}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150"
              title={
                zoomLevel >= 180
                  ? language === "VI"
                    ? "Đã đạt mức phóng to tối đa (180%)"
                    : "Maximum zoom level reached (180%)"
                  : language === "VI"
                    ? "Phóng to"
                    : "Zoom In"
              }
              aria-label={language === "VI" ? "Phóng to" : "Zoom In"}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <Divider />

          {/* ── Group 4: Open Notes + More menu ── */}
          <div className="flex items-center gap-0.5 px-1">
            {/* 📝 Mở Note — primary action, toggles the Notes panel */}
            <button
              type="button"
              onClick={onOpenNotes}
              aria-pressed={isNotesOpen}
              title={
                language === "VI"
                  ? isNotesOpen
                    ? "Đóng bảng ghi chú"
                    : "Mở bảng ghi chú"
                  : isNotesOpen
                    ? "Close notes panel"
                    : "Open notes panel"
              }
              aria-label={
                language === "VI"
                  ? isNotesOpen
                    ? "Đóng bảng ghi chú"
                    : "Mở bảng ghi chú"
                  : isNotesOpen
                    ? "Close notes panel"
                    : "Open notes panel"
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isNotesOpen
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/60"
              }`}
            >
              <NotebookPen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">
                {language === "VI" ? "Mở Note" : "Notes"}
                {notesCount > 0 && (
                  <span
                    className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                      isNotesOpen
                        ? "bg-white/20 text-white"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {notesCount}
                  </span>
                )}
              </span>
            </button>

            {/* 🧠 Sơ đồ tư duy — Non-blocking Popover AI Button */}
            <div
              className="relative"
              ref={mindMapBtnRef}
              onMouseEnter={() => setIsMindMapHovering(true)}
              onMouseLeave={() => setIsMindMapHovering(false)}
            >
              <button
                type="button"
                onClick={() => {
                  if (mindMapStatus === "generating") {
                    onToggleFloatingProgress?.();
                  } else {
                    setShowConfigForced(false);
                    setIsMindMapPopoverOpen((prev) => !prev);
                  }
                }}
                aria-expanded={isMindMapPopoverOpen}
                aria-pressed={isMindMapDrawerOpen}
                title={
                  mindMapStatus === "generating"
                    ? "Đang tạo sơ đồ tư duy... Nhấp để mở tiến trình"
                    : mindMapStatus === "ready"
                    ? "Sơ đồ đã sẵn sàng ✓ Nhấp để xem tùy chọn"
                    : "Tạo sơ đồ tư duy"
                }
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  justCompletedFlash
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-105 animate-bounce"
                    : mindMapStatus === "generating"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/80 animate-pulse shadow-sm"
                    : isMindMapDrawerOpen
                    ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    : mindMapStatus === "ready"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/60"
                }`}
              >
                <Brain className={`w-3.5 h-3.5 shrink-0 ${mindMapStatus === "generating" ? "animate-spin text-indigo-600 dark:text-indigo-400" : mindMapStatus === "ready" ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-500"}`} />
                <span className="hidden sm:inline whitespace-nowrap font-medium">
                  {mindMapStatus === "generating" ? (
                    <span className="flex items-center gap-1">
                      <span>Đang tạo...</span>
                      <span className="font-mono text-[11px] font-bold">{Math.round(mindMapProgress)}%</span>
                      <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                    </span>
                  ) : mindMapStatus === "ready" ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                      <span>Đã tạo</span>
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    "Sơ đồ"
                  )}
                </span>
              </button>

              {/* Popover Modes */}
              {/* 1. Config Popover (when idle / error / user clicked "Tạo mới" manually) */}
              {isMindMapPopoverOpen && (mindMapStatus === "idle" || mindMapStatus === "error" || showConfigForced) && (
                <MindMapPopover
                  mode="config"
                  scope={mindMapScope}
                  setScope={(s) => onSetMindMapScope?.(s)}
                  startPage={mindMapStartPage}
                  setStartPage={(p) => onSetMindMapStartPage?.(p)}
                  endPage={mindMapEndPage}
                  setEndPage={(p) => onSetMindMapEndPage?.(p)}
                  totalPages={totalPages}
                  onGenerate={() => {
                    setIsMindMapPopoverOpen(false);
                    setShowConfigForced(false);
                    onStartMindMapGeneration?.();
                  }}
                  onClose={() => {
                    setIsMindMapPopoverOpen(false);
                    setShowConfigForced(false);
                  }}
                />
              )}

              {/* 2. Ready Dropdown Popover */}
              {isMindMapPopoverOpen && mindMapStatus === "ready" && !showConfigForced && (
                <MindMapPopover
                  mode="ready"
                  onOpenMap={() => {
                    setIsMindMapPopoverOpen(false);
                    onToggleMindMapDrawer?.();
                  }}
                  onRegenerate={() => {
                    // Chuyển trực tiếp sang giao diện Cấu hình thủ công trong 1 cú click
                    setShowConfigForced(true);
                  }}
                  onChangeDepth={() => {
                    setIsMindMapPopoverOpen(false);
                  }}
                  onClose={() => setIsMindMapPopoverOpen(false)}
                />
              )}

              {/* 3. Hover Progress Popover (when generating & hovered) */}
              {isMindMapHovering && mindMapStatus === "generating" && !isMindMapPopoverOpen && (
                <MindMapPopover
                  mode="hover_progress"
                  readPages={mindMapReadPages}
                  totalPages={mindMapTotalPages}
                  progress={mindMapProgress}
                  currentStepText={mindMapStepText}
                />
              )}
            </div>
            <div className="relative hidden" ref={moreRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                aria-label={language === "VI" ? "Tùy chọn khác" : "More options"}
                title={language === "VI" ? "Tùy chọn khác" : "More options"}
                className={`p-2 rounded-xl cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isMoreOpen
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/60"
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Dropdown menu with smooth fade & scale animation */}
              {isMoreOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  aria-label={language === "VI" ? "Danh sách tùy chọn" : "Options menu"}
                  className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Toggle Saved Note Regions */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleSavedNoteRegions?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 flex items-center justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <div className="flex items-center gap-2.5">
                      {showSavedNoteRegions ? (
                        <EyeOff className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        {language === "VI"
                          ? showSavedNoteRegions
                            ? "Ẩn vùng note"
                            : "Hiện vùng note"
                          : showSavedNoteRegions
                            ? "Hide Note Regions"
                            : "Show Note Regions"}
                      </span>
                    </div>
                    {/* ON/OFF badge */}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                        showSavedNoteRegions
                          ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {showSavedNoteRegions ? "ON" : "OFF"}
                    </span>
                  </button>

                  <div className="my-1 border-t border-gray-100 dark:border-slate-700/60" />

                  {/* Download */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDownload}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 flex items-center gap-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>{language === "VI" ? "Tải xuống tài liệu" : "Download document"}</span>
                  </button>

                  {/* Print */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handlePrint}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 flex items-center gap-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>{language === "VI" ? "In tài liệu" : "Print document"}</span>
                  </button>

                  {/* Undo */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onUndo?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80 flex items-center gap-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Undo2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>{language === "VI" ? "Hoàn tác" : "Undo"}</span>
                  </button>

                  <div className="my-1 border-t border-gray-100 dark:border-slate-700/60" />

                  {/* Delete Notes */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDeleteNotes?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>{language === "VI" ? "Xóa tất cả ghi chú" : "Delete all notes"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating selection badge ─────────────────────────────────────────────
          Absolutely positioned below the toolbar row, left-anchored.
          pointer-events-none on the wrapper so it never occludes content;
          inner badge restores pointer events.
      ──────────────────────────────────────────────────────────────────────── */}
      {selectionCount > 0 && (
        <div className="absolute left-3 sm:left-4 top-full pt-2 z-40 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-1 dark:border-fuchsia-900 dark:bg-fuchsia-950/40 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <span className="px-2 text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">
              {language === "VI"
                ? `${selectionCount} vùng khoanh`
                : `${selectionCount} selected`}
            </span>
            <button
              type="button"
              onClick={onCreateAINote}
              disabled={isGeneratingNote}
              aria-label={language === "VI" ? "Tạo AI Note" : "Create AI Note"}
              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700 disabled:cursor-wait disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 transition-colors"
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
              className="rounded-lg p-1 text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-50 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 transition-colors"
              title={language === "VI" ? "Bỏ tất cả vùng chọn" : "Clear all selections"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

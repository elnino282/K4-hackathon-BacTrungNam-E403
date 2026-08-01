import React, { useEffect, useRef, useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import type {
  MindMapDepth,
  MindMapScope,
  MindMapStatus,
} from "../lib/mindMap";
import type { Language } from "../types";


interface MindMapLauncherProps {
  language: Language;
  status: MindMapStatus;
  totalPages: number;
  currentPage: number;
  preparedPages: number;
  scope: MindMapScope;
  onScopeChange: (scope: MindMapScope) => void;
  startPage: number;
  endPage: number;
  onRangeChange: (startPage: number, endPage: number) => void;
  depth: MindMapDepth;
  onDepthChange: (depth: MindMapDepth) => void;
  onGenerate: (forceRefresh?: boolean) => void;
  onOpenMap: () => void;
}


export const MindMapLauncher: React.FC<MindMapLauncherProps> = ({
  language,
  status,
  totalPages,
  currentPage,
  preparedPages,
  scope,
  onScopeChange,
  startPage,
  endPage,
  onRangeChange,
  depth,
  onDepthChange,
  onGenerate,
  onOpenMap,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const busy = status === "preparing" || status === "generating";

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const scopeOptions: Array<{ value: MindMapScope; label: string }> = [
    { value: "current_page", label: language === "VI" ? "Trang này" : "Current page" },
    { value: "selected_pages", label: language === "VI" ? "Khoảng trang" : "Page range" },
    { value: "whole_lecture", label: language === "VI" ? "Toàn bài" : "Whole lecture" },
  ];
  const depthOptions: Array<{ value: MindMapDepth; label: string }> = [
    { value: "overview", label: language === "VI" ? "Tổng quan" : "Overview" },
    { value: "normal", label: language === "VI" ? "Tiêu chuẩn" : "Standard" },
    { value: "detailed", label: language === "VI" ? "Chi tiết" : "Detailed" },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          status === "ready"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            : busy
              ? "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === "ready" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-indigo-500" />
        )}
        <span className="hidden sm:inline">
          {busy
            ? (language === "VI" ? "Đang tạo sơ đồ" : "Building map")
            : status === "ready"
              ? (language === "VI" ? "Sơ đồ sẵn sàng" : "Map ready")
              : (language === "VI" ? "Sơ đồ" : "Mind map")}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start gap-2.5">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === "VI" ? "Sơ đồ tư duy AI" : "AI Mind Map"}
              </h3>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                {language === "VI"
                  ? "Mỗi nhánh đều gắn với trang nguồn trong tài liệu."
                  : "Every branch links back to a source page."}
              </p>
            </div>
          </div>

          {busy ? (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "preparing"
                  ? (language === "VI" ? "Đang xác định đúng phạm vi..." : "Preparing scope...")
                  : (language === "VI" ? "AI đang dựng các nhánh kiến thức..." : "AI is building knowledge branches...")}
              </div>
              {preparedPages > 0 && (
                <p className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                  {language === "VI"
                    ? `Đã chuẩn bị ${preparedPages} trang nguồn thật.`
                    : `Prepared ${preparedPages} real source pages.`}
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {language === "VI" ? "Phạm vi" : "Scope"}
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {scopeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onScopeChange(option.value)}
                    className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${
                      scope === option.value
                        ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                        : "text-slate-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {scope === "current_page" && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {language === "VI" ? `Trang hiện tại: ${currentPage}` : `Current page: ${currentPage}`}
                </p>
              )}
              {scope === "selected_pages" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={startPage}
                    onChange={(event) => onRangeChange(
                      Math.max(1, Math.min(totalPages, Number(event.target.value))),
                      endPage,
                    )}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    aria-label={language === "VI" ? "Trang bắt đầu" : "Start page"}
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={endPage}
                    onChange={(event) => onRangeChange(
                      startPage,
                      Math.max(1, Math.min(totalPages, Number(event.target.value))),
                    )}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    aria-label={language === "VI" ? "Trang kết thúc" : "End page"}
                  />
                </div>
              )}

              <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {language === "VI" ? "Độ chi tiết" : "Detail"}
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {depthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onDepthChange(option.value)}
                    className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${
                      depth === option.value
                        ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                        : "text-slate-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {status === "ready" && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenMap(); }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Brain className="h-4 w-4" />
                  {language === "VI" ? "Mở sơ đồ hiện tại" : "Open current map"}
                </button>
              )}
              <button
                type="button"
                disabled={scope === "selected_pages" && startPage > endPage}
                onClick={() => { setOpen(false); onGenerate(status === "ready"); }}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
                  status === "ready"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {status === "ready" ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {status === "ready"
                  ? (language === "VI" ? "Tạo lại theo cấu hình này" : "Regenerate")
                  : (language === "VI" ? "Tạo sơ đồ" : "Generate map")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

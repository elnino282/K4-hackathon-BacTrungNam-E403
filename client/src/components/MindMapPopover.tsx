import React, { useEffect, useRef } from "react";
import {
  Brain,
  Sparkles,
  Sliders,
  RefreshCw,
  Eye,
  Loader2,
} from "lucide-react";
import { MindMapDepth, MindMapScope } from "../lib/mindMap";

interface MindMapPopoverConfigProps {
  mode: "config";
  scope: MindMapScope;
  setScope: (scope: MindMapScope) => void;
  startPage: number;
  setStartPage: (page: number) => void;
  endPage: number;
  setEndPage: (page: number) => void;
  totalPages: number;
  onGenerate: () => void;
  onClose: () => void;
}

interface MindMapPopoverReadyProps {
  mode: "ready";
  onOpenMap: () => void;
  onRegenerate: () => void;
  onChangeDepth?: () => void;
  onClose: () => void;
}

interface MindMapPopoverHoverProgressProps {
  mode: "hover_progress";
  readPages: number;
  totalPages: number;
  progress: number;
  currentStepText: string;
}

export type MindMapPopoverProps =
  | MindMapPopoverConfigProps
  | MindMapPopoverReadyProps
  | MindMapPopoverHoverProgressProps;

export const MindMapPopover: React.FC<MindMapPopoverProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape (for interactive popovers)
  useEffect(() => {
    if (props.mode === "hover_progress") return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        props.onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props]);

  // Mode 1: Configuration Form Popover
  if (props.mode === "config") {
    const {
      scope,
      setScope,
      startPage,
      setStartPage,
      endPage,
      setEndPage,
      totalPages,
      onGenerate,
      onClose,
    } = props;

    return (
      <div
        ref={containerRef}
        className="absolute top-full right-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl dark:border-slate-800/90 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-label="Cài đặt tạo sơ đồ tư duy"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400">
            <Brain className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Tạo sơ đồ tư duy
          </h4>
        </div>

        <div className="mt-3 space-y-3">
          {/* Scope selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Phạm vi bài giảng
            </label>
            <div className="space-y-1.5 text-xs">
              <label
                onClick={() => setScope("whole_lecture")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                  scope === "whole_lecture"
                    ? "border-indigo-500 bg-indigo-50/70 text-indigo-700 font-semibold dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="mindmap_scope"
                  checked={scope === "whole_lecture"}
                  onChange={() => setScope("whole_lecture")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Toàn bộ bài giảng ({totalPages} trang)</span>
              </label>

              <div
                className={`rounded-xl border p-2.5 transition-all ${
                  scope === "selected_pages"
                    ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/60"
                    : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50"
                }`}
              >
                <label
                  onClick={() => setScope("selected_pages")}
                  className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium"
                >
                  <input
                    type="radio"
                    name="mindmap_scope"
                    checked={scope === "selected_pages"}
                    onChange={() => setScope("selected_pages")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Tùy chọn trang</span>
                </label>

                {scope === "selected_pages" && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-indigo-100 dark:border-indigo-900/50 pt-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Từ slide:</span>
                      <input
                        type="number"
                        min={1}
                        max={endPage}
                        value={startPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1 && val <= endPage) {
                            setStartPage(val);
                          }
                        }}
                        className="w-12 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <span className="text-slate-400 font-bold">→</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Đến slide:</span>
                      <input
                        type="number"
                        min={startPage}
                        max={totalPages}
                        value={endPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= startPage && val <= totalPages) {
                            setEndPage(val);
                          }
                        }}
                        className="w-12 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Submit Button */}
        <div className="mt-4 border-t border-slate-100 pt-3 flex justify-end gap-2 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tạo sơ đồ
          </button>
        </div>
      </div>
    );
  }

  // Mode 2: Hover Progress Info
  if (props.mode === "hover_progress") {
    const { readPages, totalPages, progress, currentStepText } = props;
    return (
      <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/95 pointer-events-none animate-in fade-in duration-150">
        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
            Đang tạo sơ đồ
          </span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400">
            {Math.round(progress)}%
          </span>
        </div>

        {/* NotebookLM feature: Page reading progress status */}
        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between mb-1">
            <span>Đã đọc</span>
            <span className="font-mono font-semibold">
              {readPages} / {totalPages} trang
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${(readPages / Math.max(1, totalPages)) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 truncate">
            {currentStepText || "Đang phân tích cấu trúc bài giảng..."}
          </p>
        </div>
      </div>
    );
  }

  // Mode 3: Ready Dropdown Menu Popover
  if (props.mode === "ready") {
    const { onOpenMap, onRegenerate, onChangeDepth, onClose } = props;
    return (
      <div
        ref={containerRef}
        className="absolute top-full right-0 mt-2 z-50 w-48 rounded-2xl border border-slate-200/90 bg-white py-1.5 shadow-xl dark:border-slate-800/90 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
        role="menu"
      >
        <button
          type="button"
          onClick={() => {
            onOpenMap();
            onClose();
          }}
          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
          role="menuitem"
        >
          <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Mở sơ đồ
        </button>

        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

        <button
          type="button"
          onClick={() => {
            onRegenerate();
          }}
          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
          role="menuitem"
        >
          <RefreshCw className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Tạo mới
        </button>
      </div>
    );
  }

  return null;
};

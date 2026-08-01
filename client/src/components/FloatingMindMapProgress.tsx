import React from "react";
import { Brain, X, Loader2, Sparkles } from "lucide-react";

interface FloatingMindMapProgressProps {
  progress: number; // 0 to 100
  readPages: number;
  totalPages: number;
  currentStepText: string;
  onHide: () => void;
}

export const FloatingMindMapProgress: React.FC<FloatingMindMapProgressProps> = ({
  progress,
  readPages,
  totalPages,
  currentStepText,
  onHide,
}) => {
  return (
    <div
      className="fixed bottom-6 right-6 z-[80] w-80 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95 animate-in slide-in-from-bottom-5 fade-in duration-200"
      role="status"
      aria-label="Tiến trình tạo sơ đồ tư duy"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 animate-pulse">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Đang tạo sơ đồ tư duy</span>
              <Sparkles className="h-3 w-3 text-amber-500 animate-spin" />
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chạy nền • Bạn vẫn có thể học slide
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onHide}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Thu gọn vào thanh công cụ"
          aria-label="Thu gọn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-300 text-[11px] flex items-center gap-1.5 truncate max-w-[210px]">
            <Loader2 className="h-3 w-3 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">{currentStepText || `Đang đọc PDF (${readPages}/${totalPages} trang)`}</span>
          </span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0 ml-1">
            {Math.min(100, Math.max(0, Math.round(progress)))}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          />
        </div>
      </div>

      {/* Footer step divider & hide button */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="truncate max-w-[190px]">
          Đã phân tích {readPages}/{totalPages} trang
        </span>
        <button
          type="button"
          onClick={onHide}
          className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
        >
          Ẩn
        </button>
      </div>
    </div>
  );
};

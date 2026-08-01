import React, { useEffect } from "react";
import { CheckCircle2, ArrowRight, X } from "lucide-react";

interface MindMapReadyToastProps {
  onOpenNow: () => void;
  onViewLater: () => void;
}

export const MindMapReadyToast: React.FC<MindMapReadyToastProps> = ({
  onOpenNow,
  onViewLater,
}) => {
  // Auto-dismiss after 8 seconds if no user action taken
  useEffect(() => {
    const timer = setTimeout(() => {
      onViewLater();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onViewLater]);

  return (
    <div
      className="fixed bottom-6 right-6 z-[85] w-80 rounded-2xl border border-emerald-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-emerald-900/90 dark:bg-slate-900/95 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Sơ đồ đã sẵn sàng ✓
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Đã tổng hợp cấu trúc bài giảng PDF
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewLater}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Đóng thông báo"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <button
          type="button"
          onClick={onViewLater}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          Xem sau
        </button>
        <button
          type="button"
          onClick={onOpenNow}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          <span>Mở ngay</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

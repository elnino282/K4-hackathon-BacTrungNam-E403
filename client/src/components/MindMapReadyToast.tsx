import React, { useEffect } from "react";
import { Brain, CheckCircle2, X } from "lucide-react";

import type { Language } from "../types";


interface MindMapReadyToastProps {
  language: Language;
  nodeCount: number;
  sourcePageCount: number;
  onOpen: () => void;
  onClose: () => void;
}


export const MindMapReadyToast: React.FC<MindMapReadyToastProps> = ({
  language,
  nodeCount,
  sourcePageCount,
  onOpen,
  onClose,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 9_000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-[76] w-[320px] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {language === "VI" ? "Sơ đồ đã sẵn sàng" : "Mind map is ready"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {language === "VI"
                ? `${nodeCount} khái niệm · nguồn từ ${sourcePageCount} trang`
                : `${nodeCount} concepts · ${sourcePageCount} source pages`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={language === "VI" ? "Đóng thông báo" : "Close notification"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
      >
        <Brain className="h-4 w-4" />
        {language === "VI" ? "Mở sơ đồ" : "Open map"}
      </button>
    </div>
  );
};

import React from "react";
import { Brain, Loader2, X } from "lucide-react";

import type { Language } from "../types";


interface MindMapProgressProps {
  language: Language;
  stage: "preparing" | "generating";
  preparedPages: number;
  onHide: () => void;
}


export const MindMapProgress: React.FC<MindMapProgressProps> = ({
  language,
  stage,
  preparedPages,
  onHide,
}) => (
  <div className="fixed bottom-5 right-5 z-[75] w-[300px] rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl dark:border-indigo-800 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            {stage === "preparing"
              ? (language === "VI" ? "Đang chuẩn bị nguồn" : "Preparing sources")
              : (language === "VI" ? "AI đang dựng sơ đồ" : "AI is building the map")}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            {preparedPages > 0
              ? (
                  language === "VI"
                    ? `${preparedPages} trang đúng phạm vi đã được gửi để phân tích.`
                    : `${preparedPages} in-scope pages are being analyzed.`
                )
              : (
                  language === "VI"
                    ? "Đang xác định đúng các trang thuộc phạm vi bạn chọn."
                    : "Resolving the exact pages in your selected scope."
                )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onHide}
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={language === "VI" ? "Ẩn tiến trình" : "Hide progress"}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-600" />
    </div>
  </div>
);

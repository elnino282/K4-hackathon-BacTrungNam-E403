import React from "react";
import { FileText, Moon, Sun, ChevronLeft, Layout, Sparkles } from "lucide-react";
import { Language } from "../types";

interface HeaderNavProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  panelOnlyMode: boolean;
  onTogglePanelOnlyMode: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  language,
  onLanguageChange,
  isDarkMode,
  onToggleDarkMode,
  panelOnlyMode,
  onTogglePanelOnlyMode,
}) => {
  return (
    <header className="h-14 border-b border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-4 flex items-center justify-between shadow-xs sticky top-0 z-30 transition-colors">
      {/* Left section: Logo & Document Title */}
      <div className="flex items-center gap-3 overflow-hidden">
        <button 
          title={language === "VI" ? "Quay lại trang chủ" : "Back to dashboard"}
          aria-label={language === "VI" ? "Quay lại trang chủ" : "Back to dashboard"} 
          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* VLearn Brand Logo */}
        <div className="flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-xs tracking-tighter">
            V
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
            V<span className="text-blue-600">Learn</span>
          </span>
        </div>

        {/* Document Metadata Pill */}
        <div className="hidden sm:flex items-center gap-2 truncate">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              BaiGiang_COMP2010.pdf
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              COMP2010 · Slide Bài Giảng Tuần 2
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Action controls */}
      <div className="flex items-center gap-2">
        {/* Toggle Panel View vs Full Layout */}
        <button
          onClick={onTogglePanelOnlyMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            panelOnlyMode
              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300"
              : "bg-white border-gray-200 text-slate-700 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          }`}
          title={
            language === "VI"
              ? panelOnlyMode
                ? "Chuyển sang Chế độ chia màn hình"
                : "Chuyển sang Chế độ tập trung AI Tutor"
              : panelOnlyMode
                ? "Switch to Split View"
                : "Switch to AI Tutor Focus"
          }
          aria-label={
            language === "VI"
              ? panelOnlyMode
                ? "Chuyển sang Chế độ chia màn hình"
                : "Chuyển sang Chế độ tập trung AI Tutor"
              : panelOnlyMode
                ? "Switch to Split View"
                : "Switch to AI Tutor Focus"
          }
        >
          {panelOnlyMode ? <Sparkles className="w-3.5 h-3.5" /> : <Layout className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">
            {language === "VI"
              ? panelOnlyMode
                ? "Chia màn hình"
                : "Tập trung AI Tutor"
              : panelOnlyMode
                ? "AI Tutor Focus"
                : "Split View"}
          </span>
        </button>

        {/* Language selector */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold" role="group" aria-label="Language selection">
          <button
            onClick={() => onLanguageChange("VI")}
            aria-label="Tiếng Việt"
            className={`px-2 py-1 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              language === "VI"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            VI
          </button>
          <button
            onClick={() => onLanguageChange("EN")}
            aria-label="English"
            className={`px-2 py-1 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              language === "EN"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            EN
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={isDarkMode ? (language === "VI" ? "Chuyển sang chế độ sáng" : "Switch to light mode") : (language === "VI" ? "Chuyển sang chế độ tối" : "Switch to dark mode")}
          aria-label={isDarkMode ? (language === "VI" ? "Chuyển sang chế độ sáng" : "Switch to light mode") : (language === "VI" ? "Chuyển sang chế độ tối" : "Switch to dark mode")}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

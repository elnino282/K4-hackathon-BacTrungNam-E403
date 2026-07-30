import React from "react";
import { Navigation, Edit2, Highlighter, Plus, Minus, Download, Printer, Undo2, Trash2, MoreHorizontal } from "lucide-react";
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
}) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs font-medium select-none shadow-2xs">
      {/* Left tool selector */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
        <button
          onClick={() => onSelectTool("read")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeTool === "highlight"
              ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span>{language === "VI" ? "Highlight" : "Highlight"}</span>
        </button>

        <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg dark:hover:text-slate-200">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Middle: Page counter pill */}
      <div className="flex items-center gap-2">
        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium shadow-2xs">
          {language === "VI"
            ? `Trang ${currentPage} · ${notesCount} note`
            : `Page ${currentPage} · ${notesCount} notes`}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-r border-gray-200 dark:border-slate-700"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 py-1 text-slate-700 dark:text-slate-300 min-w-[50px] text-center font-mono">
            {zoomLevel}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-l border-gray-200 dark:border-slate-700"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right action icons */}
      <div className="hidden lg:flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs text-slate-500 dark:text-slate-400">
        <button className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <Plus className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <Minus className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <Download className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <Printer className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <Undo2 className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

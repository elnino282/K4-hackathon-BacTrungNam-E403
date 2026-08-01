import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BookOpen, ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import type { MindMapFlowNodeData } from "../lib/mindMapFlow";

export const MindMapFlowNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as MindMapFlowNodeData;
  const { title, summary, pageReferences, collapsed, hasChildren, selected, depth = 1 } = nodeData;

  const isRoot = depth === 0;
  const isBranch = depth === 1;
  const pageNum = pageReferences && pageReferences.length > 0 ? pageReferences[0] : null;

  return (
    <div
      className={`group relative flex w-[230px] flex-col rounded-xl border p-3 transition-all duration-200 ${
        selected
          ? "border-indigo-500 bg-indigo-50/90 shadow-md ring-2 ring-indigo-500/30 dark:border-indigo-500 dark:bg-indigo-950/60 dark:ring-indigo-500/40"
          : isRoot
          ? "border-indigo-500/40 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-md hover:shadow-lg dark:border-indigo-600 dark:from-indigo-600 dark:to-indigo-900"
          : isBranch
          ? "border-slate-200/90 bg-white/95 text-slate-800 shadow-xs hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-700"
          : "border-slate-200/70 bg-white/80 text-slate-700 shadow-2xs hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-200"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-indigo-500 dark:!border-slate-900"
      />

      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isRoot && <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300 animate-pulse" />}
          <h4
            className={`truncate text-xs font-semibold leading-tight ${
              isRoot ? "text-white" : selected ? "text-indigo-950 dark:text-indigo-100" : "text-slate-900 dark:text-slate-100"
            }`}
            title={title}
          >
            {title}
          </h4>
        </div>

        {pageNum && (
          <span
            className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-tight ${
              isRoot
                ? "bg-indigo-500/40 text-indigo-100 backdrop-blur-xs"
                : selected
                ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <BookOpen className="h-2.5 w-2.5" />
            p.{pageNum}
          </span>
        )}
      </div>

      {summary && (
        <p
          className={`mt-1.5 line-clamp-2 text-[11px] leading-relaxed ${
            isRoot ? "text-indigo-100/90" : "text-slate-500 dark:text-slate-400"
          }`}
          title={summary}
        >
          {summary}
        </p>
      )}

      {hasChildren && (
        <div className="mt-2 flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800/50">
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isRoot ? "text-indigo-200 hover:text-white" : "text-indigo-600 dark:text-indigo-400"
            }`}
          >
            {collapsed ? (
              <>
                <ChevronRight className="h-3 w-3" /> Mở rộng
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Thu gọn
              </>
            )}
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-indigo-500 dark:!border-slate-900"
      />
    </div>
  );
});

MindMapFlowNode.displayName = "MindMapFlowNode";

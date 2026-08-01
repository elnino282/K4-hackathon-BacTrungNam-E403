import { memo } from "react";
import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { ChevronRight, FileText } from "lucide-react";

import type { MindMapFlowNodeData } from "../lib/mindMapFlow";


export const MindMapFlowNode = memo(({ data }: NodeProps) => {
  const node = data as unknown as MindMapFlowNodeData;
  const isRoot = node.depth === 0;
  return (
    <div
      className={`w-[240px] rounded-2xl border p-3.5 shadow-md transition-all ${
        node.selected
          ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-200/60 dark:bg-indigo-950 dark:ring-indigo-900/60"
          : isRoot
            ? "border-indigo-500 bg-indigo-600 text-white"
            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
      <div className="flex items-start justify-between gap-2">
        <h3 className={`line-clamp-2 text-sm font-bold ${
          isRoot && !node.selected
            ? "text-white"
            : "text-slate-900 dark:text-white"
        }`}>
          {node.title}
        </h3>
        {node.hasChildren && (
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
            node.collapsed ? "" : "rotate-90"
          }`} />
        )}
      </div>
      <p className={`mt-1.5 line-clamp-3 text-[11px] leading-relaxed ${
        isRoot && !node.selected
          ? "text-indigo-100"
          : "text-slate-600 dark:text-slate-300"
      }`}>
        {node.summary}
      </p>
      <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${
        isRoot && !node.selected
          ? "text-indigo-100"
          : "text-indigo-600 dark:text-indigo-300"
      }`}>
        <FileText className="h-3 w-3" />
        Trang {node.pageReferences.join(", ")}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </div>
  );
});

MindMapFlowNode.displayName = "MindMapFlowNode";

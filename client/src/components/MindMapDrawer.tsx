import React, { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Brain,
  Download,
  ExternalLink,
  FileText,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import type { MindMapNode, MindMapResult } from "../lib/mindMap";
import {
  toMindMapFlow,
  type MindMapFlowNodeData,
} from "../lib/mindMapFlow";
import type { Language } from "../types";
import { MindMapFlowNode } from "./MindMapFlowNode";


const nodeTypes = { mindMapNode: MindMapFlowNode };

interface MindMapDrawerProps {
  open: boolean;
  language: Language;
  result: MindMapResult | null;
  onClose: () => void;
  onNavigateToPage: (page: number) => void;
  onRegenerate: () => void;
}


function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function serializeNode(node: MindMapNode): Record<string, unknown> {
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    page_references: node.pageReferences,
    children: node.children.map(serializeNode),
  };
}


export const MindMapDrawer: React.FC<MindMapDrawerProps> = ({
  open,
  language,
  result,
  onClose,
  onNavigateToPage,
  onRegenerate,
}) => {
  const [query, setQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const map = result?.mindMap ?? null;
  const selectedNode = map && selectedId ? findNode(map, selectedId) : null;

  const graph = useMemo(() => {
    if (!map) return { nodes: [], edges: [] };
    const searching = query.trim().length > 0;
    const flow = toMindMapFlow(
      map,
      searching ? new Set<string>() : collapsedIds,
      selectedId,
    );
    if (!searching) return flow;
    const normalized = query.trim().toLocaleLowerCase();
    return {
      ...flow,
      nodes: flow.nodes.map((node) => {
        const matches = [node.data.title, node.data.summary]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized);
        return {
          ...node,
          style: { opacity: matches ? 1 : 0.28 },
          data: { ...node.data, selected: matches || node.id === selectedId },
        };
      }),
    };
  }, [collapsedIds, map, query, selectedId]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
    const data = node.data as unknown as MindMapFlowNodeData;
    if (!data.hasChildren) return;
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, []);

  const downloadJSON = () => {
    if (!result) return;
    const payload = {
      scope: result.scope,
      depth: result.depth,
      source_pages: result.sourcePages,
      mind_map: serializeNode(result.mindMap),
    };
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slide2study-mind-map-${result.scope}-${result.depth}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label={language === "VI" ? "Đóng sơ đồ tư duy" : "Close mind map"}
        className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-6xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-indigo-600 p-2 text-white">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {map?.title ?? (language === "VI" ? "Sơ đồ tư duy AI" : "AI Mind Map")}
              </h2>
              {result && (
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {language === "VI"
                    ? `${result.nodeCount} khái niệm · ${result.sourcePages.length} trang nguồn · ${result.depth}`
                    : `${result.nodeCount} concepts · ${result.sourcePages.length} source pages · ${result.depth}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={language === "VI" ? "Tìm khái niệm..." : "Find a concept..."}
                className="w-36 bg-transparent text-xs outline-none sm:w-48"
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={language === "VI" ? "Đóng" : "Close"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-950">
            {map ? (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={graph.nodes}
                  edges={graph.edges}
                  nodeTypes={nodeTypes}
                  onNodeClick={handleNodeClick}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.3}
                  maxZoom={1.8}
                >
                  <Controls />
                  <Background color="#cbd5e1" gap={22} size={1} />
                </ReactFlow>
              </ReactFlowProvider>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <Brain className="h-10 w-10 text-indigo-400" />
                <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {language === "VI" ? "Chưa có sơ đồ để hiển thị" : "No map to display"}
                </p>
              </div>
            )}
          </main>

          {selectedNode && (
            <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                {language === "VI" ? "Khái niệm đang chọn" : "Selected concept"}
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                {selectedNode.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {selectedNode.summary}
              </p>
              <p className="mb-2 mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                {language === "VI" ? "Nguồn đã xác minh" : "Verified sources"}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedNode.pageReferences.map((page) => (
                  <button
                    key={`${selectedNode.id}-${page}`}
                    type="button"
                    onClick={() => onNavigateToPage(page)}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    {language === "VI" ? `Mở trang ${page}` : `Open page ${page}`}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ))}
              </div>
              {selectedNode.children.length > 0 && (
                <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-[10px] leading-relaxed text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {language === "VI"
                    ? "Nhấn lại node để thu gọn hoặc mở rộng các nhánh con."
                    : "Click the node again to collapse or expand its children."}
                </p>
              )}
            </aside>
          )}
        </div>

        {result && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <p className="text-[10px] text-slate-500">
              {language === "VI"
                ? `Nguồn: trang ${result.sourcePages.join(", ")}`
                : `Sources: pages ${result.sourcePages.join(", ")}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {language === "VI" ? "Tạo lại" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                <Printer className="h-3.5 w-3.5" />
                {language === "VI" ? "In" : "Print"}
              </button>
              <button
                type="button"
                onClick={downloadJSON}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700"
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </button>
            </div>
          </footer>
        )}
      </section>
    </>
  );
};

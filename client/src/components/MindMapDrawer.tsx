import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Brain,
  Download,
  Maximize2,
  RefreshCw,
  X,
  Sparkles,
  Search,
  BookOpen,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  FileImage,
  Sliders,
} from "lucide-react";
import {
  createMindMapCacheKey,
  type MindMapDepth,
  type MindMapNode,
  type MindMapScope,
} from "../lib/mindMap";
import { readMindMapCache, removeMindMapCache, writeMindMapCache } from "../lib/mindMapCache";
import { requestMindMap } from "../lib/mindMapRequest";
import { toMindMapFlow, type MindMapFlowNodeData } from "../lib/mindMapFlow";
import { MindMapFlowNode } from "./MindMapFlowNode";

const nodeTypes = {
  mindMapNode: MindMapFlowNode,
};

interface MindMapDrawerProps {
  open: boolean;
  onClose: () => void;
  pages: Record<number, string>;
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  mindMapData?: MindMapNode | null;
  onRegenerate?: () => void;
}

export function MindMapDrawer({
  open,
  onClose,
  pages,
  currentPage,
  onNavigateToPage,
  mindMapData,
  onRegenerate,
}: MindMapDrawerProps) {
  const [scope, setScope] = useState<MindMapScope>("whole_lecture");
  const [depth, setDepth] = useState<MindMapDepth>("normal");
  const [map, setMap] = useState<MindMapNode | null>(mindMapData ?? null);
  const [isCached, setIsCached] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Search & Node selection
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const content = useMemo(
    () => Object.entries(pages).map(([page, text]) => ({ page: Number(page), text })),
    [pages]
  );

  const key = useMemo(
    () =>
      createMindMapCacheKey({
        documentId: "lesson-01",
        scope,
        depth,
        pages: content.map((x) => x.page),
        content: content.map((x) => x.text).join(""),
      }),
    [scope, depth, content]
  );

  // Sync passed mindMapData or check cache whenever drawer opens
  useEffect(() => {
    if (mindMapData) {
      setMap(mindMapData);
      setIsCached(true);
      return;
    }
    if (open && !loading) {
      const cached = readMindMapCache(key);
      if (cached) {
        setMap(cached);
        setIsCached(true);
      }
    }
  }, [open, key, loading, mindMapData]);

  // Keyboard navigation & accessibility (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Handle generation flow
  const generate = async (forceRefresh = false) => {
    if (onRegenerate) {
      onRegenerate();
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingStep(1);

    try {
      if (forceRefresh) {
        removeMindMapCache(key);
      }

      if (!content.length) {
        throw new Error("Đang phân tích PDF... Vui lòng chờ các trang slide được tải hoàn tất.");
      }

      const selectedContent =
        scope === "current_page"
          ? content.filter((x) => x.page === currentPage)
          : content;

      const result = await requestMindMap({
        documentId: "lesson-01",
        content: selectedContent,
        scope,
        depth,
      });

      writeMindMapCache(key, result);
      setMap(result);
      setIsCached(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo sơ đồ tư duy.");
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedId(node.id);
      const data = node.data as unknown as MindMapFlowNodeData;

      if (data.hasChildren) {
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
      }

      if (data.pageReferences && data.pageReferences.length > 0) {
        onNavigateToPage(data.pageReferences[0]);
      }
    },
    [onNavigateToPage]
  );

  // Compute graph data with optional search highlighting
  const graph = useMemo(() => {
    if (!map) return { nodes: [], edges: [] };
    const flowData = toMindMapFlow(map, collapsedIds, selectedId);

    if (!searchTerm.trim()) return flowData;

    const term = searchTerm.toLowerCase();
    const updatedNodes = flowData.nodes.map((node) => {
      const match =
        node.data.title.toLowerCase().includes(term) ||
        node.data.summary.toLowerCase().includes(term);
      return {
        ...node,
        data: {
          ...node.data,
          selected: match || node.id === selectedId,
        },
      };
    });

    return { ...flowData, nodes: updatedNodes };
  }, [map, collapsedIds, selectedId, searchTerm]);

  // Compute stats
  const stats = useMemo(() => {
    if (!map) return { pagesCount: 0, topicsCount: 0, estTime: 0 };
    const pagesSet = new Set<number>();
    let count = 0;
    const walk = (n: MindMapNode) => {
      count++;
      n.pageReferences.forEach((p) => pagesSet.add(p));
      n.children.forEach(walk);
    };
    walk(map);
    return {
      pagesCount: pagesSet.size,
      topicsCount: count,
      estTime: Math.max(1, Math.ceil(count * 0.5)),
    };
  }, [map]);

  const exportJSON = () => {
    if (!map) return;
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mind-map-${scope}-${depth}.json`;
    a.click();
  };

  const exportPNG = () => {
    window.print();
  };

  if (!open) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* SIDEBAR CANVAS (Appears when drawer is opened)                             */}
      {/* ========================================================================= */}
      <div
        className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-4xl flex-col border-l border-slate-200/80 bg-white shadow-2xl animate-in slide-in-from-right duration-250 ease-out dark:border-slate-800 dark:bg-slate-950"
        role="region"
        aria-label="Sidebar Sơ đồ tư duy"
      >
        {/* Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-6 dark:border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Brain className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Sơ đồ tư duy AI
                {isCached && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Đã sẵn sàng
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Search Node Input & Controls */}
          <div className="flex items-center gap-3">
            {map && (
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm khái niệm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-44 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {/* Learning Metrics Pill */}
            {map && (
              <div className="hidden items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1 text-xs text-slate-600 md:flex dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                <span className="flex items-center gap-1 font-medium">
                  <BookOpen className="h-3 w-3 text-indigo-500" />
                  {stats.pagesCount} trang
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <Layers className="h-3 w-3 text-indigo-500" />
                  {stats.topicsCount} chủ đề
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Đóng sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Interactive Mind Map Canvas */}
        <main className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
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
                defaultEdgeOptions={{ type: "smoothstep" }}
              >
                <MiniMap
                  nodeColor="#818cf8"
                  maskColor="rgba(15, 23, 42, 0.6)"
                  style={{
                    borderRadius: "12px",
                    border: "1px solid rgba(226, 232, 240, 0.8)",
                  }}
                />
                <Controls className="!rounded-xl !border-slate-200/80 !shadow-md dark:!border-slate-800 dark:!bg-slate-900" />
                <Background color="#cbd5e1" gap={20} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-4">
                <Brain className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Chưa có sơ đồ tư duy
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Bấm vào nút Sơ đồ trên thanh công cụ để tạo sơ đồ tư duy AI cho bài giảng này.
              </p>
              <button
                type="button"
                onClick={() => generate(true)}
                className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Tạo sơ đồ ngay
              </button>
            </div>
          )}
        </main>

        {/* Footer Toolbar */}
        {map && (
          <footer className="flex h-16 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
            <div className="flex items-center gap-2">
              <button
                onClick={() => generate(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tạo lại
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fit View
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportPNG}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileImage className="h-3.5 w-3.5 text-indigo-500" />
                Xuất PNG / In
              </button>

              <button
                onClick={exportJSON}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileCode className="h-3.5 w-3.5 text-emerald-500" />
                Tải JSON
              </button>
            </div>
          </footer>
        )}
      </div>
    </>
  );
}

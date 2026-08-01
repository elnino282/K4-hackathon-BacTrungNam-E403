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
}

export function MindMapDrawer({
  open,
  onClose,
  pages,
  currentPage,
  onNavigateToPage,
}: MindMapDrawerProps) {
  const [scope, setScope] = useState<MindMapScope>("whole_lecture");
  const [depth, setDepth] = useState<MindMapDepth>("normal");
  const [map, setMap] = useState<MindMapNode | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Flow States: "MODAL" | "LOADING" | "SIDEBAR"
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Search & Node selection
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isReconfiguring, setIsReconfiguring] = useState(false);

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

  // Check cache whenever drawer opens or settings change
  useEffect(() => {
    if (open && !loading) {
      const cached = readMindMapCache(key);
      if (cached) {
        setMap(cached);
        setIsCached(true);
        setIsReconfiguring(false);
      } else {
        setMap(null);
        setIsCached(false);
      }
    }
  }, [open, key, loading]);

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
    setError(null);
    setLoading(true);
    setLoadingStep(1); // 1. Reading PDF
    setIsReconfiguring(false);

    try {
      if (forceRefresh) {
        removeMindMapCache(key);
      }

      if (!content.length) {
        throw new Error("Đang phân tích PDF... Vui lòng chờ các trang slide được tải hoàn tất.");
      }

      // Step 2: Analyzing content
      const stepTimer1 = setTimeout(() => setLoadingStep(2), 600);

      const selectedContent =
        scope === "current_page"
          ? content.filter((x) => x.page === currentPage)
          : content;

      // Step 3: Building mind map tree
      const stepTimer2 = setTimeout(() => setLoadingStep(3), 1400);

      const result = await requestMindMap({
        documentId: "lesson-01",
        content: selectedContent,
        scope,
        depth,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

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

  // Determine current active view:
  // If map exists and not reconfiguring -> SIDEBAR mode
  // If loading -> LOADING mode
  // Otherwise -> SETUP MODAL mode
  const showSidebar = map !== null && !loading && !isReconfiguring;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. SETUP MODAL STATE (Center Screen - When no map or reconfiguring)      */}
      {/* ========================================================================= */}
      {!showSidebar && !loading && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mindmap-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="mindmap-modal-title"
                    className="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Tạo Sơ đồ tư duy AI
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hệ thống hóa bài giảng & liên kết trang PDF
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scope & Depth Selection Form */}
            <div className="mt-5 space-y-4">
              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Phạm vi phân tích
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("whole_lecture")}
                    className={`flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                      scope === "whole_lecture"
                        ? "border-indigo-500 bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    }`}
                  >
                    Toàn bộ bài giảng
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("current_page")}
                    className={`flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                      scope === "current_page"
                        ? "border-indigo-500 bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    }`}
                  >
                    Trang hiện tại (p.{currentPage})
                  </button>
                </div>
              </div>

              {/* Depth Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Độ sâu sơ đồ
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    { id: "overview", label: "Tóm tắt" },
                    { id: "normal", label: "Tiêu chuẩn" },
                    { id: "detailed", label: "Chi tiết" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDepth(option.id as MindMapDepth)}
                      className={`flex items-center justify-center rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                        depth === option.id
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300"
                          : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => generate(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Tạo sơ đồ tư duy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LOADING DIALOG STATE (Center Screen - Lightweight Progress)            */}
      {/* ========================================================================= */}
      {loading && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl text-center dark:border-slate-800 dark:bg-slate-900">
            {/* Shimmer Icon */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>

            <h4 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI đang xây dựng sơ đồ tư duy...
            </h4>

            {/* Checklist items */}
            <div className="mt-4 space-y-2.5 text-left text-xs">
              <div
                className={`flex items-center gap-2.5 transition-colors ${
                  loadingStep >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Đang đọc nội dung PDF</span>
              </div>
              <div
                className={`flex items-center gap-2.5 transition-colors ${
                  loadingStep >= 2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                }`}
              >
                {loadingStep >= 2 ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
                )}
                <span>Phân tích cấu trúc & khái niệm</span>
              </div>
              <div
                className={`flex items-center gap-2.5 transition-colors ${
                  loadingStep >= 3 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                }`}
              >
                {loadingStep >= 3 ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-700" />
                )}
                <span>Kết nối mạng lưới sơ đồ tư duy...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SIDEBAR RESULT STATE (Appears ONLY after AI has data)                   */}
      {/* ========================================================================= */}
      {showSidebar && (
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
                      <CheckCircle2 className="h-3 w-3" /> Đã lưu
                    </span>
                  )}
                </h2>
              </div>
            </div>

            {/* Search Node Input & Controls */}
            <div className="flex items-center gap-3">
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

              {/* Learning Metrics Pill */}
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

            {/* Reconfigure Options Bar */}
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={() => setIsReconfiguring(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200"
              >
                <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                Đổi cài đặt sơ đồ
              </button>
            </div>
          </main>

          {/* Footer Toolbar */}
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
        </div>
      )}
    </>
  );
}

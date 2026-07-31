import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronRight,
  ChevronLeft,
  Bot,
  Loader2,
  Sparkles,
} from "lucide-react";
import { HeaderNav } from "./components/HeaderNav";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { FeatureBoundary } from "./components/FeatureBoundary";
import { DEFAULT_PDF_URL, DEFAULT_PDF_FILENAME } from "./data/mockSlides";
import {
  NOTE_STORAGE_KEY,
  mergeNotes,
  parseStoredNotes,
  serializeNotes,
  upsertNote,
} from "./lib/noteStorage";
import { fetchWithTimeout } from "./lib/apiClient";
import {
  AINote,
  ContextSnippet,
  EvidenceNavigationTarget,
  Language,
  NoteSelection,
  SavedNoteRegion,
} from "./types";

const SlideViewer = lazy(() => import("./components/SlideViewer").then(
  (module) => ({ default: module.SlideViewer }),
));
const AITutorPanel = lazy(() => import("./components/AITutorPanel").then(
  (module) => ({ default: module.AITutorPanel }),
));
const NotesDrawer = lazy(() => import("./components/NotesDrawer").then(
  (module) => ({ default: module.NotesDrawer }),
));

const LoadingFeature: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-full min-h-40 w-full items-center justify-center gap-2 bg-slate-50 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
    {label}
  </div>
);

export default function App() {
  const [language, setLanguage] = useState<Language>("VI");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [panelOnlyMode, setPanelOnlyMode] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activeTool, setActiveTool] = useState<"read" | "pen" | "highlight">("read");

  const [pdfTotalPages, setPdfTotalPages] = useState<number>(44);
  const [, setPageTexts] = useState<Record<number, string>>({});

  const [selectedContext, setSelectedContext] = useState<ContextSnippet | null>(null);
  const [navigationTarget, setNavigationTarget] =
    useState<EvidenceNavigationTarget | null>(null);
  const [noteSelections, setNoteSelections] = useState<NoteSelection[]>([]);
  const [notes, setNotes] = useState<AINote[]>(() => (
    typeof window === "undefined"
      ? []
      : parseStoredNotes(window.localStorage.getItem(NOTE_STORAGE_KEY))
  ));
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState<boolean>(false);
  const [isNoteSlow, setIsNoteSlow] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteNotice, setNoteNotice] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const savedNoteRegions = useMemo<SavedNoteRegion[]>(() => (
    notes.flatMap((note) => note.selectionBounds.map((bounds) => ({
      noteId: note.id,
      noteTitle: note.title,
      pageNumber: bounds.pageNumber,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    })))
  ), [notes]);

  // Apply dark mode class to root HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    window.localStorage.setItem(
      NOTE_STORAGE_KEY,
      serializeNotes(notes),
    );
  }, [notes]);

  useEffect(() => {
    if (!isGeneratingNote) {
      setIsNoteSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setIsNoteSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isGeneratingNote]);

  useEffect(() => {
    if (!noteNotice) return;
    const timer = window.setTimeout(() => setNoteNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [noteNotice]);

  const handlePDFLoaded = (numPages: number) => {
    if (numPages && numPages > 0) {
      setPdfTotalPages(numPages);
    }
  };

  const handleExtractPageText = (page: number, text: string) => {
    setPageTexts((prev) => ({ ...prev, [page]: text }));
  };

  const handleSelectTextFromSlide = (text: string) => {
    setSelectedContext({
      text,
      pageNumber: currentPage,
      slideTitle: `${DEFAULT_PDF_FILENAME} (Trang ${currentPage})`,
    });
    // Open sidebar if closed on text selection
    setIsSidebarOpen(true);
  };

  const handleClearContext = () => {
    setSelectedContext(null);
  };

  const handleNavigateToEvidence = (
    page: number,
    evidenceQuote?: string,
  ) => {
    const requestId = Date.now();
    setNavigationTarget({
      pageNumber: page,
      evidenceQuote,
      requestId,
    });
    window.setTimeout(() => {
      setNavigationTarget((current) => (
        current?.requestId === requestId ? null : current
      ));
    }, 8500);
    setPanelOnlyMode(false);
    setIsNotesOpen(false);
  };

  const focusSavedNote = (
    noteId: string,
    openDrawer: boolean,
  ) => {
    const viewedAt = new Date().toISOString();
    setFocusedNoteId(noteId);
    setNotes((current) => current.map((note) => (
      note.id === noteId
        ? {
            ...note,
            viewCount: (note.viewCount ?? 0) + 1,
            lastViewedAt: viewedAt,
          }
        : note
    )));
    if (openDrawer) setIsNotesOpen(true);
    window.setTimeout(() => {
      setFocusedNoteId((current) => current === noteId ? null : current);
    }, 8500);
  };

  const handleNavigateToNote = (
    noteId: string,
    page: number,
    evidenceQuote?: string,
  ) => {
    focusSavedNote(noteId, false);
    handleNavigateToEvidence(page, evidenceQuote);
  };

  const handleMergeNotes = (noteIds: string[]) => {
    const selected = notes.filter((note) => noteIds.includes(note.id));
    const now = new Date().toISOString();
    const merged = mergeNotes(
      selected,
      language,
      globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
      now,
    );
    if (!merged) return;
    setNotes((current) => upsertNote(current, merged));
    setFocusedNoteId(merged.id);
    setNoteNotice(
      language === "VI"
        ? `Đã gộp ${selected.length} note mà không tạo thêm kiến thức mới.`
        : `Merged ${selected.length} notes without generating new knowledge.`,
    );
  };

  const handleCreateAINote = async () => {
    const validSelections = noteSelections.filter(
      (selection) => selection.bounds,
    );
    if (validSelections.length === 0 || isGeneratingNote) return;

    setIsGeneratingNote(true);
    setNoteError(null);
    try {
      const response = await fetchWithTimeout("/api/notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: "lesson-01",
          language,
          selections: validSelections.map((selection) => ({
            page: selection.pageNumber,
            text: selection.text,
            x: selection.bounds?.x,
            y: selection.bounds?.y,
            width: selection.bounds?.width,
            height: selection.bounds?.height,
            image_data_url: selection.imageDataUrl,
          })),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          typeof body?.detail === "string"
            ? body.detail
            : "AI Note API error",
        );
      }
      const data = await response.json();
      const now = new Date().toISOString();
      const note: AINote = {
        id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
        docId: "lesson-01",
        title: data.title,
        summary: data.summary,
        keyTakeaways: data.key_takeaways ?? [],
        example: data.example,
        misconception: data.misconception,
        sourcePages: data.source_pages ?? [],
        sourceExcerpts: data.source_excerpts ?? [],
        selectionCount: validSelections.length,
        verifiedSelections: data.verified_selections ?? 0,
        selectionBounds: validSelections
          .filter((selection) => selection.bounds)
          .map((selection) => ({
            pageNumber: selection.pageNumber,
            x: selection.bounds!.x,
            y: selection.bounds!.y,
            width: selection.bounds!.width,
            height: selection.bounds!.height,
          })),
        userText: "",
        provider: data.provider,
        status: data.status,
        viewCount: 0,
        lastViewedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((current) => upsertNote(current, note));
      setFocusedNoteId(note.id);
      setNoteSelections([]);
      setActiveTool("read");
      setIsNotesOpen(true);
    } catch (error) {
      setNoteError(
        error instanceof Error
          ? error.message
          : "Không thể tạo AI Note",
      );
    } finally {
      setIsGeneratingNote(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors relative">
      {/* Top Application Navigation Bar */}
      <HeaderNav
        language={language}
        onLanguageChange={setLanguage}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        panelOnlyMode={panelOnlyMode}
        onTogglePanelOnlyMode={() => setPanelOnlyMode((prev) => !prev)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Document Slide Canvas */}
        {!panelOnlyMode && (
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 relative w-full lg:w-[70%] 2xl:w-[68%] transition-all">
            <DocumentToolbar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              currentPage={currentPage}
              totalPages={pdfTotalPages}
              zoomLevel={zoomLevel}
              onZoomIn={() => setZoomLevel((z) => Math.min(180, z + 10))}
              onZoomOut={() => setZoomLevel((z) => Math.max(70, z - 10))}
              language={language}
              notesCount={notes.length}
              fileName={DEFAULT_PDF_FILENAME}
              selectionCount={noteSelections.length}
              isGeneratingNote={isGeneratingNote}
              onCreateAINote={handleCreateAINote}
              onClearSelections={() => setNoteSelections([])}
              onOpenNotes={() => setIsNotesOpen(true)}
            />

            <FeatureBoundary
              language={language}
              featureName={language === "VI" ? "trình đọc PDF" : "PDF reader"}
            >
              <Suspense
                fallback={
                  <LoadingFeature
                    label={
                      language === "VI"
                        ? "Đang mở trình đọc PDF..."
                        : "Opening PDF reader..."
                    }
                  />
                }
              >
              <SlideViewer
              pdfUrl={DEFAULT_PDF_URL}
              fileName={DEFAULT_PDF_FILENAME}
              currentPage={currentPage}
              totalPages={pdfTotalPages}
              onPageChange={setCurrentPage}
              onSelectText={handleSelectTextFromSlide}
              language={language}
              zoomLevel={zoomLevel}
              activeTool={activeTool}
              onPDFLoaded={handlePDFLoaded}
              onExtractPageText={handleExtractPageText}
              navigationTarget={navigationTarget}
              noteSelections={noteSelections}
              savedNoteRegions={savedNoteRegions}
              focusedNoteId={focusedNoteId}
              onAddNoteSelection={(selection) => {
                setNoteSelections((current) => {
                  if (current.length >= 6) {
                    setNoteError(
                      language === "VI"
                        ? "Mỗi AI Note hỗ trợ tối đa 6 vùng khoanh."
                        : "Each AI Note supports up to 6 regions.",
                    );
                    return current;
                  }
                  setNoteError(null);
                  return [...current, selection];
                });
              }}
              onRemoveNoteSelection={(selectionId) => {
                setNoteSelections((current) => (
                  current.filter((selection) => selection.id !== selectionId)
                ));
              }}
              onOpenSavedNote={(noteId) => focusSavedNote(noteId, true)}
            />
              </Suspense>
            </FeatureBoundary>
          </div>
        )}

        {/* Desktop Divider Toggle Button */}
        {!panelOnlyMode && (
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-l-xl shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            style={{ right: isSidebarOpen ? (panelOnlyMode ? "0px" : "var(--chatbot-width, 30%)") : "0px" }}
            title={isSidebarOpen ? "Thu gọn VLearn Tutor" : "Mở rộng VLearn Tutor"}
          >
            {isSidebarOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Right Side: Responsive VLearn AI Tutor Panel */}
        {isSidebarOpen && (
          <>
            {/* Backdrop for Tablet & Mobile when drawer is open */}
            <div
              className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 animate-in fade-in duration-200"
              onClick={() => setIsSidebarOpen(false)}
            />

            {/* Chatbot Container */}
            <div
              className={
                panelOnlyMode
                  ? "w-full max-w-xl mx-auto border-x border-gray-200 dark:border-slate-800"
                  : `
                    /* Desktop (>1440px): 32%, Laptop (1024-1440px): 30% */
                    hidden lg:flex lg:w-[30%] 2xl:w-[32%] shrink-0 h-full

                    /* Tablet (768-1024px): Right drawer overlay */
                    md:max-lg:flex md:max-lg:fixed md:max-lg:right-0 md:max-lg:top-14 md:max-lg:bottom-0 md:max-lg:w-[380px] md:max-lg:z-50 md:max-lg:shadow-2xl

                    /* Mobile (<768px): Fullscreen Bottom Sheet */
                    max-md:flex max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-12 max-md:z-50 max-md:rounded-t-2xl max-md:shadow-2xl
                  `
              }
            >
              <FeatureBoundary
                language={language}
                featureName="VLearn Tutor"
              >
                <Suspense
                  fallback={
                    <LoadingFeature
                      label={
                        language === "VI"
                          ? "Đang mở VLearn Tutor..."
                          : "Opening VLearn Tutor..."
                      }
                    />
                  }
                >
                <AITutorPanel
                currentPage={currentPage}
                totalPages={pdfTotalPages}
                selectedContext={selectedContext}
                onClearContext={handleClearContext}
                language={language}
                onClose={() => setIsSidebarOpen(false)}
                onNavigateToPage={handleNavigateToEvidence}
                fileName={DEFAULT_PDF_FILENAME}
              />
                </Suspense>
              </FeatureBoundary>
            </div>
          </>
        )}

        {/* Mobile & Tablet Floating AI Launcher Button (Goal 10) */}
        {!isSidebarOpen && !panelOnlyMode && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full p-3.5 shadow-xl flex items-center gap-2 transition-all duration-200 animate-in zoom-in-50 cursor-pointer"
            title="Mở Trợ lý VLearn Tutor"
          >
            <Bot className="w-5 h-5" />
            <span className="text-xs font-semibold pr-1">VLearn Tutor</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
          </button>
        )}
      </div>

      {noteError && (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-xl dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300">
          {noteError}
        </div>
      )}
      {noteNotice && (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-xl dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300">
          {noteNotice}
        </div>
      )}
      {isNoteSlow && (
        <div className="fixed bottom-5 left-1/2 z-[89] -translate-x-1/2 rounded-xl border border-fuchsia-200 bg-white px-4 py-3 text-sm font-semibold text-fuchsia-700 shadow-xl dark:border-fuchsia-900 dark:bg-slate-900 dark:text-fuchsia-300">
          {language === "VI"
            ? "AI đang đọc kỹ các vùng đã khoanh; bạn vẫn có thể tiếp tục xem slide."
            : "AI is carefully reading the selected regions; you can keep viewing slides."}
        </div>
      )}

      {isNotesOpen && (
        <FeatureBoundary
          language={language}
          featureName={language === "VI" ? "Kho AI Note" : "AI Note Library"}
        >
          <Suspense
            fallback={
              <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-md border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <LoadingFeature
                  label={
                    language === "VI"
                      ? "Đang mở kho AI Note..."
                      : "Opening AI Note Library..."
                  }
                />
              </div>
            }
          >
          <NotesDrawer
        open={isNotesOpen}
        notes={notes}
        language={language}
        onClose={() => setIsNotesOpen(false)}
        onDelete={(noteId) => {
          setNotes((current) => (
            current.filter((note) => note.id !== noteId)
          ));
        }}
        onUpdateUserText={(noteId, userText) => {
          setNotes((current) => current.map((note) => (
            note.id === noteId
              ? {
                  ...note,
                  userText,
                  updatedAt: new Date().toISOString(),
                }
              : note
          )));
        }}
        focusedNoteId={focusedNoteId}
        onNavigateToNote={handleNavigateToNote}
        onMerge={handleMergeNotes}
      />
          </Suspense>
        </FeatureBoundary>
      )}
    </div>
  );
}

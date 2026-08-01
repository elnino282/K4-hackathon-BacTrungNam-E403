import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Combine,
  Download,
  ExternalLink,
  Lightbulb,
  Printer,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  notesToMarkdown,
  notesToPrintableHtml,
} from "../lib/noteExport";
import { AINote, Language } from "../types";


interface NotesDrawerProps {
  open: boolean;
  notes: AINote[];
  language: Language;
  onClose: () => void;
  onDelete: (noteId: string) => void;
  onUpdateUserText: (noteId: string, userText: string) => void;
  focusedNoteId?: string | null;
  onNavigateToNote: (
    noteId: string,
    page: number,
    evidenceQuote?: string,
  ) => void;
  onMerge: (noteIds: string[]) => void;
}

export const NotesDrawer: React.FC<NotesDrawerProps> = ({
  open,
  notes,
  language,
  onClose,
  onDelete,
  onUpdateUserText,
  focusedNoteId,
  onNavigateToNote,
  onMerge,
}) => {
  const [query, setQuery] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const noteRefs = useRef(new Map<string, HTMLElement>());
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return notes;
    return notes.filter((note) => (
      [
        note.title,
        note.summary,
        note.userText,
        ...note.keyTakeaways,
        ...note.sourceExcerpts,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized)
    ));
  }, [notes, query]);
  const exportNotes = useMemo(() => (
    selectedNoteIds.length > 0
      ? notes.filter((note) => selectedNoteIds.includes(note.id))
      : filteredNotes
  ), [filteredNotes, notes, selectedNoteIds]);

  useEffect(() => {
    setSelectedNoteIds((current) => current.filter(
      (noteId) => notes.some((note) => note.id === noteId),
    ));
  }, [notes]);

  useEffect(() => {
    if (!open || !focusedNoteId) return;
    const frame = window.requestAnimationFrame(() => {
      noteRefs.current.get(focusedNoteId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusedNoteId]);

  const toggleSelected = (noteId: string) => {
    setSelectedNoteIds((current) => (
      current.includes(noteId)
        ? current.filter((id) => id !== noteId)
        : [...current, noteId]
    ));
  };

  const downloadMarkdown = () => {
    if (exportNotes.length === 0) return;
    const blob = new Blob(
      [notesToMarkdown(exportNotes, language)],
      { type: "text/markdown;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slide2study-notes-${new Date()
      .toISOString()
      .slice(0, 10)}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setActionNotice(
      language === "VI"
        ? `Đã xuất ${exportNotes.length} note thành Markdown.`
        : `Exported ${exportNotes.length} notes to Markdown.`,
    );
  };

  const printNotes = () => {
    if (exportNotes.length === 0) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setActionNotice(
        language === "VI"
          ? "Trình duyệt đang chặn cửa sổ in."
          : "The browser blocked the print window.",
      );
      return;
    }
    printWindow.document.open();
    printWindow.document.write(notesToPrintableHtml(exportNotes, language));
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
    setActionNotice(
      language === "VI"
        ? "Trong cửa sổ in, chọn “Save as PDF” để lưu PDF."
        : "Choose “Save as PDF” in the print dialog.",
    );
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label={language === "VI" ? "Đóng kho ghi chú" : "Close notes"}
        className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <BookOpen className="h-5 w-5 text-fuchsia-600" />
              {language === "VI" ? "Kho AI Note" : "AI Note Library"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {language === "VI"
                ? `${notes.length} ghi chú gắn với nguồn slide`
                : `${notes.length} source-linked notes`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "VI" ? "Đóng kho ghi chú" : "Close notes library"}
            title={language === "VI" ? "Đóng kho ghi chú" : "Close notes library"}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-slate-200 p-3 dark:border-slate-800">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                language === "VI"
                  ? "Tìm theo ý, thuật ngữ hoặc trang..."
                  : "Search ideas, terms or pages..."
              }
              aria-label={
                language === "VI"
                  ? "Tìm kiếm ghi chú"
                  : "Search notes"
              }
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={language === "VI" ? "Xóa tìm kiếm" : "Clear search"}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const filteredIds = filteredNotes.map((note) => note.id);
                const allSelected = filteredIds.length > 0
                  && filteredIds.every((id) => selectedNoteIds.includes(id));
                setSelectedNoteIds(allSelected ? [] : filteredIds);
              }}
              disabled={filteredNotes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {language === "VI" ? "Chọn tất cả" : "Select all"}
            </button>
            <button
              type="button"
              onClick={() => {
                onMerge(selectedNoteIds);
                setSelectedNoteIds([]);
              }}
              disabled={selectedNoteIds.length < 2}
              className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1.5 text-[10px] font-bold text-fuchsia-700 disabled:opacity-40 dark:border-fuchsia-800 dark:bg-fuchsia-950/30 dark:text-fuchsia-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 cursor-pointer"
            >
              <Combine className="h-3.5 w-3.5" />
              {language === "VI"
                ? `Gộp (${selectedNoteIds.length})`
                : `Merge (${selectedNoteIds.length})`}
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              disabled={exportNotes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Markdown
            </button>
            <button
              type="button"
              onClick={printNotes}
              disabled={exportNotes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              {language === "VI" ? "In / PDF" : "Print / PDF"}
            </button>
            <span className="ml-auto text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {selectedNoteIds.length > 0
                ? (
                    language === "VI"
                      ? `${selectedNoteIds.length} đã chọn`
                      : `${selectedNoteIds.length} selected`
                  )
                : (
                    language === "VI"
                      ? "Không chọn = xuất kết quả đang lọc"
                      : "No selection = export filtered"
                  )}
            </span>
          </div>
          {actionNotice && (
            <p className="mt-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              {actionNotice}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {filteredNotes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
              <BookOpen className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" />
              <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {language === "VI"
                  ? "Chưa có ghi chú phù hợp"
                  : "No matching notes"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                {language === "VI"
                  ? "Khoanh vùng bằng Bút AI hoặc bấm “Lưu ý này” trên một ý tóm tắt có nguồn."
                  : "Use the AI Pen or choose “Save this point” on a source-linked summary point."}
              </p>
            </div>
          )}

          {filteredNotes.map((note) => (
            <article
              key={note.id}
              ref={(element) => {
                if (element) noteRefs.current.set(note.id, element);
                else noteRefs.current.delete(note.id);
              }}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition-all dark:bg-slate-800 ${
                focusedNoteId === note.id
                  ? "border-fuchsia-500 ring-4 ring-fuchsia-200/60 dark:ring-fuchsia-900/50"
                  : selectedNoteIds.includes(note.id)
                    ? "border-fuchsia-300 bg-fuchsia-50/30 dark:border-fuchsia-800"
                    : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={() => toggleSelected(note.id)}
                    className="mt-1 h-4 w-4 accent-fuchsia-600"
                    aria-label={
                      language === "VI"
                        ? `Chọn ghi chú ${note.title}`
                        : `Select note ${note.title}`
                    }
                  />
                  <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                      <Sparkles className="h-3 w-3" />
                      {note.status === "fallback"
                        ? (language === "VI" ? "VÙNG ĐÃ LƯU" : "SAVED REGION")
                        : "AI NOTE"}
                    </span>
                    {note.status === "fallback" && (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                        {language === "VI" ? "Bản dự phòng" : "Fallback"}
                      </span>
                    )}
                    {note.status === "merged" && (
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        {language === "VI"
                          ? "Gộp trên thiết bị"
                          : "Merged on device"}
                      </span>
                    )}
                    {note.origin === "selection" && note.status === "generated" && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        note.noteMode === "complete"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}>
                        {note.noteMode === "complete"
                          ? (language === "VI" ? "GHI ĐỦ Ý" : "COMPLETE")
                          : (language === "VI" ? "TÓM TẮT" : "SUMMARY")}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {note.origin === "summary"
                        ? (
                            language === "VI"
                              ? `Lưu từ tóm tắt · nguồn trang ${note.sourcePages.join(", ")}`
                              : `Saved from summary · source page ${note.sourcePages.join(", ")}`
                          )
                        : (
                            language === "VI"
                              ? `${note.selectionCount ?? note.selectionBounds.length} vùng · ${note.verifiedSelections ?? 0} khớp chữ PDF`
                              : `${note.selectionCount ?? note.selectionBounds.length} regions · ${note.verifiedSelections ?? 0} text-matched`
                          )}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                    {note.title}
                  </h3>
                  {note.status === "fallback" && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {note.notice || (
                        language === "VI"
                          ? "AI chưa tạo được ghi chú. Vùng khoanh đã được giữ để bạn thử lại."
                          : "AI could not create this note. The selected region was kept so you can retry."
                      )}
                    </p>
                  )}
                  {(note.viewCount ?? 0) > 0 && (
                    <p className="mt-1 text-[9px] text-slate-400">
                      {language === "VI"
                        ? `Đã mở lại ${note.viewCount} lần`
                        : `Reopened ${note.viewCount} times`}
                    </p>
                  )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  aria-label={
                    language === "VI"
                      ? `Xóa ghi chú: ${note.title}`
                      : `Delete note: ${note.title}`
                  }
                  title={
                    language === "VI"
                      ? `Xóa ghi chú "${note.title}"`
                      : `Delete note "${note.title}"`
                  }
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                {note.summary}
              </p>

              <ul className="mt-3 space-y-1.5">
                {note.keyTakeaways.map((takeaway, index) => (
                  <li
                    key={`${note.id}-takeaway-${index}`}
                    className="flex gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-bold text-fuchsia-600">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>

              {note.example && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                  <p className="mb-1 flex items-center gap-1 font-bold">
                    <Lightbulb className="h-3.5 w-3.5" />
                    {language === "VI"
                      ? "Ví dụ minh họa do AI tạo"
                      : "AI-generated example"}
                  </p>
                  {note.example}
                </div>
              )}

              {note.misconception && (
                <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="mb-1 flex items-center gap-1 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {language === "VI" ? "Dễ hiểu nhầm" : "Common pitfall"}
                  </p>
                  {note.misconception}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {note.sourcePages.map((page, index) => (
                  <button
                    key={`${note.id}-page-${page}`}
                    type="button"
                    onClick={() => onNavigateToNote(
                      note.id,
                      page,
                      note.sourceExcerpts[index] ?? note.sourceExcerpts[0],
                    )}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    {language === "VI" ? `Mở trang ${page}` : `Open page ${page}`}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ))}
              </div>

              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {language === "VI" ? "Ghi chú của tôi" : "My note"}
                </span>
                <textarea
                  value={note.userText}
                  onChange={(event) => (
                    onUpdateUserText(note.id, event.target.value)
                  )}
                  placeholder={
                    language === "VI"
                      ? "Thêm cách hiểu hoặc liên hệ của riêng bạn..."
                      : "Add your own interpretation..."
                  }
                  className="mt-1 min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none focus:border-fuchsia-400 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </article>
          ))}
        </div>
      </aside>
    </>
  );
};

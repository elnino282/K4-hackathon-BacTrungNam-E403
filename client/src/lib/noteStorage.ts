import { AINote } from "../types";


export const NOTE_STORAGE_KEY = "vlearn-slide2study-notes-v1";

export function parseStoredNotes(raw: string | null): AINote[] {
  if (!raw) return [];
  try {
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload)) return [];
    return payload
      .filter((note) => (
        typeof note?.id === "string"
        && typeof note?.title === "string"
        && typeof note?.summary === "string"
        && Array.isArray(note?.sourcePages)
        && Array.isArray(note?.keyTakeaways)
      ))
      .map((note) => {
        const selectionBounds = Array.isArray(note.selectionBounds)
          ? note.selectionBounds.filter((bounds: unknown) => {
              if (!bounds || typeof bounds !== "object") return false;
              const value = bounds as Record<string, unknown>;
              return (
                Number.isInteger(value.pageNumber)
                && typeof value.x === "number"
                && typeof value.y === "number"
                && typeof value.width === "number"
                && typeof value.height === "number"
              );
            })
          : [];
        return {
          ...note,
          docId: typeof note.docId === "string"
            ? note.docId
            : "lesson-01",
          sourceExcerpts: Array.isArray(note.sourceExcerpts)
            ? note.sourceExcerpts
            : [],
          selectionBounds,
          selectionCount: Number.isInteger(note.selectionCount)
            ? note.selectionCount
            : selectionBounds.length,
          verifiedSelections: Number.isInteger(note.verifiedSelections)
            ? note.verifiedSelections
            : 0,
          userText: typeof note.userText === "string" ? note.userText : "",
          provider: typeof note.provider === "string"
            ? note.provider
            : "local",
          status: ["generated", "fallback", "merged"].includes(note.status)
            ? note.status
            : "fallback",
          viewCount: Number.isInteger(note.viewCount) && note.viewCount >= 0
            ? note.viewCount
            : 0,
          lastViewedAt: typeof note.lastViewedAt === "string"
            ? note.lastViewedAt
            : null,
          createdAt: typeof note.createdAt === "string"
            ? note.createdAt
            : new Date(0).toISOString(),
          updatedAt: typeof note.updatedAt === "string"
            ? note.updatedAt
            : new Date(0).toISOString(),
        } as AINote;
      });
  } catch {
    return [];
  }
}

export function serializeNotes(notes: AINote[]): string {
  return JSON.stringify(notes);
}

export function upsertNote(notes: AINote[], nextNote: AINote): AINote[] {
  const existingIndex = notes.findIndex((note) => note.id === nextNote.id);
  if (existingIndex < 0) return [nextNote, ...notes];
  return notes.map((note) => (
    note.id === nextNote.id ? nextNote : note
  ));
}

export function removeNoteRegion(
  notes: AINote[],
  noteId: string,
  regionIndex: number,
  timestamp: string,
): AINote[] {
  return notes.map((note) => {
    if (
      note.id !== noteId
      || regionIndex < 0
      || regionIndex >= note.selectionBounds.length
    ) {
      return note;
    }
    const selectionBounds = note.selectionBounds.filter(
      (_bounds, index) => index !== regionIndex,
    );
    return {
      ...note,
      selectionBounds,
      selectionCount: selectionBounds.length,
      verifiedSelections: Math.min(
        note.verifiedSelections ?? 0,
        selectionBounds.length,
      ),
      updatedAt: timestamp,
    };
  });
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ));
}

export function mergeNotes(
  notes: AINote[],
  language: "VI" | "EN",
  id: string,
  timestamp: string,
): AINote | null {
  if (notes.length < 2) return null;
  const sourcePages = Array.from(
    new Set(notes.flatMap((note) => note.sourcePages)),
  ).sort((left, right) => left - right);
  const titles = uniqueNonEmpty(notes.map((note) => note.title));
  const userSections = notes
    .filter((note) => note.userText.trim())
    .map((note) => `### ${note.title}\n${note.userText.trim()}`);

  return {
    id,
    docId: notes[0].docId,
    title: language === "VI"
      ? `Bộ ghi chú: ${titles.slice(0, 2).join(" · ")}`
      : `Note set: ${titles.slice(0, 2).join(" · ")}`,
    summary: notes
      .map((note) => `${note.title}: ${note.summary}`)
      .join("\n\n"),
    keyTakeaways: uniqueNonEmpty(
      notes.flatMap((note) => note.keyTakeaways),
    ),
    example: uniqueNonEmpty(notes.map((note) => note.example)).join("\n\n")
      || null,
    misconception: uniqueNonEmpty(
      notes.map((note) => note.misconception),
    ).join("\n\n") || null,
    sourcePages,
    sourceExcerpts: uniqueNonEmpty(
      notes.flatMap((note) => note.sourceExcerpts),
    ),
    selectionCount: notes.reduce(
      (total, note) => total + (
        note.selectionCount ?? note.selectionBounds.length
      ),
      0,
    ),
    verifiedSelections: notes.reduce(
      (total, note) => total + (note.verifiedSelections ?? 0),
      0,
    ),
    selectionBounds: notes.flatMap((note) => note.selectionBounds),
    userText: userSections.join("\n\n"),
    provider: "local",
    status: "merged",
    originNoteIds: notes.map((note) => note.id),
    viewCount: 0,
    lastViewedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

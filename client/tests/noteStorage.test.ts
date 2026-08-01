import assert from "node:assert/strict";
import test from "node:test";

import {
  createSummaryPointNote,
  mergeNotes,
  parseStoredNotes,
  removeNoteRegion,
  serializeNotes,
  upsertNote,
} from "../src/lib/noteStorage";
import { AINote } from "../src/types";


const note: AINote = {
  id: "note-1",
  docId: "lesson-01",
  title: "Operational Boundary",
  summary: "Giới hạn hành động của hệ thống.",
  keyTakeaways: ["Điều được phép làm"],
  sourcePages: [24],
  sourceExcerpts: ["Operational Boundary"],
  selectionCount: 1,
  verifiedSelections: 1,
  selectionBounds: [],
  userText: "",
  provider: "gemini",
  status: "generated",
  origin: "selection",
  noteMode: "summary",
  notice: null,
  viewCount: 0,
  lastViewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("ghi và đọc lại AI Note mà không mất nguồn", () => {
  const parsed = parseStoredNotes(serializeNotes([note]));
  assert.deepEqual(parsed, [note]);
});

test("bỏ qua localStorage hỏng hoặc sai schema", () => {
  assert.deepEqual(parseStoredNotes("{broken"), []);
  assert.deepEqual(parseStoredNotes(JSON.stringify([{ id: "bad" }])), []);
});

test("upsert cập nhật note cũ và đưa note mới lên đầu", () => {
  const updated = { ...note, userText: "Ghi chú của tôi" };
  assert.deepEqual(upsertNote([note], updated), [updated]);

  const second = { ...note, id: "note-2", title: "Note mới" };
  assert.deepEqual(upsertNote([note], second), [second, note]);
});

test("tự bổ sung trường còn thiếu cho note từ phiên bản cũ", () => {
  const legacy = {
    id: "legacy",
    title: "Note cũ",
    summary: "Nội dung cũ",
    keyTakeaways: [],
    sourcePages: [2],
  };
  const parsed = parseStoredNotes(JSON.stringify([legacy]));
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].selectionBounds, []);
  assert.equal(parsed[0].selectionCount, 0);
  assert.equal(parsed[0].viewCount, 0);
  assert.equal(parsed[0].status, "fallback");
  assert.equal(parsed[0].origin, "selection");
  assert.equal(parsed[0].noteMode, "summary");
});

test("giữ nguyên chế độ Ghi đủ ý khi lưu và đọc lại", () => {
  const completeNote: AINote = { ...note, noteMode: "complete" };
  const parsed = parseStoredNotes(serializeNotes([completeNote]));
  assert.equal(parsed[0].noteMode, "complete");
});

test("lưu một ý tóm tắt thành note ngắn có nguồn nhưng không tạo vùng PDF giả", () => {
  const saved = createSummaryPointNote(
    {
      claim: "Problem Statement phải có Actor và Success Metric đo được.",
      page: 24,
      source_id: "p024-001",
      evidence_quote: "Actor / Operator ... Success Metric",
      verified: true,
      verification_method: "source_id_exact_source_match",
      section_index: 5,
      section_title: "Khung Problem Statement Cho AI System",
    },
    "Toàn bộ slide (44 trang)",
    "VI",
    "2026-01-02T00:00:00.000Z",
  );

  assert.equal(saved.id, "summary-p024-001-5");
  assert.equal(saved.origin, "summary");
  assert.equal(saved.summary, "Problem Statement phải có Actor và Success Metric đo được.");
  assert.deepEqual(saved.keyTakeaways, []);
  assert.deepEqual(saved.sourcePages, [24]);
  assert.deepEqual(saved.selectionBounds, []);
  assert.match(saved.notice ?? "", /đối chiếu với nguồn slide/);
  assert.equal(upsertNote([saved], { ...saved, updatedAt: "later" }).length, 1);
});

test("gộp note giữ nguyên nguồn và không xóa note gốc", () => {
  const second = {
    ...note,
    id: "note-2",
    title: "Success Metric",
    sourcePages: [25],
    sourceExcerpts: ["Success Metric"],
    keyTakeaways: ["Ngưỡng thành công"],
    userText: "Tự diễn giải",
  };
  const merged = mergeNotes(
    [note, second],
    "VI",
    "merged-1",
    "2026-01-02T00:00:00.000Z",
  );
  assert.ok(merged);
  assert.equal(merged.status, "merged");
  assert.equal(merged.origin, "merged");
  assert.deepEqual(merged.sourcePages, [24, 25]);
  assert.deepEqual(merged.originNoteIds, ["note-1", "note-2"]);
  assert.match(merged.userText, /Tự diễn giải/);
});

test("xóa một vùng trên PDF nhưng vẫn giữ nội dung note", () => {
  const noteWithRegions: AINote = {
    ...note,
    selectionCount: 2,
    verifiedSelections: 2,
    selectionBounds: [
      {
        pageNumber: 24,
        x: 0.1,
        y: 0.1,
        width: 0.2,
        height: 0.2,
      },
      {
        pageNumber: 25,
        x: 0.2,
        y: 0.2,
        width: 0.3,
        height: 0.3,
      },
    ],
  };
  const updated = removeNoteRegion(
    [noteWithRegions],
    noteWithRegions.id,
    0,
    "2026-01-03T00:00:00.000Z",
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, noteWithRegions.id);
  assert.equal(updated[0].summary, noteWithRegions.summary);
  assert.equal(updated[0].selectionBounds.length, 1);
  assert.equal(updated[0].selectionBounds[0].pageNumber, 25);
  assert.equal(updated[0].selectionCount, 1);
  assert.equal(updated[0].verifiedSelections, 1);
});

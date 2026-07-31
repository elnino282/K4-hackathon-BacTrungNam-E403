import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeNotes,
  parseStoredNotes,
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
  provider: "xah",
  status: "generated",
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
  assert.deepEqual(merged.sourcePages, [24, 25]);
  assert.deepEqual(merged.originNoteIds, ["note-1", "note-2"]);
  assert.match(merged.userText, /Tự diễn giải/);
});

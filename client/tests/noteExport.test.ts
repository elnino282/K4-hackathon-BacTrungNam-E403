import assert from "node:assert/strict";
import test from "node:test";

import {
  notesToMarkdown,
  notesToPrintableHtml,
} from "../src/lib/noteExport";
import { AINote } from "../src/types";


const note: AINote = {
  id: "note-export",
  docId: "lesson-01",
  title: "Impact <script>alert(1)</script>",
  summary: "Tác động phải đo được.",
  keyTakeaways: ["Dùng thời gian hoặc chi phí"],
  example: "Ví dụ do AI tạo.",
  misconception: "Không nhầm output với impact.",
  sourcePages: [24],
  sourceExcerpts: ["Impact"],
  selectionCount: 1,
  verifiedSelections: 1,
  selectionBounds: [],
  userText: "Liên hệ của tôi.",
  provider: "xah",
  status: "generated",
  viewCount: 0,
  lastViewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("Markdown giữ nguồn và phân biệt ví dụ AI", () => {
  const markdown = notesToMarkdown([note], "VI");
  assert.match(markdown, /Trang 24/);
  assert.match(markdown, /Ví dụ minh họa do AI tạo/);
  assert.match(markdown, /Ghi chú của tôi/);
});

test("bản in escape HTML từ nội dung note", () => {
  const html = notesToPrintableHtml([note], "VI");
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /Save as PDF/);
});

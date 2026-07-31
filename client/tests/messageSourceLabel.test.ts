import assert from "node:assert/strict";
import test from "node:test";

import { getMessageSourceLabel } from "../src/lib/messageSourceLabel";


test("nhãn câu trả lời tiếp nối giữ phạm vi 6–9 dù người dùng đang mở trang 7", () => {
  assert.equal(
    getMessageSourceLabel({
      learningPages: [6, 7, 8, 9],
      fallbackPage: 7,
      language: "VI",
    }),
    "Nội dung bài học Trang 6–9",
  );
});

test("mô tả phạm vi của bản tóm tắt được ưu tiên", () => {
  assert.equal(
    getMessageSourceLabel({
      scopeDescription: "Trang 6–9",
      learningPages: [6, 7, 8, 9],
      fallbackPage: 7,
      language: "VI",
    }),
    "Trang 6–9",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  getReferencedPage,
  getSummaryScope,
  normalizeForIntent,
  parseSummaryIntent,
} from "../src/lib/summaryIntent.ts";

test("nhận đúng câu lỗi thực tế và chọn trang 7 thay vì trang đang mở", () => {
  const message = "Tóm tắm ý chính trong slide 7";

  assert.equal(getReferencedPage(message), 7);
  assert.deepEqual(getSummaryScope(message, 5), { current_page: 7 });
});

test("nhận đúng yêu cầu tóm tắt một khoảng trang", () => {
  assert.deepEqual(getSummaryScope("Tóm tắt slide 7 và 8", 5), {
    start_page: 7,
    end_page: 8,
  });
  assert.deepEqual(getSummaryScope("Tóm tắt slide 7, 8 và 9", 5), {
    start_page: 7,
    end_page: 9,
  });
  assert.deepEqual(getSummaryScope("Summarize slides 7 to 9", 5), {
    start_page: 7,
    end_page: 9,
  });
  assert.deepEqual(getSummaryScope("Tóm tắt trang 6 7 8 và 9", 5), {
    start_page: 6,
    end_page: 9,
  });
});

test("nhận đúng yêu cầu tóm tắt toàn bộ và trang mặc định", () => {
  assert.deepEqual(getSummaryScope("Tóm tắt hết", 5), {});
  assert.deepEqual(getSummaryScope("Tóm tắt ý chính slide này", 5), {
    current_page: 5,
  });
});

test("không đẩy câu hỏi thông thường vào luồng tóm tắt", () => {
  assert.equal(getSummaryScope("Slide 7 nói về điều gì?", 5), null);
  assert.equal(getReferencedPage("Slide 7 nói về điều gì?"), 7);
});

test("chuẩn hóa đầy đủ dấu tiếng Việt, kể cả chữ đ", () => {
  assert.equal(
    normalizeForIntent("Tóm tắt từ Trang 8 ĐẾN trang 7"),
    "tom tat tu trang 8 den trang 7",
  );
});

test("nhận số thứ tự nhưng không biến số âm hoặc số thập phân thành trang hợp lệ", () => {
  assert.equal(getReferencedPage("Tóm tắt slide thứ 7"), 7);
  assert.equal(getReferencedPage("Tóm tắt slide -1"), null);
  assert.equal(
    parseSummaryIntent("Tóm tắt slide -1", 5, 44).kind,
    "invalid",
  );
  assert.equal(
    parseSummaryIntent("Tóm tắt slide 7.5", 5, 44).kind,
    "invalid",
  );
});

test("chặn trang ngoài tài liệu, khoảng ngược và danh sách không liên tiếp", () => {
  assert.equal(
    parseSummaryIntent("Tóm tắt slide 45", 5, 44).kind,
    "invalid",
  );
  assert.equal(
    parseSummaryIntent("Tóm tắt từ trang 8 đến trang 7", 5, 44).kind,
    "invalid",
  );
  assert.equal(
    parseSummaryIntent("Tóm tắt slide 7 và 9", 5, 44).kind,
    "invalid",
  );
  assert.equal(
    parseSummaryIntent("Tóm tắt trang 6 8 9", 5, 44).kind,
    "invalid",
  );
});

test("chặn phạm vi có điều kiện loại trừ thay vì âm thầm bỏ qua", () => {
  const result = parseSummaryIntent(
    "Tóm tắt toàn bộ trừ phụ lục",
    5,
    44,
  );
  assert.equal(result.kind, "invalid");
});

test("resolves Vietnamese last-slide summaries to the document's final page", () => {
  const result = parseSummaryIntent("Tóm tắt slide cuối", 5, 44);

  assert.deepEqual(result, {
    kind: "valid",
    scope: { current_page: 44 },
  });
  assert.equal(getReferencedPage("Trang cuối nói về gì?", 44), 44);
});

test("resolves English last-slide and final-page references", () => {
  assert.deepEqual(
    parseSummaryIntent("Summarize the final slide", 5, 44),
    { kind: "valid", scope: { current_page: 44 } },
  );
  assert.equal(getReferencedPage("What is on the last page?", 44), 44);
});

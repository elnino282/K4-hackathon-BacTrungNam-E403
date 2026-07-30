import assert from "node:assert/strict";
import test from "node:test";

import {
  getReferencedPage,
  getSummaryScope,
  normalizeForIntent,
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
  assert.deepEqual(getSummaryScope("Tóm tắt từ trang 8 đến trang 7", 5), {
    start_page: 7,
    end_page: 8,
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

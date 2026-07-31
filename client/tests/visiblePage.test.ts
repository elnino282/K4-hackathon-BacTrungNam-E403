import assert from "node:assert/strict";
import test from "node:test";

import { getMostVisiblePage } from "../src/lib/visiblePage.ts";

test("chọn slide có nhiều diện tích hiển thị nhất", () => {
  assert.equal(
    getMostVisiblePage(100, 900, [
      { pageNumber: 7, top: -120, bottom: 380 },
      { pageNumber: 8, top: 410, bottom: 1080 },
    ]),
    8,
  );
});

test("khi diện tích bằng nhau thì chọn slide gần tâm viewport hơn", () => {
  assert.equal(
    getMostVisiblePage(0, 800, [
      { pageNumber: 6, top: -300, bottom: 300 },
      { pageNumber: 7, top: 500, bottom: 1100 },
    ]),
    6,
  );
});

test("không chọn trang nằm ngoài viewport", () => {
  assert.equal(
    getMostVisiblePage(0, 800, [
      { pageNumber: 5, top: -900, bottom: -100 },
      { pageNumber: 6, top: 900, bottom: 1500 },
    ]),
    null,
  );
});

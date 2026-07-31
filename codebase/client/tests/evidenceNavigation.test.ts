import assert from "node:assert/strict";
import test from "node:test";

import {
  findEvidenceSpanRange,
  normalizeEvidenceNavigationText,
} from "../src/lib/evidenceNavigation";

test("chuẩn hóa khoảng trắng, dấu ngoặc và dấu gạch khi tìm nguồn", () => {
  assert.equal(
    normalizeEvidenceNavigationText("  “AI   Product” — Gate  "),
    '"ai product" - gate',
  );
});

test("tìm đúng chuỗi span chứa dẫn chứng", () => {
  const range = findEvidenceSpanRange(
    [
      "Tiêu đề",
      "Actor / Operator",
      "Current Workflow",
      "Bottleneck và Impact",
      "Success Metric",
    ],
    "Current Workflow Bottleneck và Impact",
  );

  assert.deepEqual(range, { startIndex: 2, endIndex: 3 });
});

test("dùng phần đầu đủ dài khi toàn bộ passage không nằm liền trong text layer", () => {
  const range = findEvidenceSpanRange(
    [
      "Đúng architecture là quyết định quan trọng hơn đúng model.",
      "Bắt đầu từ rule / workflow trước khi nhảy lên agent.",
    ],
    (
      "Đúng architecture là quyết định quan trọng hơn đúng model. " +
      "Bắt đầu từ rule / workflow trước khi nhảy lên agent. " +
      "Phần tiếp theo nằm ở cột khác."
    ),
  );

  assert.deepEqual(range, { startIndex: 0, endIndex: 1 });
});

test("không tô nhầm khi không tìm thấy dẫn chứng", () => {
  assert.equal(
    findEvidenceSpanRange(["Nội dung thật của slide"], "Dẫn chứng bị bịa"),
    null,
  );
});

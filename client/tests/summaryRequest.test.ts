import assert from "node:assert/strict";
import test from "node:test";

import { parseSummaryIntent } from "../src/lib/summaryIntent";
import {
  buildSummaryApiRequest,
  getSummaryScopePages,
} from "../src/lib/summaryRequest";


test("request 7, 8, 9 chỉ chứa các trường backend cho phép", () => {
  const intent = parseSummaryIntent(
    "Tóm tắt trang 7, 8 và 9",
    9,
    44,
  );
  assert.equal(intent.kind, "valid");
  if (intent.kind !== "valid") return;

  const request = buildSummaryApiRequest(intent.scope, "VI", "study");
  assert.deepEqual(request, {
    doc_id: "lesson-01",
    start_page: 7,
    end_page: 9,
    language: "VI",
    depth: "study",
  });
  assert.equal("context_pages" in request, false);
  assert.equal("prior_answer" in request, false);
});

test("request 7 và 8 tạo đúng khoảng liên tiếp", () => {
  const intent = parseSummaryIntent(
    "Tóm tắt trang 7 và 8",
    9,
    44,
  );
  assert.equal(intent.kind, "valid");
  if (intent.kind !== "valid") return;

  assert.deepEqual(
    buildSummaryApiRequest(intent.scope, "VI", "standard"),
    {
      doc_id: "lesson-01",
      start_page: 7,
      end_page: 8,
      language: "VI",
      depth: "standard",
    },
  );
});

test("giữ đủ trang nguồn cho câu hỏi tiếp nối của khoảng 6 đến 9", () => {
  assert.deepEqual(
    getSummaryScopePages({ start_page: 6, end_page: 9 }),
    [6, 7, 8, 9],
  );
});

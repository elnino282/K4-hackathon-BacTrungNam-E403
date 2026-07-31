import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldOfferRemediation,
  shouldOfferUnderstandingCheck,
  shouldShowSummaryFollowUps,
} from "../src/lib/learningExperience";


test("chế độ Chuẩn chỉ tóm tắt, không mời kiểm tra hay hỏi tiếp", () => {
  assert.equal(shouldOfferUnderstandingCheck("standard", true), false);
  assert.equal(shouldShowSummaryFollowUps("standard"), false);
});

test("chế độ Học sâu cho phép kiểm tra khi ý có nguồn", () => {
  assert.equal(shouldOfferUnderstandingCheck("study", true), true);
  assert.equal(shouldOfferUnderstandingCheck("study", false), false);
  assert.equal(shouldShowSummaryFollowUps("study"), true);
});

test("chỉ đề nghị giải thích sâu và ví dụ khi người học chưa hiểu đủ", () => {
  assert.equal(shouldOfferRemediation("correct"), false);
  assert.equal(shouldOfferRemediation("partial"), true);
  assert.equal(shouldOfferRemediation("incorrect"), true);
});

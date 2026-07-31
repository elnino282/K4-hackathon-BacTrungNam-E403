import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTutorApiRequest,
  resolveTutorLearningContext,
} from "../src/lib/tutorRequest";


test("câu hỏi tiếp nối gửi đủ các trang của bản tóm tắt trước", () => {
  const request = buildTutorApiRequest({
    message: "Giải thích dễ hiểu hơn",
    pageContext: 6,
    slideTitle: "Day02.pdf (Trang 6–9)",
    language: "VI",
    learningContext: {
      pages: [6, 7, 8, 9],
      priorAnswer: "Bản tóm tắt của trang 6 đến 9",
    },
  });

  assert.deepEqual(request.context_pages, [6, 7, 8, 9]);
  assert.equal(request.prior_answer, "Bản tóm tắt của trang 6 đến 9");
});

test("câu hỏi độc lập không gửi ngữ cảnh giả", () => {
  const request = buildTutorApiRequest({
    message: "Slide này nói về gì?",
    pageContext: 6,
    slideTitle: "Day02.pdf (Slide 6)",
    language: "VI",
  });

  assert.equal("context_pages" in request, false);
  assert.equal("prior_answer" in request, false);
});

test("câu hỏi gõ tay tiếp nối tự dùng phạm vi của phản hồi trước", () => {
  const previousContext = {
    pages: [6, 7, 8, 9],
    priorAnswer: "Bản tóm tắt trước",
  };

  assert.deepEqual(
    resolveTutorLearningContext({
      previousContext,
      hasSelectedText: false,
      referencedPage: null,
      isSummaryRequest: false,
    }),
    previousContext,
  );
  assert.equal(
    resolveTutorLearningContext({
      previousContext,
      hasSelectedText: false,
      referencedPage: 12,
      isSummaryRequest: false,
    }),
    undefined,
  );
});

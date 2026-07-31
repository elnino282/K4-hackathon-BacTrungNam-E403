import fs from "node:fs";

import {
  getReferencedPage,
  parseSummaryIntent,
} from "../client/src/lib/summaryIntent.ts";
import {
  buildTutorApiRequest,
  resolveTutorLearningContext,
} from "../client/src/lib/tutorRequest.ts";
import { getMessageSourceLabel } from "../client/src/lib/messageSourceLabel.ts";
import {
  shouldOfferRemediation,
  shouldOfferUnderstandingCheck,
  shouldShowSummaryFollowUps,
} from "../client/src/lib/learningExperience.ts";
import {
  mergeNotes,
  removeNoteRegion,
} from "../client/src/lib/noteStorage.ts";
import { AINote, LearningContext } from "../client/src/types.ts";


interface ProductCase {
  id: string;
  category: string;
  action: string;
  title: string;
  origin: string;
  origin_reference?: string | null;
  difficulty: string;
  priority: string;
  user_input: string;
  current_page?: number;
  total_pages?: number;
  previous_context?: LearningContext;
  expected: Record<string, unknown>;
}

interface EvaluationResult {
  id: string;
  category: string;
  action: string;
  title: string;
  origin: string;
  origin_reference?: string | null;
  difficulty: string;
  priority: string;
  passed: boolean;
  checks: Record<string, boolean>;
  duration_ms: number;
  current_behavior: string;
  actual: unknown;
  error?: string;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function baseResult(
  productCase: ProductCase,
  checks: Record<string, boolean>,
  actual: unknown,
  currentBehavior: string,
  durationMs: number,
): EvaluationResult {
  return {
    id: productCase.id,
    category: productCase.category,
    action: productCase.action,
    title: productCase.title,
    origin: productCase.origin,
    origin_reference: productCase.origin_reference,
    difficulty: productCase.difficulty,
    priority: productCase.priority,
    passed: Object.values(checks).every(Boolean),
    checks,
    duration_ms: durationMs,
    current_behavior: currentBehavior,
    actual,
  };
}

function evaluateSummaryRequest(productCase: ProductCase): EvaluationResult {
  const started = performance.now();
  const actual = parseSummaryIntent(
    productCase.user_input,
    productCase.current_page ?? 1,
    productCase.total_pages ?? 44,
  );
  const expectedKind = productCase.expected.intent_kind;
  const checks: Record<string, boolean> = {
    nhan_dung_loai_yeu_cau: actual.kind === expectedKind,
  };
  if (expectedKind === "valid") {
    checks.pham_vi_trang_chinh_xac =
      actual.kind === "valid"
      && sameValue(actual.scope, productCase.expected.scope);
  }

  const behavior = actual.kind === "valid"
    ? `Nhận là yêu cầu tóm tắt với phạm vi ${JSON.stringify(actual.scope)}.`
    : actual.kind === "invalid"
      ? `Từ chối yêu cầu: ${actual.error}`
      : "Không nhận đây là yêu cầu tóm tắt.";
  return baseResult(
    productCase,
    checks,
    actual,
    behavior,
    Math.round(performance.now() - started),
  );
}

function evaluateFollowupContext(productCase: ProductCase): EvaluationResult {
  const started = performance.now();
  const referencedPage = getReferencedPage(productCase.user_input);
  const summaryIntent = parseSummaryIntent(
    productCase.user_input,
    productCase.current_page ?? 1,
    44,
  );
  const learningContext = resolveTutorLearningContext({
    previousContext: productCase.previous_context,
    hasSelectedText: false,
    referencedPage,
    isSummaryRequest: summaryIntent.kind === "valid",
  });
  const pageContext =
    referencedPage
    ?? learningContext?.pages[0]
    ?? productCase.current_page
    ?? 1;
  const request = buildTutorApiRequest({
    message: productCase.user_input,
    pageContext,
    slideTitle: `Tài liệu học (Slide ${pageContext})`,
    language: "VI",
    learningContext,
  });
  const assistantPages = learningContext?.pages ?? [pageContext];
  const sourceLabel = getMessageSourceLabel({
    learningPages: assistantPages,
    fallbackPage: productCase.current_page ?? pageContext,
    language: "VI",
  });
  const expectedPages = productCase.expected.context_pages as number[];
  const actualPages = request.context_pages ?? [];
  const checks = {
    giu_dung_cac_trang_nguon: sameValue(actualPages, expectedPages),
    trang_chinh_dung:
      request.page_context === productCase.expected.page_context,
    nhan_nguon_khong_lech_slide:
      sourceLabel === productCase.expected.source_label,
    giu_dung_phan_hoi_truoc:
      Boolean(request.prior_answer)
      === productCase.expected.prior_answer_sent,
  };
  const actual = {
    context_pages: actualPages,
    page_context: request.page_context,
    source_label: sourceLabel,
    prior_answer_sent: Boolean(request.prior_answer),
  };
  return baseResult(
    productCase,
    checks,
    actual,
    `Gửi nguồn [${actualPages.join(", ")}], trang chính ${pageContext}, nhãn “${sourceLabel}”.`,
    Math.round(performance.now() - started),
  );
}

function evaluateLearningModes(productCase: ProductCase): EvaluationResult {
  const started = performance.now();
  const actual = {
    standard_has_quiz: shouldOfferUnderstandingCheck("standard", true),
    standard_has_followups: shouldShowSummaryFollowUps("standard"),
    study_has_quiz: shouldOfferUnderstandingCheck("study", true),
    correct_has_remediation: shouldOfferRemediation("correct"),
    partial_has_remediation: shouldOfferRemediation("partial"),
    incorrect_has_remediation: shouldOfferRemediation("incorrect"),
  };
  const checks = Object.fromEntries(
    Object.entries(productCase.expected).map(([key, value]) => [
      key,
      actual[key as keyof typeof actual] === value,
    ]),
  );
  return baseResult(
    productCase,
    checks,
    actual,
    (
      "Chuẩn không hiện bài kiểm tra; Học sâu có bài kiểm tra; "
      + "hỗ trợ sâu chỉ hiện khi trả lời thiếu hoặc sai."
    ),
    Math.round(performance.now() - started),
  );
}

function makeNote(
  id: string,
  page: number,
  title: string,
  summary: string,
): AINote {
  return {
    id,
    docId: "lesson-01",
    title,
    summary,
    keyTakeaways: [summary],
    example: null,
    misconception: null,
    sourcePages: [page],
    sourceExcerpts: [summary],
    selectionCount: 1,
    verifiedSelections: 1,
    selectionBounds: [
      {
        pageNumber: page,
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.1,
      },
    ],
    userText: "",
    provider: "gemini",
    status: "generated",
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  };
}

function evaluateRemoveMarker(productCase: ProductCase): EvaluationResult {
  const started = performance.now();
  const note = makeNote(
    "note-24",
    24,
    "Khung Problem Statement",
    "Actor và Success Metric phải rõ.",
  );
  note.selectionBounds.push({
    pageNumber: 24,
    x: 0.1,
    y: 0.5,
    width: 0.5,
    height: 0.1,
  });
  note.selectionCount = 2;
  note.verifiedSelections = 2;
  const result = removeNoteRegion(
    [note],
    note.id,
    0,
    "2026-07-31T01:00:00.000Z",
  );
  const actual = {
    note_still_exists: result.length === 1,
    summary_unchanged: result[0]?.summary === note.summary,
    remaining_markers: result[0]?.selectionBounds.length ?? 0,
  };
  const checks = Object.fromEntries(
    Object.entries(productCase.expected).map(([key, value]) => [
      key,
      actual[key as keyof typeof actual] === value,
    ]),
  );
  return baseResult(
    productCase,
    checks,
    actual,
    "Đã bỏ một marker; note và phần giải thích vẫn còn trong kho.",
    Math.round(performance.now() - started),
  );
}

function evaluateMergeNotes(productCase: ProductCase): EvaluationResult {
  const started = performance.now();
  const notes = [
    makeNote("note-20", 20, "AI-Fit", "Chấm Determinism và Volume."),
    makeNote("note-21", 21, "AI Readiness", "Kiểm tra Value và Baseline."),
  ];
  const before = JSON.stringify(notes);
  const merged = mergeNotes(
    notes,
    "VI",
    "merged-20-21",
    "2026-07-31T01:00:00.000Z",
  );
  const actual = {
    source_pages: merged?.sourcePages ?? [],
    origin_note_count: merged?.originNoteIds?.length ?? 0,
    original_notes_unchanged: JSON.stringify(notes) === before,
  };
  const checks = Object.fromEntries(
    Object.entries(productCase.expected).map(([key, value]) => [
      key,
      sameValue(actual[key as keyof typeof actual], value),
    ]),
  );
  return baseResult(
    productCase,
    checks,
    actual,
    `Note gộp giữ nguồn trang ${(merged?.sourcePages ?? []).join(", ")} và không sửa note gốc.`,
    Math.round(performance.now() - started),
  );
}

function evaluateCase(productCase: ProductCase): EvaluationResult | null {
  try {
    if (productCase.action === "summary_request") {
      return evaluateSummaryRequest(productCase);
    }
    if (productCase.action === "followup_context") {
      return evaluateFollowupContext(productCase);
    }
    if (productCase.action === "learning_modes") {
      return evaluateLearningModes(productCase);
    }
    if (productCase.action === "note_remove_marker") {
      return evaluateRemoveMarker(productCase);
    }
    if (productCase.action === "note_merge") {
      return evaluateMergeNotes(productCase);
    }
    return null;
  } catch (error) {
    return {
      id: productCase.id,
      category: productCase.category,
      action: productCase.action,
      title: productCase.title,
      origin: productCase.origin,
      origin_reference: productCase.origin_reference,
      difficulty: productCase.difficulty,
      priority: productCase.priority,
      passed: false,
      checks: { khong_phat_sinh_loi: false },
      duration_ms: 0,
      current_behavior: "Ca đánh giá phát sinh lỗi.",
      actual: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const casesPath = process.argv[2];
if (!casesPath) {
  throw new Error("Thiếu đường dẫn product-cases.json");
}
const productCases = JSON.parse(
  fs.readFileSync(casesPath, "utf8"),
) as ProductCase[];
const results = productCases
  .map(evaluateCase)
  .filter((result): result is EvaluationResult => result !== null);
process.stdout.write(JSON.stringify(results));

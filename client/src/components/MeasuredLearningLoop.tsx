import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";

import {
  LEARNING_METRICS_STORAGE_KEY,
  parseLearningMeasurements,
  serializeLearningMeasurements,
  setLearningMeasurementHelpful,
  upsertLearningMeasurement,
} from "../lib/learningMetrics";
import { fetchWithTimeout } from "../lib/apiClient";
import {
  AssessmentVerdict,
  Language,
  LearningMeasurementRecord,
  SummaryKeyPointData,
} from "../types";


interface MeasuredLearningLoopProps {
  point: SummaryKeyPointData;
  language: Language;
  onNavigateToPage?: (page: number, evidenceQuote?: string) => void;
  onComplete?: (record: LearningMeasurementRecord) => void;
  onViewSummary: () => void;
}

interface AssessmentData {
  assessment_id: string;
  pre_question: string;
  post_question: string;
  source_page: number;
  provider: string;
  status: "generated" | "fallback";
  notice?: string | null;
}

interface EvaluationData {
  verdict: AssessmentVerdict;
  score: 0 | 50 | 100;
  feedback: string;
  next_step: string;
  source_page: number;
}

type LearningStage = "pre" | "learn" | "post" | "result";


async function responseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Phản hồi không phải JSON.
  }
  return `${fallback} (${response.status})`;
}

const SCORE_CLASSES: Record<AssessmentVerdict, string> = {
  correct: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
  partial: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  incorrect: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200",
};


export const MeasuredLearningLoop: React.FC<MeasuredLearningLoopProps> = ({
  point,
  language,
  onNavigateToPage,
  onComplete,
  onViewSummary,
}) => {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [stage, setStage] = useState<LearningStage>("pre");
  const [preAnswer, setPreAnswer] = useState("");
  const [postAnswer, setPostAnswer] = useState("");
  const [preEvaluation, setPreEvaluation] =
    useState<EvaluationData | null>(null);
  const [postEvaluation, setPostEvaluation] =
    useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sourceOpenCount, setSourceOpenCount] = useState(0);
  const [completedRecord, setCompletedRecord] =
    useState<LearningMeasurementRecord | null>(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setAssessment(null);
    setStage("pre");
    setPreAnswer("");
    setPostAnswer("");
    setPreEvaluation(null);
    setPostEvaluation(null);
    setSourceOpenCount(0);
    setCompletedRecord(null);
    startedAtRef.current = Date.now();

    fetchWithTimeout("/api/study/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: "lesson-01",
        language,
        source: {
          page: point.page,
          claim: point.claim,
          evidence_quote: point.evidence_quote,
        },
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseError(response, "Assessment API error"),
          );
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setAssessment(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Không thể tạo bài đo",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [point.page, point.claim, point.evidence_quote, language, attempt]);

  const evaluate = async (
    activeStage: "pre" | "post",
    question: string,
    answer: string,
  ) => {
    if (!assessment || !answer.trim() || isEvaluating) return;
    setIsEvaluating(true);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/study/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: "lesson-01",
          language,
          assessment_id: assessment.assessment_id,
          stage: activeStage,
          question,
          answer: answer.trim(),
          source: {
            page: point.page,
            claim: point.claim,
            evidence_quote: point.evidence_quote,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Evaluate API error"));
      }
      const result = await response.json() as EvaluationData;
      if (activeStage === "pre") {
        setPreEvaluation(result);
        setStage("learn");
      } else {
        setPostEvaluation(result);
        setStage("result");
        if (preEvaluation) {
          const completedAt = new Date().toISOString();
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - startedAtRef.current) / 1000),
          );
          const record: LearningMeasurementRecord = {
            id: assessment.assessment_id,
            docId: "lesson-01",
            page: point.page,
            claim: point.claim,
            preScore: preEvaluation.score,
            postScore: result.score,
            delta: result.score - preEvaluation.score,
            durationSeconds,
            sourceOpenCount,
            helpful: null,
            provider: assessment.provider,
            completedAt,
          };
          setCompletedRecord(record);
          try {
            const storedRecords = parseLearningMeasurements(
              window.localStorage.getItem(LEARNING_METRICS_STORAGE_KEY),
            );
            window.localStorage.setItem(
              LEARNING_METRICS_STORAGE_KEY,
              serializeLearningMeasurements(
                upsertLearningMeasurement(storedRecords, record),
              ),
            );
            window.dispatchEvent(
              new Event("vlearn-learning-metrics-updated"),
            );
          } catch {
            // Trình duyệt có thể chặn localStorage; kết quả vẫn hiện trong phiên.
          }
          onComplete?.(record);
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể chấm câu trả lời",
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-center text-sm font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {language === "VI"
            ? "Đang chuẩn bị hai câu hỏi tương đương..."
            : "Preparing two equivalent questions..."}
        </div>
        <span className="text-[10px] font-normal text-violet-600/80 dark:text-violet-300/80">
          {language === "VI"
            ? "API thật thường cần khoảng 10–30 giây."
            : "The live API usually needs about 10–30 seconds."}
        </span>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        <p>{error}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-current px-3 py-1.5 font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {language === "VI" ? "Thử lại" : "Retry"}
          </button>
          <button
            type="button"
            onClick={onViewSummary}
            className="rounded-lg px-3 py-1.5 font-bold"
          >
            {language === "VI" ? "Xem tóm tắt" : "View summary"}
          </button>
        </div>
      </div>
    );
  }

  const currentStep = stage === "pre" ? 1 : stage === "learn" ? 2 : 3;
  const delta = postEvaluation && preEvaluation
    ? postEvaluation.score - preEvaluation.score
    : 0;
  const verdictLabel = (evaluation: EvaluationData) => ({
    correct: language === "VI" ? "Hiểu đúng" : "Understood",
    partial: language === "VI" ? "Đúng một phần" : "Partly correct",
    incorrect: language === "VI" ? "Chưa đúng" : "Not yet",
  })[evaluation.verdict];

  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 bg-linear-to-br from-white to-violet-50/70 p-4 shadow-sm dark:border-violet-800 dark:from-slate-900 dark:to-violet-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
            <TrendingUp className="h-4 w-4" />
            {language === "VI"
              ? "Đo thay đổi mức hiểu"
              : "Measure learning change"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {language === "VI"
              ? `Cùng một kiến thức · Trang ${point.page} · khoảng 2 phút`
              : `Same concept · Page ${point.page} · about 2 minutes`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((stepNumber) => (
            <span
              key={stepNumber}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                stepNumber < currentStep || stage === "result"
                  ? "bg-emerald-500 text-white"
                  : stepNumber === currentStep
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}
            >
              {stepNumber < currentStep || stage === "result" ? "✓" : stepNumber}
            </span>
          ))}
        </div>
      </div>

      {assessment.notice && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {assessment.notice}
        </p>
      )}

      {stage === "pre" && (
        <QuestionStep
          label={language === "VI" ? "Bước 1 · Trước khi học" : "Step 1 · Before study"}
          explanation={
            language === "VI"
              ? "Nội dung tóm tắt đang được giữ kín để điểm ban đầu có ý nghĩa."
              : "The summary stays hidden so the baseline remains meaningful."
          }
          question={assessment.pre_question}
          answer={preAnswer}
          onAnswerChange={setPreAnswer}
          onSubmit={() => evaluate(
            "pre",
            assessment.pre_question,
            preAnswer,
          )}
          isEvaluating={isEvaluating}
          language={language}
        />
      )}

      {stage === "learn" && preEvaluation && (
        <div className="space-y-3">
          <EvaluationStrip
            label={language === "VI" ? "Điểm ban đầu" : "Baseline"}
            evaluation={preEvaluation}
            verdictLabel={verdictLabel(preEvaluation)}
          />
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              <BookOpenCheck className="h-4 w-4" />
              {language === "VI" ? "Bước 2 · Học nhanh" : "Step 2 · Quick study"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
              {point.claim}
            </p>
            <blockquote className="mt-2 rounded-lg border-l-2 border-emerald-500 bg-white/80 px-3 py-2 text-[11px] italic leading-relaxed text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
              “{point.evidence_quote}”
            </blockquote>
            <button
              type="button"
              onClick={() => {
                setSourceOpenCount((count) => count + 1);
                onNavigateToPage?.(point.page, point.evidence_quote);
              }}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {language === "VI"
                ? `Mở và kiểm tra trang ${point.page}`
                : `Open and verify page ${point.page}`}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStage("post")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"
          >
            {language === "VI"
              ? "Tôi đã xem xong · Kiểm tra lại"
              : "I finished · Check again"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {stage === "post" && (
        <QuestionStep
          label={language === "VI" ? "Bước 3 · Sau khi học" : "Step 3 · After study"}
          explanation={
            language === "VI"
              ? "Câu hỏi đổi cách diễn đạt nhưng kiểm tra cùng một kiến thức."
              : "Different wording, same concept and comparable difficulty."
          }
          question={assessment.post_question}
          answer={postAnswer}
          onAnswerChange={setPostAnswer}
          onSubmit={() => evaluate(
            "post",
            assessment.post_question,
            postAnswer,
          )}
          isEvaluating={isEvaluating}
          language={language}
        />
      )}

      {stage === "result" && preEvaluation && postEvaluation && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ScoreCard
              label={language === "VI" ? "Trước học" : "Before"}
              score={preEvaluation.score}
            />
            <ScoreCard
              label={language === "VI" ? "Sau học" : "After"}
              score={postEvaluation.score}
            />
            <ScoreCard
              label={language === "VI" ? "Thay đổi" : "Change"}
              score={delta}
              signed
            />
          </div>
          <div className={`rounded-xl border p-3 text-xs ${SCORE_CLASSES[postEvaluation.verdict]}`}>
            <p className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              {delta > 0
                ? (language === "VI"
                    ? `Mức hiểu tăng ${delta} điểm`
                    : `Understanding improved by ${delta} points`)
                : preEvaluation.score === 100 && postEvaluation.score === 100
                  ? (language === "VI"
                      ? "Bạn đã nắm vững từ đầu"
                      : "You already had strong understanding")
                  : (language === "VI"
                      ? "Chưa ghi nhận mức cải thiện"
                      : "No improvement recorded yet")}
            </p>
            <p className="mt-1.5 leading-relaxed">{postEvaluation.feedback}</p>
            <p className="mt-1 font-semibold">{postEvaluation.next_step}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {language === "VI"
                ? "Kết quả đã sẵn sàng để lưu vào tiến độ"
                : "Result is ready for learning progress"}
            </span>
            <button
              type="button"
              onClick={onViewSummary}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white dark:bg-white dark:text-slate-900"
            >
              {language === "VI"
                ? "Xem toàn bộ tóm tắt"
                : "View full summary"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {completedRecord && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[10px] dark:border-slate-700 dark:bg-slate-900">
              <span className="mr-auto font-semibold text-slate-600 dark:text-slate-300">
                {language === "VI"
                  ? "Vòng học này có hữu ích không?"
                  : "Was this learning loop helpful?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompletedRecord({ ...completedRecord, helpful: true });
                  persistHelpful(completedRecord.id, true);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold ${
                  completedRecord.helpful === true
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                    : "border-slate-200 text-slate-500 dark:border-slate-700"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {language === "VI" ? "Hữu ích" : "Helpful"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletedRecord({ ...completedRecord, helpful: false });
                  persistHelpful(completedRecord.id, false);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold ${
                  completedRecord.helpful === false
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30"
                    : "border-slate-200 text-slate-500 dark:border-slate-700"
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {language === "VI" ? "Chưa hữu ích" : "Not helpful"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && assessment && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
};


function persistHelpful(recordId: string, helpful: boolean): void {
  try {
    const storedRecords = parseLearningMeasurements(
      window.localStorage.getItem(LEARNING_METRICS_STORAGE_KEY),
    );
    window.localStorage.setItem(
      LEARNING_METRICS_STORAGE_KEY,
      serializeLearningMeasurements(
        setLearningMeasurementHelpful(storedRecords, recordId, helpful),
      ),
    );
    window.dispatchEvent(new Event("vlearn-learning-metrics-updated"));
  } catch {
    // Phản hồi vẫn được giữ trong state khi localStorage không khả dụng.
  }
}


interface QuestionStepProps {
  label: string;
  explanation: string;
  question: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  isEvaluating: boolean;
  language: Language;
}

const QuestionStep: React.FC<QuestionStepProps> = ({
  label,
  explanation,
  question,
  answer,
  onAnswerChange,
  onSubmit,
  isEvaluating,
  language,
}) => (
  <div className="space-y-3">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        {label}
      </p>
      <p className="mt-1 text-[10px] text-slate-500">{explanation}</p>
    </div>
    <p className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
      {question}
    </p>
    <textarea
      value={answer}
      onChange={(event) => onAnswerChange(event.target.value)}
      placeholder={
        language === "VI"
          ? "Trả lời bằng lời của bạn..."
          : "Answer in your own words..."
      }
      className="min-h-24 w-full resize-y rounded-xl border border-violet-200 bg-white p-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-violet-800 dark:bg-slate-900 dark:focus:ring-violet-950"
    />
    <button
      type="button"
      onClick={onSubmit}
      disabled={!answer.trim() || isEvaluating}
      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
    >
      {isEvaluating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {language === "VI" ? "Chấm câu trả lời" : "Check answer"}
    </button>
  </div>
);


const EvaluationStrip: React.FC<{
  label: string;
  evaluation: EvaluationData;
  verdictLabel: string;
}> = ({ label, evaluation, verdictLabel }) => (
  <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs ${SCORE_CLASSES[evaluation.verdict]}`}>
    <div>
      <p className="font-bold">{label}: {evaluation.score}/100</p>
      <p className="mt-0.5 text-[10px]">{verdictLabel}</p>
    </div>
    <span className="text-2xl font-black">{evaluation.score}</span>
  </div>
);


const ScoreCard: React.FC<{
  label: string;
  score: number;
  signed?: boolean;
}> = ({ label, score, signed = false }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center dark:border-slate-700 dark:bg-slate-900">
    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-xl font-black ${
      signed
        ? score > 0
          ? "text-emerald-600"
          : score < 0
            ? "text-rose-600"
            : "text-slate-500"
        : "text-slate-900 dark:text-white"
    }`}>
      {signed && score > 0 ? "+" : ""}{score}
    </p>
  </div>
);

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Language, SummaryKeyPointData } from "../types";
import { fetchWithTimeout } from "../lib/apiClient";
import { shouldOfferRemediation } from "../lib/learningExperience";


interface InlineQuizProps {
  point: SummaryKeyPointData;
  language: Language;
  onNavigateToPage?: (page: number, evidenceQuote?: string) => void;
  onRequestDeepExplain?: () => void;
  onRequestExample?: () => void;
}

interface QuizData {
  question: string;
  hint?: string | null;
  source_page: number;
  provider: string;
  status: string;
}

interface EvaluationData {
  verdict: "correct" | "partial" | "incorrect";
  feedback: string;
  next_step: string;
  source_page: number;
}

export const InlineQuiz: React.FC<InlineQuizProps> = ({
  point,
  language,
  onNavigateToPage,
  onRequestDeepExplain,
  onRequestExample,
}) => {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setQuiz(null);
    setAnswer("");
    setEvaluation(null);
    setShowHint(false);

    fetchWithTimeout("/api/study/quiz", {
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
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail ?? "Quiz API error");
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Không thể tạo câu hỏi",
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

  const submitAnswer = async () => {
    if (!quiz || !answer.trim() || isEvaluating) return;
    setIsEvaluating(true);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/study/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: "lesson-01",
          language,
          question: quiz.question,
          answer: answer.trim(),
          source: {
            page: point.page,
            claim: point.claim,
            evidence_quote: point.evidence_quote,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "Evaluate API error");
      }
      setEvaluation(await response.json());
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
      <div className="mt-3 ml-7 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        {language === "VI"
          ? "Đang tạo một câu kiểm tra từ đúng nguồn..."
          : "Creating a checkpoint from the verified source..."}
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="mt-3 ml-7 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-2 inline-flex items-center gap-1 font-bold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {language === "VI" ? "Thử lại" : "Retry"}
        </button>
      </div>
    );
  }

  if (!quiz) return null;

  const verdictClasses = evaluation?.verdict === "correct"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
    : evaluation?.verdict === "partial"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200";

  return (
    <div className="mt-3 ml-7 space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
        {language === "VI" ? "Kiểm tra hiểu · 1 câu" : "Understanding check · 1 question"}
      </p>
      <p className="text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
        {quiz.question}
      </p>

      {!evaluation && (
        <>
          {quiz.hint && (
            <div>
              <button
                type="button"
                onClick={() => setShowHint((value) => !value)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600"
              >
                <Eye className="h-3 w-3" />
                {showHint
                  ? (language === "VI" ? "Ẩn gợi ý" : "Hide hint")
                  : (language === "VI" ? "Xem gợi ý" : "Show hint")}
              </button>
              {showHint && (
                <p className="mt-1 text-[11px] italic text-slate-600 dark:text-slate-300">
                  {quiz.hint}
                </p>
              )}
            </div>
          )}
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={
              language === "VI"
                ? "Trả lời bằng lời của bạn..."
                : "Answer in your own words..."
            }
            className="min-h-20 w-full resize-y rounded-xl border border-violet-200 bg-white p-2.5 text-xs outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={submitAnswer}
            disabled={!answer.trim() || isEvaluating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isEvaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {language === "VI" ? "Kiểm tra câu trả lời" : "Check answer"}
          </button>
        </>
      )}

      {evaluation && (
        <div className={`rounded-xl border p-3 text-xs ${verdictClasses}`}>
          <p className="flex items-center gap-1.5 font-bold">
            {evaluation.verdict === "correct" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {
              {
                correct: language === "VI" ? "Đã hiểu ý chính" : "Core idea understood",
                partial: language === "VI" ? "Đúng một phần" : "Partly correct",
                incorrect: language === "VI" ? "Cần xem lại" : "Review needed",
              }[evaluation.verdict]
            }
          </p>
          <p className="mt-1.5 leading-relaxed">{evaluation.feedback}</p>
          <p className="mt-1 font-semibold">{evaluation.next_step}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateToPage?.(
                point.page,
                point.evidence_quote,
              )}
              className="rounded-full border border-current px-2.5 py-1 text-[10px] font-bold"
            >
              {language === "VI" ? `Mở nguồn trang ${point.page}` : `Open page ${point.page}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setAnswer("");
                setEvaluation(null);
                setAttempt((value) => value + 1);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold"
            >
              <RefreshCw className="h-3 w-3" />
              {language === "VI" ? "Câu khác" : "Another question"}
            </button>
            {shouldOfferRemediation(evaluation.verdict) && (
              <>
                <button
                  type="button"
                  onClick={onRequestDeepExplain}
                  className="inline-flex items-center gap-1 rounded-full border border-current px-2.5 py-1 text-[10px] font-bold"
                >
                  <BookOpen className="h-3 w-3" />
                  {language === "VI"
                    ? "Giải thích sâu hơn"
                    : "Explain more deeply"}
                </button>
                <button
                  type="button"
                  onClick={onRequestExample}
                  className="inline-flex items-center gap-1 rounded-full border border-current px-2.5 py-1 text-[10px] font-bold"
                >
                  <Sparkles className="h-3 w-3" />
                  {language === "VI"
                    ? "Cho ví dụ minh họa"
                    : "Show an example"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] font-semibold text-rose-600">{error}</p>
      )}
    </div>
  );
};

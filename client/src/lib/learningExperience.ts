import {
  AssessmentVerdict,
  SummaryDepth,
} from "../types";


export function shouldOfferUnderstandingCheck(
  depth: SummaryDepth | undefined,
  sourceVerified: boolean,
): boolean {
  return depth === "study" && sourceVerified;
}

export function shouldOfferRemediation(
  verdict: AssessmentVerdict | undefined,
): boolean {
  return verdict === "partial" || verdict === "incorrect";
}

export function shouldShowSummaryFollowUps(
  depth: SummaryDepth | undefined,
): boolean {
  return depth === "study";
}

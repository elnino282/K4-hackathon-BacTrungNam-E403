import { LearningMeasurementRecord } from "../types";


export const LEARNING_METRICS_STORAGE_KEY =
  "vlearn-slide2study-learning-metrics-v1";

export interface LearningImpactSummary {
  completedSessions: number;
  improvedSessions: number;
  averageDelta: number;
  averageDurationSeconds: number;
  totalSourceOpens: number;
  sourceOpenRate: number;
  helpfulResponses: number;
  helpfulRate: number | null;
}


function isScore(value: unknown): value is 0 | 50 | 100 {
  return value === 0 || value === 50 || value === 100;
}

export function parseLearningMeasurements(
  raw: string | null,
): LearningMeasurementRecord[] {
  if (!raw) return [];
  try {
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload)) return [];
    return payload.filter(
      (record): record is LearningMeasurementRecord => (
        typeof record?.id === "string"
        && typeof record?.docId === "string"
        && Number.isInteger(record?.page)
        && record.page >= 1
        && typeof record?.claim === "string"
        && isScore(record?.preScore)
        && isScore(record?.postScore)
        && typeof record?.delta === "number"
        && Number.isFinite(record.delta)
        && typeof record?.durationSeconds === "number"
        && record.durationSeconds >= 0
        && Number.isInteger(record?.sourceOpenCount)
        && record.sourceOpenCount >= 0
        && (
          record?.helpful === null
          || typeof record?.helpful === "boolean"
        )
        && typeof record?.provider === "string"
        && typeof record?.completedAt === "string"
      ),
    );
  } catch {
    return [];
  }
}

export function serializeLearningMeasurements(
  records: LearningMeasurementRecord[],
): string {
  return JSON.stringify(records);
}

export function upsertLearningMeasurement(
  records: LearningMeasurementRecord[],
  nextRecord: LearningMeasurementRecord,
  limit = 100,
): LearningMeasurementRecord[] {
  return [
    nextRecord,
    ...records.filter((record) => record.id !== nextRecord.id),
  ].slice(0, limit);
}

export function setLearningMeasurementHelpful(
  records: LearningMeasurementRecord[],
  recordId: string,
  helpful: boolean,
): LearningMeasurementRecord[] {
  return records.map((record) => (
    record.id === recordId ? { ...record, helpful } : record
  ));
}

export function summarizeLearningMeasurements(
  records: LearningMeasurementRecord[],
): LearningImpactSummary {
  if (records.length === 0) {
    return {
      completedSessions: 0,
      improvedSessions: 0,
      averageDelta: 0,
      averageDurationSeconds: 0,
      totalSourceOpens: 0,
      sourceOpenRate: 0,
      helpfulResponses: 0,
      helpfulRate: null,
    };
  }

  const completedSessions = records.length;
  const improvedSessions = records.filter(
    (record) => record.delta > 0,
  ).length;
  const averageDelta = Math.round(
    records.reduce((total, record) => total + record.delta, 0)
      / completedSessions,
  );
  const averageDurationSeconds = Math.round(
    records.reduce(
      (total, record) => total + record.durationSeconds,
      0,
    ) / completedSessions,
  );
  const totalSourceOpens = records.reduce(
    (total, record) => total + record.sourceOpenCount,
    0,
  );
  const sourceOpenRate = Math.round(
    (
      records.filter((record) => record.sourceOpenCount > 0).length
      / completedSessions
    ) * 100,
  );
  const ratedRecords = records.filter(
    (record) => record.helpful !== null,
  );
  const helpfulResponses = ratedRecords.filter(
    (record) => record.helpful,
  ).length;
  const helpfulRate = ratedRecords.length > 0
    ? Math.round((helpfulResponses / ratedRecords.length) * 100)
    : null;

  return {
    completedSessions,
    improvedSessions,
    averageDelta,
    averageDurationSeconds,
    totalSourceOpens,
    sourceOpenRate,
    helpfulResponses,
    helpfulRate,
  };
}

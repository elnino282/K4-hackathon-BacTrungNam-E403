import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLearningMeasurements,
  serializeLearningMeasurements,
  setLearningMeasurementHelpful,
  summarizeLearningMeasurements,
  upsertLearningMeasurement,
} from "../src/lib/learningMetrics";
import { LearningMeasurementRecord } from "../src/types";


const first: LearningMeasurementRecord = {
  id: "assessment-1",
  docId: "lesson-01",
  page: 7,
  claim: "Adoption tăng nhưng scale vẫn khó.",
  preScore: 0,
  postScore: 100,
  delta: 100,
  durationSeconds: 90,
  sourceOpenCount: 2,
  helpful: true,
  provider: "xah",
  completedAt: "2026-01-01T00:00:00.000Z",
};

const second: LearningMeasurementRecord = {
  ...first,
  id: "assessment-2",
  page: 24,
  preScore: 50,
  postScore: 50,
  delta: 0,
  durationSeconds: 30,
  sourceOpenCount: 0,
  helpful: false,
};

test("lưu và đọc lại phiên đo học tập hợp lệ", () => {
  const parsed = parseLearningMeasurements(
    serializeLearningMeasurements([first]),
  );
  assert.deepEqual(parsed, [first]);
});

test("loại bản ghi sai điểm hoặc sai số lần mở nguồn", () => {
  assert.deepEqual(parseLearningMeasurements("{broken"), []);
  assert.deepEqual(
    parseLearningMeasurements(JSON.stringify([
      { ...first, postScore: 75 },
      { ...first, sourceOpenCount: -1 },
    ])),
    [],
  );
});

test("tổng hợp đúng mức tăng, thời gian, mở nguồn và hữu ích", () => {
  assert.deepEqual(summarizeLearningMeasurements([first, second]), {
    completedSessions: 2,
    improvedSessions: 1,
    averageDelta: 50,
    averageDurationSeconds: 60,
    totalSourceOpens: 2,
    sourceOpenRate: 50,
    helpfulResponses: 1,
    helpfulRate: 50,
  });
});

test("upsert không nhân đôi và cập nhật được phản hồi hữu ích", () => {
  const updated = { ...first, durationSeconds: 75 };
  assert.deepEqual(
    upsertLearningMeasurement([first, second], updated),
    [updated, second],
  );
  assert.equal(
    setLearningMeasurementHelpful([first], first.id, false)[0].helpful,
    false,
  );
});

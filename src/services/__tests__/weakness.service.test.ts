import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConceptMastery } from '@/engine/types';

// Only the engine's mastery list matters here.
const state = vi.hoisted(() => ({ masteries: [] as ConceptMastery[] }));
vi.mock('@/engine/engine', () => ({
  aweEngine: { getMasteries: () => state.masteries },
}));

// A stand-in mock bank: these ids are what marks a concept as mock-sourced.
vi.mock('@/lib/mockQuestions', () => ({
  ALL_QUESTIONS: [
    { subtopicId: 'sub-pl' },
    { subtopicId: 'sub-tsd' },
  ],
}));

import { getWeaknessSnapshot } from '@/services/weakness.service';

const mastery = (over: Partial<ConceptMastery>): ConceptMastery =>
  ({
    conceptId: 'x',
    conceptName: 'X',
    topicName: 'Arithmetic',
    topicWeight: 1,
    frequencyWeight: 1,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    accuracy: 0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    last10: [],
    skips: 0,
    consecutiveSkips: 0,
    skipTimeTotal: 0,
    skipTimeCount: 0,
    skipDifficultyTotal: 0,
    skipDifficultyCount: 0,
    skipsEasy: 0,
    skipsHard: 0,
    avgTimeRatio: null,
    timeCorrectTotal: 0,
    timeCorrectCount: 0,
    timeIncorrectTotal: 0,
    timeIncorrectCount: 0,
    masteryScore: 0,
    weaknessScore: 0,
    priorityWeight: 1,
    status: 'weak',
    everWasWeak: true,
    everWasVeryWeak: false,
    firstWeakAt: null,
    resolvedAt: null,
    timesReopened: 0,
    revisionFails: 0,
    lastRevisionFailAt: null,
    improvingSessions: 0,
    lastAttemptAt: '2026-07-31T10:00:00.000Z',
    ...over,
  }) as ConceptMastery;

beforeEach(() => {
  state.masteries = [];
});

describe('per-topic timing rollup', () => {
  // The reason totals are rolled up rather than averaged: one concept has a
  // single slow timed attempt, the other has many fast ones. Averaging the
  // two per-concept averages would report 165s; the truth is far lower.
  it('weights by attempt count, not by concept', async () => {
    state.masteries = [
      mastery({ conceptId: 'a', conceptName: 'A', topicName: 'Arithmetic', attempts: 1, correct: 1, timeCorrectTotal: 300, timeCorrectCount: 1 }),
      mastery({ conceptId: 'b', conceptName: 'B', topicName: 'Arithmetic', attempts: 50, correct: 50, timeCorrectTotal: 1500, timeCorrectCount: 50 }),
    ];

    const topic = (await getWeaknessSnapshot('cat')).topics[0];
    expect(topic.avgSeconds).toBe(35); // (300 + 1500) / 51, not (300 + 30) / 2
    expect(topic.timedAttempts).toBe(51);
  });

  it('splits right from wrong across the topic', async () => {
    state.masteries = [
      mastery({ conceptId: 'a', conceptName: 'A', topicName: 'Geometry', attempts: 4, correct: 2, timeCorrectTotal: 80, timeCorrectCount: 2, timeIncorrectTotal: 400, timeIncorrectCount: 2 }),
    ];

    const topic = (await getWeaknessSnapshot('cat')).topics[0];
    expect(topic.avgSecondsCorrect).toBe(40);
    expect(topic.avgSecondsIncorrect).toBe(200);
  });

  it('counts abandoned skips in the total but not in the average', async () => {
    state.masteries = [
      mastery({ conceptId: 'a', conceptName: 'A', topicName: 'Algebra', attempts: 2, correct: 2, timeCorrectTotal: 100, timeCorrectCount: 2, skips: 1, skipTimeTotal: 90, skipTimeCount: 1 }),
    ];

    const topic = (await getWeaknessSnapshot('cat')).topics[0];
    expect(topic.avgSeconds).toBe(50); // 100 / 2 — the skip is not an answer
    expect(topic.totalSeconds).toBe(190); // but its 90s were still spent
  });

  it('reports null rather than zero when nothing was timed', async () => {
    state.masteries = [
      mastery({ conceptId: 'a', conceptName: 'A', topicName: 'Arithmetic', attempts: 5, correct: 2 }),
    ];

    const topic = (await getWeaknessSnapshot('cat')).topics[0];
    expect(topic.avgSeconds).toBeNull();
    expect(topic.timedAttempts).toBe(0);
  });

  it('rolls the merged mock duplicate into its topic total', async () => {
    state.masteries = [
      mastery({ conceptId: 'sub-pl', conceptName: 'Profit & Loss', topicName: 'Arithmetic', attempts: 1, correct: 1, timeCorrectTotal: 60, timeCorrectCount: 1 }),
      mastery({ conceptId: 'uuid-pl', conceptName: 'Profit & Loss', topicName: 'Arithmetic', attempts: 1, correct: 1, timeCorrectTotal: 20, timeCorrectCount: 1 }),
    ];

    const topics = (await getWeaknessSnapshot('cat')).topics;
    expect(topics).toHaveLength(1);
    expect(topics[0].avgSeconds).toBe(40); // counted once each, not double
    expect(topics[0].timedAttempts).toBe(2);
  });
});

describe('mock/live duplicate merging', () => {
  it('folds a mock concept into its live counterpart', async () => {
    state.masteries = [
      mastery({ conceptId: 'sub-pl', conceptName: 'Profit & Loss', attempts: 1, correct: 0, incorrect: 1, weaknessScore: 12 }),
      mastery({ conceptId: 'uuid-pl', conceptName: 'Profit & Loss', attempts: 9, correct: 4, incorrect: 5, weaknessScore: 40 }),
    ];

    const snap = await getWeaknessSnapshot('cat');
    const pl = snap.subtopics.filter((s) => s.subtopicName === 'Profit & Loss');

    expect(pl).toHaveLength(1);
    expect(pl[0].subtopicId).toBe('uuid-pl'); // the drillable one survives
    expect(pl[0].attempts).toBe(10);
    expect(pl[0].correct).toBe(4);
    expect(pl[0].weaknessScore).toBe(40); // the more urgent of the two
  });

  it('sums the timing and skip totals when merging', async () => {
    state.masteries = [
      mastery({ conceptId: 'sub-pl', conceptName: 'Profit & Loss', attempts: 2, correct: 1, timeCorrectTotal: 30, timeCorrectCount: 1, skips: 1, skipsEasy: 1 }),
      mastery({ conceptId: 'uuid-pl', conceptName: 'Profit & Loss', attempts: 2, correct: 1, timeCorrectTotal: 50, timeCorrectCount: 1, skips: 2, skipsEasy: 2 }),
    ];

    const pl = (await getWeaknessSnapshot('cat')).subtopics[0];
    expect(pl.avgSecondsCorrect).toBe(40); // (30 + 50) / 2
    expect(pl.skips).toBe(3);
  });

  // The taxonomy has four different subtopics named "Relative Speed", so
  // merging on name alone would fuse genuinely separate concepts.
  it('never merges two live concepts that share a name', async () => {
    state.masteries = [
      mastery({ conceptId: 'uuid-rs-1', conceptName: 'Relative Speed', topicName: 'Arithmetic', attempts: 4 }),
      mastery({ conceptId: 'uuid-rs-2', conceptName: 'Relative Speed', topicName: 'Arithmetic', attempts: 6 }),
    ];

    const snap = await getWeaknessSnapshot('cat');
    expect(snap.subtopics.filter((s) => s.subtopicName === 'Relative Speed')).toHaveLength(2);
  });

  it('does not merge across different topics', async () => {
    state.masteries = [
      mastery({ conceptId: 'sub-pl', conceptName: 'Profit & Loss', topicName: 'Arithmetic', attempts: 1 }),
      mastery({ conceptId: 'uuid-pl', conceptName: 'Profit & Loss', topicName: 'Modern Mathematics', attempts: 5 }),
    ];

    expect((await getWeaknessSnapshot('cat')).subtopics).toHaveLength(2);
  });

  it('keeps a mock concept that has no live counterpart', async () => {
    state.masteries = [
      mastery({ conceptId: 'sub-tsd', conceptName: 'Relative Speed', attempts: 3, correct: 1 }),
    ];

    const snap = await getWeaknessSnapshot('cat');
    expect(snap.subtopics).toHaveLength(1);
    expect(snap.subtopics[0].subtopicId).toBe('sub-tsd');
  });

  it('leaves the engine own objects unmutated', async () => {
    const live = mastery({ conceptId: 'uuid-pl', conceptName: 'Profit & Loss', attempts: 9 });
    state.masteries = [
      mastery({ conceptId: 'sub-pl', conceptName: 'Profit & Loss', attempts: 1 }),
      live,
    ];

    await getWeaknessSnapshot('cat');
    expect(live.attempts).toBe(9); // not 10 — the merge must not write through
  });
});

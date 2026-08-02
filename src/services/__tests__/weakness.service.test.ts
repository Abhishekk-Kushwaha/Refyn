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

import { describe, it, expect } from 'vitest';
import { initConceptMastery, applyAttempt } from '@/engine/rules';
import { skipProfileOf, rankSkipConcerns } from '@/engine/skipProfile';
import { migrateSnapshot } from '@/engine/migrate';
import { AWE_CONFIG } from '@/engine/aweConfig';
import { ConceptMastery } from '@/engine/types';

const NOW = '2026-07-31T10:00:00.000Z';

const concept = (id = 'tsd', name = 'Time Speed Distance'): ConceptMastery =>
  initConceptMastery({
    conceptId: id,
    conceptName: name,
    topicName: 'Arithmetic',
    topicWeight: 1,
    frequencyWeight: 1.3,
  });

const skip = (m: ConceptMastery, difficulty?: number, timeTakenSeconds?: number) =>
  applyAttempt(m, { isCorrect: false, skipped: true, difficulty, timeTakenSeconds }, NOW, AWE_CONFIG)
    .mastery;

const answer = (m: ConceptMastery, isCorrect: boolean) =>
  applyAttempt(m, { isCorrect, difficulty: 5, timeTakenSeconds: 60 }, NOW, AWE_CONFIG).mastery;

describe('skip capture', () => {
  it('records duration and difficulty of a skip', () => {
    let m = concept();
    m = skip(m, 3, 90);

    expect(m.skips).toBe(1);
    expect(m.skipTimeTotal).toBe(90);
    expect(m.skipTimeCount).toBe(1);
    expect(m.skipDifficultyTotal).toBe(3);
    expect(m.skipsEasy).toBe(1);
    expect(m.skipsHard).toBe(0);
  });

  it('buckets easy and hard skips by difficulty', () => {
    let m = concept();
    m = skip(m, 2); // easy
    m = skip(m, 4); // easy (boundary)
    m = skip(m, 5); // neither
    m = skip(m, 7); // hard (boundary)
    m = skip(m, 9); // hard

    expect(m.skipsEasy).toBe(2);
    expect(m.skipsHard).toBe(2);
    expect(m.skips).toBe(5);
  });

  it('ignores untimed skips rather than counting them as instant', () => {
    let m = concept();
    m = skip(m, 5, 40);
    m = skip(m, 5, undefined);

    expect(m.skipTimeCount).toBe(1);
    expect(m.skipTimeTotal).toBe(40);
    expect(m.skips).toBe(2);
  });
});

describe('skipProfileOf', () => {
  it('stays quiet below three skips', () => {
    let m = concept();
    m = skip(m, 2, 90);
    m = skip(m, 2, 90);

    expect(skipProfileOf(m).behaviour).toBe('none');
  });

  // The signal that matters most: walking around questions at your level.
  it('flags avoidance when easy questions are skipped', () => {
    let m = concept();
    m = skip(m, 2, 20);
    m = skip(m, 3, 15);
    m = skip(m, 4, 25);

    const p = skipProfileOf(m);
    expect(p.behaviour).toBe('avoiding');
    expect(p.skipsEasy).toBe(3);
  });

  it('calls it triage when hard questions are dropped quickly', () => {
    let m = concept();
    for (let i = 0; i < 5; i++) m = answer(m, true);
    m = skip(m, 9, 10);
    m = skip(m, 8, 12);
    m = skip(m, 9, 8);

    const p = skipProfileOf(m);
    expect(p.behaviour).toBe('triaging');
    expect(p.avgSkipDifficulty).toBeGreaterThanOrEqual(7);
  });

  it('flags stalling when mid-difficulty skips burn real time', () => {
    let m = concept();
    for (let i = 0; i < 6; i++) m = answer(m, true);
    m = skip(m, 6, 80);
    m = skip(m, 5, 95);
    m = skip(m, 6, 70);

    const p = skipProfileOf(m);
    expect(p.behaviour).toBe('stalling');
    expect(p.avgSkipSeconds).toBeGreaterThanOrEqual(45);
  });

  it('computes skip rate against total encounters', () => {
    let m = concept();
    for (let i = 0; i < 6; i++) m = answer(m, true);
    m = skip(m, 9, 5);
    m = skip(m, 8, 5);
    // 2 skips out of 8 encounters
    expect(skipProfileOf(m).skipRate).toBeCloseTo(0.25, 2);
  });
});

describe('rankSkipConcerns', () => {
  it('puts avoidance above stalling above triage, and drops the quiet ones', () => {
    let avoid = concept('a', 'Percentages');
    avoid = skip(avoid, 2, 20);
    avoid = skip(avoid, 3, 20);
    avoid = skip(avoid, 3, 20);

    let stall = concept('b', 'Mensuration');
    for (let i = 0; i < 6; i++) stall = answer(stall, true);
    stall = skip(stall, 6, 90);
    stall = skip(stall, 5, 90);
    stall = skip(stall, 6, 90);

    let triage = concept('c', 'Logarithms');
    for (let i = 0; i < 8; i++) triage = answer(triage, true);
    triage = skip(triage, 9, 6);
    triage = skip(triage, 9, 6);
    triage = skip(triage, 8, 6);

    const quiet = concept('d', 'Ratios');

    const ranked = rankSkipConcerns([triage, quiet, stall, avoid]);
    expect(ranked.map((r) => r.behaviour)).toEqual(['avoiding', 'stalling', 'triaging']);
    expect(ranked.map((r) => r.conceptName)).toEqual([
      'Percentages',
      'Mensuration',
      'Logarithms',
    ]);
  });
});

describe('migration', () => {
  it('defaults the v4 skip fields without touching the existing skip count', () => {
    const legacy = {
      version: 3,
      masteries: {
        tsd: {
          conceptId: 'tsd',
          conceptName: 'Time Speed Distance',
          topicName: 'Arithmetic',
          attempts: 10,
          correct: 4,
          skips: 7, // known, but unqualified
        },
      },
      queue: [],
      flashcards: {},
      meta: {},
    };

    const m = migrateSnapshot(legacy).masteries.tsd;
    expect(m.skips).toBe(7);
    expect(m.skipTimeTotal).toBe(0);
    expect(m.skipDifficultyCount).toBe(0);
    expect(m.skipsEasy).toBe(0);
    expect(m.skipsHard).toBe(0);
    // With no difficulty or timing recorded, it cannot be classified.
    expect(skipProfileOf(m).behaviour).toBe('none');
  });
});

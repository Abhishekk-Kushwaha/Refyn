import { describe, it, expect } from 'vitest';
import { initConceptMastery, applyAttempt } from '@/engine/rules';
import { migrateSnapshot } from '@/engine/migrate';
import { AWE_CONFIG } from '@/engine/aweConfig';
import { ConceptMastery } from '@/engine/types';

const NOW = '2026-07-31T10:00:00.000Z';
const config = AWE_CONFIG;

const concept = (): ConceptMastery =>
  initConceptMastery({
    conceptId: 'tsd',
    conceptName: 'Time Speed Distance',
    topicName: 'Arithmetic',
    topicWeight: 1,
    frequencyWeight: 1.3,
  });

const answer = (m: ConceptMastery, isCorrect: boolean, timeTakenSeconds?: number) =>
  applyAttempt(m, { isCorrect, timeTakenSeconds, expectedTimeSeconds: 90 }, NOW, config).mastery;

describe('per-outcome timing', () => {
  it('banks seconds against the right outcome', () => {
    let m = concept();
    m = answer(m, true, 34);
    m = answer(m, false, 300);

    expect(m.timeCorrectTotal).toBe(34);
    expect(m.timeCorrectCount).toBe(1);
    expect(m.timeIncorrectTotal).toBe(300);
    expect(m.timeIncorrectCount).toBe(1);
  });

  it('averages across several attempts', () => {
    let m = concept();
    m = answer(m, true, 30);
    m = answer(m, true, 50);
    m = answer(m, false, 240);
    m = answer(m, false, 360);

    expect(m.timeCorrectTotal / m.timeCorrectCount).toBe(40);
    expect(m.timeIncorrectTotal / m.timeIncorrectCount).toBe(300);
  });

  // The case the feature exists for: five minutes spent, still wrong.
  it('separates time sunk into wrong answers from time when right', () => {
    let m = concept();
    m = answer(m, true, 34);
    m = answer(m, false, 300);

    const avgRight = m.timeCorrectTotal / m.timeCorrectCount;
    const avgWrong = m.timeIncorrectTotal / m.timeIncorrectCount;
    expect(avgWrong).toBeGreaterThan(avgRight * 5);
  });

  it('ignores untimed attempts rather than counting them as zero', () => {
    let m = concept();
    m = answer(m, true, 40);
    m = answer(m, true, undefined); // untimed
    m = answer(m, true, 0); // zero is not a real duration

    expect(m.timeCorrectCount).toBe(1);
    expect(m.timeCorrectTotal).toBe(40);
    // The attempt still counts even though its duration did not.
    expect(m.attempts).toBe(3);
  });

  it('does not record time for a skip', () => {
    let m = concept();
    m = applyAttempt(m, { isCorrect: false, skipped: true, timeTakenSeconds: 12 }, NOW, config)
      .mastery;

    expect(m.timeIncorrectCount).toBe(0);
    expect(m.timeIncorrectTotal).toBe(0);
    expect(m.skips).toBe(1);
  });

  it('migrates pre-v3 snapshots to zero rather than inventing history', () => {
    const legacy = {
      version: 2,
      masteries: {
        tsd: {
          conceptId: 'tsd',
          conceptName: 'Time Speed Distance',
          topicName: 'Arithmetic',
          attempts: 20,
          correct: 12,
          avgTimeRatio: 1.4,
          // no timing fields — they did not exist
        },
      },
      queue: [],
      flashcards: {},
      meta: {},
    };

    const migrated = migrateSnapshot(legacy);
    const m = migrated.masteries.tsd;

    expect(m.timeCorrectTotal).toBe(0);
    expect(m.timeCorrectCount).toBe(0);
    expect(m.timeIncorrectTotal).toBe(0);
    expect(m.timeIncorrectCount).toBe(0);
    // Existing history survives the migration untouched.
    expect(m.attempts).toBe(20);
    expect(m.avgTimeRatio).toBe(1.4);
  });
});

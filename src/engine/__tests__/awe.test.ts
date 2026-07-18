import { describe, it, expect } from 'vitest';
import { AweEngine } from '../engine';
import { MemoryAweStore } from '../store';
import { AWE_CONFIG } from '../aweConfig';
import { initConceptMastery, applyConceptQuizResult } from '../rules';
import { buildQuiz } from '../quizBuilder';
import { initFlashcardState, reviewGotIt, reviewNotSure } from '../flashcardSM2';
import { updateMasteryScore } from '../masteryScore';
import { ConceptMastery } from '../types';
import { MockQuestion } from '@/lib/mockQuestions';

// ============================================================
// AWE acceptance suite — mirrors Doc 5 §13. If these pass, the
// engine honors the contract table in §1.
// ============================================================

const NOW = '2026-07-18T10:00:00.000Z';

const makeQ = (id: string, subtopicId: string, isReplica = false): MockQuestion => ({
  id,
  subtopicId,
  subtopicName: subtopicId,
  topicName: 'Arithmetic',
  externalId: id,
  questionText: 'x',
  questionType: 'mcq',
  options: { a: '1', b: '2', c: '3', d: '4' },
  correctAnswer: 'a',
  solution: '',
  difficulty: 5,
  expectedTimeSeconds: 60,
  isReplica,
});

const makeMastery = (
  conceptId: string,
  overrides: Partial<ConceptMastery> = {}
): ConceptMastery => ({
  ...initConceptMastery({
    conceptId,
    conceptName: conceptId,
    topicName: 'Arithmetic',
    topicWeight: 1,
    frequencyWeight: 1,
  }),
  ...overrides,
});

describe('R001 — back-to-back failure → very_weak (high-value topics only)', () => {
  it('flags an Arithmetic concept very_weak after back-to-back fails and queues replicas + flashcards + review', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl'); // Profit & Loss: topicWeight 1.0, freq 1.3

    engine.onAttemptSaved(q, false, NOW); // attempt 1 — first-wrong (R002), learning
    engine.onAttemptSaved(q, false, NOW); // attempt 2 — consecutive 2, but attempts < 3
    expect(store.getMasteries()['sub-pl'].status).toBe('learning');

    engine.onAttemptSaved(q, false, NOW); // attempt 3 — all R001 conditions met
    const m = store.getMasteries()['sub-pl'];
    expect(m.status).toBe('very_weak');
    expect(m.everWasVeryWeak).toBe(true);
    expect(m.firstWeakAt).toBe(NOW);

    const queue = store.getQueue();
    expect(queue.some((i) => i.reason === 'replica_reinforcement' && i.preferReplicas)).toBe(true);
    expect(Object.keys(store.getFlashcards()).length).toBeGreaterThan(0); // fc-pl-1 materialized
    expect(store.getMeta().reviewsDue['sub-pl']).toBeDefined(); // review in 3 days
  });

  it('does NOT give a low-weight Number System concept the very_weak treatment', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-n', 'sub-numsys'); // topicWeight 0.4 < 0.7 gate

    engine.onAttemptSaved(q, false, NOW);
    engine.onAttemptSaved(q, false, NOW);
    engine.onAttemptSaved(q, false, NOW);
    expect(store.getMasteries()['sub-numsys'].status).toBe('learning'); // gentler path
  });
});

describe('R003–R005 — quiz transitions and the mastery bar', () => {
  it('walks weak → improving → mastered on sustained last-10 form, then opts out of the weak slice', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-quad', 'sub-quad'); // Algebra 0.95 — high value

    // become very_weak
    engine.onAttemptSaved(q, false, NOW);
    engine.onAttemptSaved(q, false, NOW);
    engine.onAttemptSaved(q, false, NOW);
    expect(store.getMasteries()['sub-quad'].status).toBe('very_weak');

    // then 10 clean answers in a session
    for (let i = 0; i < 10; i++) engine.onAttemptSaved(q, true, NOW);
    engine.onSessionCompleted([{ question: q, isCorrect: true }], NOW);

    const m = store.getMasteries()['sub-quad'];
    expect(m.status).toBe('mastered'); // R004 → improving, chained R005 → mastered
    expect(m.resolvedAt).toBe(NOW);
    expect(m.everWasVeryWeak).toBe(true); // the scar persists through mastery

    // auto opt-out: mastered concept is absent from the weak slice
    const pool = [makeQ('p1', 'sub-quad'), makeQ('p2', 'sub-quad'), makeQ('p3', 'sub-quad')];
    const { slots } = buildQuiz(
      Object.values(store.getMasteries()),
      pool,
      [],
      3,
      AWE_CONFIG,
      null,
      {},
      NOW
    );
    expect(
      slots.filter((s) => s.reason === 'weak_concept' || s.reason === 'replica_reinforcement')
    ).toHaveLength(0);
  });

  it('R003: learning → weak on a poor concept quiz', () => {
    const m = makeMastery('sub-pl', { status: 'learning', attempts: 4, correct: 2, accuracy: 50 });
    const { mastery } = applyConceptQuizResult(m, 50, NOW, AWE_CONFIG);
    expect(mastery.status).toBe('weak');
    expect(mastery.everWasWeak).toBe(true);
  });
});

describe('R006 — mastered concepts reopen after two failed revisions', () => {
  it('first failed revision counts, second reopens to weak', () => {
    const m = makeMastery('sub-pl', {
      status: 'mastered',
      attempts: 20,
      correct: 18,
      accuracy: 90,
      resolvedAt: NOW,
      everWasVeryWeak: true,
    });

    const after1 = applyConceptQuizResult(m, 40, NOW, AWE_CONFIG).mastery;
    expect(after1.status).toBe('mastered'); // one bad day isn't a relapse
    expect(after1.revisionFails).toBe(1);

    const after2 = applyConceptQuizResult(after1, 40, NOW, AWE_CONFIG).mastery;
    expect(after2.status).toBe('weak'); // two in a row is
    expect(after2.timesReopened).toBe(1);
    expect(after2.resolvedAt).toBeNull();
  });
});

describe('R007 — the 70/20/10 blended daily quiz', () => {
  it('composes weak/revision/mixed in ratio, weakest concepts first', () => {
    const masteries = [
      makeMastery('sub-pl', { status: 'very_weak', attempts: 5, accuracy: 20, priorityWeight: 1.3 }),
      makeMastery('sub-tsd', { status: 'weak', attempts: 5, accuracy: 40, priorityWeight: 1.2 }),
      makeMastery('sub-work', { status: 'weak', attempts: 5, accuracy: 45, priorityWeight: 1.1 }),
      makeMastery('sub-quad', { status: 'improving', attempts: 8, accuracy: 75, priorityWeight: 0.5 }),
      makeMastery('sub-tri', { status: 'mastered', attempts: 15, accuracy: 90, priorityWeight: 0.1 }),
    ];
    const pool = [
      ...[1, 2, 3].map((i) => makeQ(`pl-${i}`, 'sub-pl', i === 1)),
      ...[1, 2, 3].map((i) => makeQ(`tsd-${i}`, 'sub-tsd')),
      ...[1, 2, 3].map((i) => makeQ(`work-${i}`, 'sub-work')),
      ...[1, 2].map((i) => makeQ(`quad-${i}`, 'sub-quad')),
      ...[1, 2].map((i) => makeQ(`avg-${i}`, 'sub-avg')), // untouched concept for mixed
    ];

    const { slots } = buildQuiz(masteries, pool, [], 10, AWE_CONFIG, null, {}, NOW);

    expect(slots).toHaveLength(10);
    const weak = slots.filter(
      (s) => s.reason === 'weak_concept' || s.reason === 'replica_reinforcement'
    );
    const revision = slots.filter((s) => s.reason === 'revision');
    const mixed = slots.filter((s) => s.reason === 'balanced_practice');
    expect(weak).toHaveLength(7);
    expect(revision).toHaveLength(2);
    expect(mixed).toHaveLength(1);

    // weakest (very_weak sub-pl, highest priority) leads the quiz
    expect(slots[0].conceptId).toBe('sub-pl');
    // very_weak concepts prefer replica questions
    expect(slots[0].question.isReplica).toBe(true);
    // mastered sub-tri appears nowhere
    expect(slots.some((s) => s.conceptId === 'sub-tri')).toBe(false);
  });
});

describe('R009 — pre-CAT revival of old scars', () => {
  it('inside the 30-day window, the mixed slice pulls mastered-but-once-very-weak concepts', () => {
    const masteries = [
      makeMastery('sub-tsd', { status: 'weak', attempts: 5, accuracy: 40, priorityWeight: 1.2 }),
      makeMastery('sub-pl', {
        status: 'mastered',
        attempts: 20,
        accuracy: 90,
        everWasVeryWeak: true,
        priorityWeight: 0.2,
      }),
    ];
    const pool = [
      ...[1, 2, 3, 4].map((i) => makeQ(`tsd-${i}`, 'sub-tsd')),
      ...[1, 2].map((i) => makeQ(`pl-${i}`, 'sub-pl')),
    ];

    const { slots } = buildQuiz(masteries, pool, [], 5, AWE_CONFIG, 20, {}, NOW); // 20 days to exam

    const revival = slots.filter((s) => s.reason === 'old_weakness_revival');
    expect(revival.length).toBeGreaterThan(0);
    expect(revival[0].conceptId).toBe('sub-pl');
  });

  it('outside the window, the same mastered concept stays retired', () => {
    const masteries = [
      makeMastery('sub-tsd', { status: 'weak', attempts: 5, accuracy: 40, priorityWeight: 1.2 }),
      makeMastery('sub-pl', {
        status: 'mastered',
        attempts: 20,
        accuracy: 90,
        everWasVeryWeak: true,
        priorityWeight: 0.2,
      }),
    ];
    const pool = [
      ...[1, 2, 3, 4].map((i) => makeQ(`tsd-${i}`, 'sub-tsd')),
      ...[1, 2].map((i) => makeQ(`pl-${i}`, 'sub-pl')),
    ];

    const { slots } = buildQuiz(masteries, pool, [], 4, AWE_CONFIG, 90, {}, NOW); // 90 days out
    expect(slots.some((s) => s.reason === 'old_weakness_revival')).toBe(false);
  });
});

describe('SM-2 flashcards (R010/R011)', () => {
  it('"Got it" ×3 hits the fast-track ladder; ×5 reaches 14 days', () => {
    let s = initFlashcardState('fc-1', 'sub-pl', NOW);
    s = reviewGotIt(s, NOW); // interval 3 (1 × 2.5 rounded)
    s = reviewGotIt(s, NOW); // interval 8 (3 × 2.5 rounded)
    s = reviewGotIt(s, NOW); // consecutive 3 → ladder step 0 = 3 days
    expect(s.intervalDays).toBe(3);
    s = reviewGotIt(s, NOW); // ladder step 1 = 7
    s = reviewGotIt(s, NOW); // ladder step 2 = 14
    expect(s.intervalDays).toBe(14);
    expect(s.mastery).toBe('reviewing');
  });

  it('"Not sure" shrinks ease, resets to tomorrow, drops to learning', () => {
    let s = initFlashcardState('fc-2', 'sub-pl', NOW);
    s = reviewGotIt(s, NOW);
    s = reviewGotIt(s, NOW);
    s = reviewNotSure(s, NOW);
    expect(s.easeFactor).toBe(2.3);
    expect(s.intervalDays).toBe(1);
    expect(s.consecutiveCorrect).toBe(0);
    expect(s.mastery).toBe('learning');
  });
});

describe('§5 — mastery rises slow, falls fast', () => {
  it('one wrong answer cuts 30%; recovery is gradual', () => {
    expect(updateMasteryScore(80, false, 50, AWE_CONFIG)).toBe(56); // 80 × 0.7
    // recovering with perfect recent form still takes multiple steps
    const step1 = updateMasteryScore(56, true, 100, AWE_CONFIG); // 56 + 44×0.3 = 69.2
    expect(step1).toBeCloseTo(69.2);
    expect(step1).toBeLessThan(80); // one right answer doesn't undo one wrong
  });
});

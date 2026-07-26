import { describe, it, expect, beforeEach } from 'vitest';
import { AweEngine } from '../engine';
import { MemoryAweStore } from '../store';
import { AWE_CONFIG } from '../aweConfig';
import { initConceptMastery, applyConceptQuizResult, applyFlashcardSignal } from '../rules';
import { buildQuiz, BuildQuizInput } from '../quizBuilder';
import { initFlashcardState, reviewCard, isDue } from '../flashcardSM2';
import { updateMasteryScore, recomputeScores } from '../masteryScore';
import { migrateSnapshot, mergeSnapshots } from '../migrate';
import { AttemptSignal, ConceptMastery } from '../types';
import { MockQuestion } from '@/lib/mockQuestions';
import { resetFlashcardPool } from '@/services/flashcardPool';

// ============================================================
// AWE acceptance suite — mirrors Doc 5 §13. If these pass, the
// engine honors the contract table in §1.
// ============================================================

const NOW = '2026-07-18T10:00:00.000Z';
const at = (days: number) => new Date(Date.parse(NOW) + days * 86_400_000).toISOString();

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

const wrong: AttemptSignal = { isCorrect: false };
const right: AttemptSignal = { isCorrect: true };
const skipped: AttemptSignal = { isCorrect: false, skipped: true };

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

/** buildQuiz with the boring arguments defaulted. */
const build = (over: Partial<BuildQuizInput> & Pick<BuildQuizInput, 'masteries' | 'pool' | 'total'>) =>
  buildQuiz({
    queue: [],
    config: AWE_CONFIG,
    daysToExam: null,
    reviewsDue: {},
    seenQuestions: {},
    now: NOW,
    ...over,
  });

// The pools are module-level singletons; the engine reads them synchronously.
beforeEach(() => resetFlashcardPool());

describe('R001 — back-to-back failure → very_weak (high-value topics only)', () => {
  it('flags an Arithmetic concept very_weak after back-to-back fails and queues replicas + flashcards + review', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl'); // Profit & Loss: topicWeight 1.0, freq 1.3

    engine.onAttemptSaved(q, wrong, NOW); // attempt 1 — first-wrong (R002), learning
    engine.onAttemptSaved(q, wrong, NOW); // attempt 2 — consecutive 2, but attempts < 3
    expect(store.getMasteries()['sub-pl'].status).toBe('learning');

    engine.onAttemptSaved(q, wrong, NOW); // attempt 3 — all R001 conditions met
    const m = store.getMasteries()['sub-pl'];
    expect(m.status).toBe('very_weak');
    expect(m.everWasVeryWeak).toBe(true);
    expect(m.firstWeakAt).toBe(NOW);

    const queue = store.getQueue();
    expect(queue.some((i) => i.reason === 'replica_reinforcement' && i.preferReplicas)).toBe(true);
    expect(Object.keys(store.getFlashcards()).length).toBeGreaterThan(0); // fc-pl-1 materialized
    expect(store.getMeta().reviewsDue['sub-pl']).toBeDefined(); // review in 3 days
  });

  it('fires on RECENT form, not lifetime accuracy — a strong student who collapses is caught', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl');

    for (let i = 0; i < 40; i++) engine.onAttemptSaved(q, right, NOW);
    expect(store.getMasteries()['sub-pl'].accuracy).toBe(100);

    // The collapse. Lifetime accuracy stays ~83%, which is why gating on it
    // made this rule unreachable for anyone with history.
    for (let i = 0; i < 6; i++) engine.onAttemptSaved(q, wrong, NOW);

    const m = store.getMasteries()['sub-pl'];
    expect(m.accuracy).toBeGreaterThan(50); // lifetime accuracy never dropped
    expect(m.status).toBe('very_weak'); // …and the rule fired anyway
  });

  it('gives a low-weight Number System concept the gentler `weak` path, not very_weak', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-n', 'sub-numsys'); // topicWeight 0.4 < 0.7 gate

    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);

    const m = store.getMasteries()['sub-numsys'];
    expect(m.status).toBe('weak'); // noticed…
    expect(m.everWasVeryWeak).toBe(false); // …but no pre-CAT scar, no replica burst
    expect(store.getQueue().some((i) => i.reason === 'replica_reinforcement')).toBe(false);
  });
});

describe('Skips are evidence, not silence', () => {
  it('records skips, offers help, and blocks mastery without polluting accuracy', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl');

    engine.onAttemptSaved(q, skipped, NOW);
    engine.onAttemptSaved(q, skipped, NOW);

    const m = store.getMasteries()['sub-pl'];
    expect(m.skips).toBe(2);
    expect(m.attempts).toBe(0); // answered-only, per Doc 5 §3
    expect(m.accuracy).toBe(0);
    expect(m.weaknessScore).toBeGreaterThan(0); // but it does rank as a weakness
    expect(store.getQueue().length).toBeGreaterThan(0); // help was offered
  });
});

describe('R003–R005 — quiz transitions and the mastery bar', () => {
  it('does NOT promote a very_weak concept on a single lucky answer', () => {
    const m = makeMastery('sub-pl', { status: 'very_weak', attempts: 5, correct: 1, accuracy: 20 });
    const { mastery } = applyConceptQuizResult(m, 100, 1, NOW, AWE_CONFIG);
    expect(mastery.status).toBe('very_weak'); // n=1 is not evidence
  });

  it('walks very_weak → improving → mastered only across separate sessions', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-quad', 'sub-quad'); // Algebra 0.95 — high value

    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);
    expect(store.getMasteries()['sub-quad'].status).toBe('very_weak');

    // Session 1: a genuine run of clean answers.
    for (let i = 0; i < 10; i++) engine.onAttemptSaved(q, right, NOW);
    engine.onSessionCompleted(
      Array.from({ length: 4 }, () => ({ question: q, isCorrect: true })),
      NOW
    );
    expect(store.getMasteries()['sub-quad'].status).toBe('improving'); // NOT mastered yet

    // Session 2 confirms it.
    for (let i = 0; i < 4; i++) engine.onAttemptSaved(q, right, at(1));
    engine.onSessionCompleted(
      Array.from({ length: 4 }, () => ({ question: q, isCorrect: true })),
      at(1)
    );

    const m = store.getMasteries()['sub-quad'];
    expect(m.status).toBe('mastered');
    expect(m.everWasVeryWeak).toBe(true); // the scar persists through mastery

    // auto opt-out: mastered concept is absent from the weak slice
    const pool = [makeQ('p1', 'sub-quad'), makeQ('p2', 'sub-quad'), makeQ('p3', 'sub-quad')];
    const { slots } = build({ masteries: Object.values(store.getMasteries()), pool, total: 3 });
    expect(
      slots.filter((s) => s.reason === 'weak_concept' || s.reason === 'replica_reinforcement')
    ).toHaveLength(0);
  });

  it('R003: learning → weak on a poor concept quiz', () => {
    const m = makeMastery('sub-pl', { status: 'learning', attempts: 4, correct: 2, accuracy: 50 });
    const { mastery } = applyConceptQuizResult(m, 50, 4, NOW, AWE_CONFIG);
    expect(mastery.status).toBe('weak');
    expect(mastery.everWasWeak).toBe(true);
  });

  it('R003b: an improving concept that regresses drops back to weak', () => {
    const m = makeMastery('sub-pl', {
      status: 'improving',
      attempts: 12,
      correct: 6,
      accuracy: 50,
      improvingSessions: 1,
    });
    const { mastery } = applyConceptQuizResult(m, 0, 4, NOW, AWE_CONFIG);
    expect(mastery.status).toBe('weak'); // the missing downward edge
    expect(mastery.timesReopened).toBe(1);
  });

  it('a concept the student was ALWAYS good at can reach mastered', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl');

    for (let i = 0; i < 12; i++) engine.onAttemptSaved(q, right, NOW);
    engine.onSessionCompleted(
      Array.from({ length: 4 }, () => ({ question: q, isCorrect: true })),
      NOW
    );
    expect(store.getMasteries()['sub-pl'].status).toBe('learning'); // one session isn't enough

    engine.onSessionCompleted(
      Array.from({ length: 4 }, () => ({ question: q, isCorrect: true })),
      at(1)
    );
    expect(store.getMasteries()['sub-pl'].status).toBe('mastered');
  });

  it('a chronically slow concept is not mastered', () => {
    const m = makeMastery('sub-pl', {
      status: 'improving',
      attempts: 20,
      correct: 19,
      accuracy: 95,
      last10: Array(10).fill(true),
      masteryScore: 90,
      improvingSessions: 2,
      avgTimeRatio: 2.4, // consistently 2.4× the expected time
    });
    const { mastery } = applyConceptQuizResult(m, 100, 4, NOW, AWE_CONFIG);
    expect(mastery.status).toBe('improving');
  });
});

describe('R006 — mastered concepts reopen after two failed revisions', () => {
  const mastered = () =>
    makeMastery('sub-pl', {
      status: 'mastered',
      attempts: 20,
      correct: 18,
      accuracy: 90,
      resolvedAt: NOW,
      everWasVeryWeak: true,
    });

  it('first failed revision counts, second reopens to weak', () => {
    const after1 = applyConceptQuizResult(mastered(), 40, 4, NOW, AWE_CONFIG).mastery;
    expect(after1.status).toBe('mastered'); // one bad day isn't a relapse
    expect(after1.revisionFails).toBe(1);

    const after2 = applyConceptQuizResult(after1, 40, 4, at(3), AWE_CONFIG).mastery;
    expect(after2.status).toBe('weak'); // two in a row is
    expect(after2.timesReopened).toBe(1);
    expect(after2.resolvedAt).toBeNull();
  });

  it('"twice in a row" is bounded in time — a fail months later starts over', () => {
    const after1 = applyConceptQuizResult(mastered(), 40, 4, NOW, AWE_CONFIG).mastery;
    const muchLater = applyConceptQuizResult(after1, 40, 4, at(120), AWE_CONFIG).mastery;
    expect(muchLater.status).toBe('mastered');
    expect(muchLater.revisionFails).toBe(1); // reset, then counted again
  });

  it('a passing revision in the 60–80% band decays the counter instead of ignoring it', () => {
    const after1 = applyConceptQuizResult(mastered(), 40, 4, NOW, AWE_CONFIG).mastery;
    const afterOk = applyConceptQuizResult(after1, 70, 4, at(2), AWE_CONFIG).mastery;
    expect(afterOk.revisionFails).toBe(0);
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

    const { slots } = build({ masteries, pool, total: 10 });

    expect(slots).toHaveLength(10);
    expect(
      slots.filter((s) => s.reason === 'weak_concept' || s.reason === 'replica_reinforcement')
    ).toHaveLength(7);
    expect(slots.filter((s) => s.reason === 'revision')).toHaveLength(2);
    expect(slots.filter((s) => s.reason === 'balanced_practice')).toHaveLength(1);

    expect(slots[0].conceptId).toBe('sub-pl'); // weakest leads
    expect(slots[0].question.isReplica).toBe(true); // very_weak prefers replicas
    expect(slots.some((s) => s.conceptId === 'sub-tri')).toBe(false); // mastered opted out
  });

  it('the mixed slice survives small quizzes instead of being rounded away', () => {
    const masteries = [
      makeMastery('sub-pl', { status: 'weak', attempts: 5, accuracy: 30, priorityWeight: 1.3 }),
      makeMastery('sub-quad', { status: 'improving', attempts: 8, accuracy: 75, priorityWeight: 0.5 }),
    ];
    const pool = [
      ...[1, 2, 3, 4].map((i) => makeQ(`pl-${i}`, 'sub-pl')),
      ...[1, 2].map((i) => makeQ(`quad-${i}`, 'sub-quad')),
      ...[1, 2].map((i) => makeQ(`avg-${i}`, 'sub-avg')),
    ];

    const { slots } = build({ masteries, pool, total: 5 });
    expect(slots).toHaveLength(5);
    expect(slots.filter((s) => s.reason === 'balanced_practice').length).toBeGreaterThan(0);
  });

  it('honours a queue item\'s count instead of consuming it on one question', () => {
    const masteries = [
      makeMastery('sub-pl', { status: 'weak', attempts: 5, accuracy: 30, priorityWeight: 1.3 }),
    ];
    const queue = [
      {
        id: 'q1',
        conceptId: 'sub-pl',
        reason: 'replica_reinforcement' as const,
        priority: 1.3,
        preferReplicas: true,
        count: 5,
        served: 0,
        consumed: false,
        createdAt: NOW,
      },
    ];
    const pool = [...[1, 2, 3, 4, 5].map((i) => makeQ(`pl-${i}`, 'sub-pl'))];

    const { queueServed } = build({ masteries, pool, queue, total: 2 });
    expect(queueServed['q1']).toBe(2); // credited for 2, not marked fully consumed
  });

  it('does not re-serve questions inside the cooldown window', () => {
    const masteries = [
      makeMastery('sub-pl', { status: 'weak', attempts: 5, accuracy: 30, priorityWeight: 1.3 }),
    ];
    const pool = [1, 2, 3, 4].map((i) => makeQ(`pl-${i}`, 'sub-pl'));
    const seenQuestions = { 'pl-1': NOW, 'pl-2': NOW };

    const { slots } = build({ masteries, pool, total: 2, seenQuestions });
    expect(slots.map((s) => s.question.id).sort()).toEqual(['pl-3', 'pl-4']);
  });

  it('holds mastered concepts back to the last resort when backfilling', () => {
    const masteries = [
      makeMastery('sub-tri', { status: 'mastered', attempts: 20, accuracy: 95, priorityWeight: 0.1 }),
      makeMastery('sub-pl', { status: 'weak', attempts: 5, accuracy: 30, priorityWeight: 1.3 }),
    ];
    const pool = [makeQ('t1', 'sub-tri'), makeQ('t2', 'sub-tri'), makeQ('p1', 'sub-pl')];

    const { slots } = build({ masteries, pool, total: 2 });
    expect(slots[0].conceptId).toBe('sub-pl'); // the weak concept wins the first slot
  });

  it('uses the question rows own taxonomy weights for UUID-keyed concepts', () => {
    // No mastery records at all: the mixed slice must still know that the
    // heavier concept matters more. SUBTOPIC_META is keyed by mock slugs and
    // misses entirely for real UUIDs.
    const heavy: MockQuestion = { ...makeQ('h1', 'uuid-heavy'), topicWeight: 1, frequencyWeight: 1.3 };
    const light: MockQuestion = { ...makeQ('l1', 'uuid-light'), topicWeight: 0.4, frequencyWeight: 0.4 };

    const { slots } = build({ masteries: [], pool: [light, heavy], total: 1 });
    expect(slots[0].conceptId).toBe('uuid-heavy');
  });
});

describe('R009 — pre-CAT revival of old scars', () => {
  const masteries = () => [
    makeMastery('sub-tsd', { status: 'weak', attempts: 5, accuracy: 40, priorityWeight: 1.2 }),
    makeMastery('sub-pl', {
      status: 'mastered',
      attempts: 20,
      accuracy: 90,
      everWasVeryWeak: true,
      priorityWeight: 0.2,
    }),
  ];
  const pool = () => [
    ...[1, 2, 3, 4].map((i) => makeQ(`tsd-${i}`, 'sub-tsd')),
    ...[1, 2].map((i) => makeQ(`pl-${i}`, 'sub-pl')),
  ];

  it('inside the 30-day window, the mixed slice pulls mastered-but-once-very-weak concepts', () => {
    const { slots } = build({ masteries: masteries(), pool: pool(), total: 5, daysToExam: 20 });
    const revival = slots.filter((s) => s.reason === 'old_weakness_revival');
    expect(revival.length).toBeGreaterThan(0);
    expect(revival[0].conceptId).toBe('sub-pl');
  });

  it('outside the window, the same mastered concept stays retired', () => {
    const { slots } = build({ masteries: masteries(), pool: pool(), total: 4, daysToExam: 90 });
    expect(slots.some((s) => s.reason === 'old_weakness_revival')).toBe(false);
  });

  it('the engine actually computes daysToExam from the stored exam date', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    expect(engine.daysToExam(NOW)).toBeNull();
    engine.setExamDate(at(20));
    expect(engine.daysToExam(NOW)).toBe(20);
  });
});

describe('SM-2 flashcards (R010/R011)', () => {
  it('never shortens the interval on a success', () => {
    let s = initFlashcardState('fc-1', 'sub-pl', NOW);
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      s = reviewCard(s, 'good', NOW);
      intervals.push(s.intervalDays);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it('"again" shrinks ease, re-enters learning, and comes back within minutes', () => {
    let s = initFlashcardState('fc-2', 'sub-pl', NOW);
    s = reviewCard(s, 'good', NOW); // graduate
    s = reviewCard(s, 'good', NOW);
    const beforeEase = s.easeFactor;

    s = reviewCard(s, 'again', NOW);
    expect(s.easeFactor).toBeLessThan(beforeEase);
    expect(s.consecutiveCorrect).toBe(0);
    expect(s.mastery).toBe('learning');
    expect(s.lapses).toBe(1);
    // due in minutes, not a day
    expect(new Date(s.nextReviewAt).getTime() - Date.parse(NOW)).toBeLessThan(3_600_000);
  });

  it('the ease factor moves in BOTH directions', () => {
    let s = initFlashcardState('fc-3', 'sub-pl', NOW);
    const start = s.easeFactor;
    s = reviewCard(s, 'easy', NOW);
    expect(s.easeFactor).toBeGreaterThan(start);
    s = reviewCard(s, 'again', NOW);
    expect(s.easeFactor).toBeLessThan(start + 0.1);
  });

  it('schedules on day boundaries, so an evening review is due next morning — not 24h later', () => {
    // 9pm local. With timestamp arithmetic this card would not be due until 9pm
    // the following day, so an evening study habit pushed every card further
    // out, every single review.
    const evening = new Date(2026, 6, 18, 21, 0, 0).toISOString();
    const s = reviewCard(initFlashcardState('fc-4', 'sub-pl', evening), 'good', evening);

    expect(s.intervalDays).toBe(1);
    const due = new Date(s.nextReviewAt);
    expect(due.getHours()).toBe(0);
    expect(due.getMinutes()).toBe(0);
    expect(due.getDate()).toBe(19);

    expect(isDue(s, new Date(2026, 6, 19, 9, 0, 0).toISOString())).toBe(true);
    expect(isDue(s, new Date(2026, 6, 18, 23, 0, 0).toISOString())).toBe(false);
  });

  it('re-queueing a concepts cards resurfaces ones already scheduled far out', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    const q = makeQ('q-a', 'sub-pl');

    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW); // very_weak → cards materialised

    const cardId = Object.keys(store.getFlashcards())[0];
    for (let i = 0; i < 6; i++) engine.reviewFlashcard(cardId, 'good', NOW);
    expect(engine.getDueFlashcards(NOW)).toHaveLength(0); // scheduled far out

    // The concept regresses. The card must come back.
    const m = store.getMasteries()['sub-pl'];
    store.saveMasteries({ 'sub-pl': { ...m, status: 'weak', consecutiveIncorrect: 0 } });
    engine.onAttemptSaved(q, wrong, NOW);
    engine.onAttemptSaved(q, wrong, NOW);

    expect(engine.getDueFlashcards(NOW).length).toBeGreaterThan(0);
  });

  it('backfills cards for concepts that are ALREADY weak, not just ones that just flipped', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);

    // Weakness that predates the card bank (or a rule change): the concept is
    // weak, but no queue_flashcards action ever fired for it. This is the real
    // shape of a low-weight topic like Modern Maths (topicWeight 0.45), which
    // never met R001's high-value gate at all.
    store.saveMasteries({
      'sub-pl': makeMastery('sub-pl', { status: 'weak', attempts: 4, correct: 0, accuracy: 0, priorityWeight: 1.3 }),
      'sub-tsd': makeMastery('sub-tsd', { status: 'very_weak', attempts: 5, correct: 1, accuracy: 20, priorityWeight: 1.2 }),
      'sub-quad': makeMastery('sub-quad', { status: 'mastered', attempts: 20, correct: 19, accuracy: 95 }),
    });
    expect(engine.getDueFlashcards(NOW)).toHaveLength(0);

    const created = engine.backfillWeakConceptCards(NOW);
    expect(created).toBeGreaterThan(0);

    const due = engine.getDueFlashcards(NOW).map((s) => s.conceptId);
    expect(due).toContain('sub-pl');
    expect(due).toContain('sub-tsd');
    expect(due).not.toContain('sub-quad'); // mastered concepts stay retired
  });

  it('backfilling is idempotent and never resets an existing SM-2 schedule', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    store.saveMasteries({
      'sub-pl': makeMastery('sub-pl', { status: 'weak', attempts: 4, correct: 0, accuracy: 0 }),
    });

    engine.backfillWeakConceptCards(NOW);
    const cardId = Object.keys(store.getFlashcards())[0];
    for (let i = 0; i < 5; i++) engine.reviewFlashcard(cardId, 'good', NOW);
    const scheduled = store.getFlashcards()[cardId].nextReviewAt;

    expect(engine.backfillWeakConceptCards(NOW)).toBe(0); // nothing new to create
    expect(store.getFlashcards()[cardId].nextReviewAt).toBe(scheduled); // untouched
  });

  it('prunes card state whose card no longer exists in the pool', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);
    store.saveFlashcards({
      ghost: initFlashcardState('ghost', 'sub-gone', NOW),
      'fc-pl-1': initFlashcardState('fc-pl-1', 'sub-pl', NOW),
    });
    expect(engine.pruneOrphanFlashcards()).toBe(1);
    expect(engine.getLiveFlashcardStates().map((s) => s.cardId)).toEqual(['fc-pl-1']);
  });
});

describe('§5 — mastery rises slow, falls fast', () => {
  it('one wrong answer cuts ~30%; recovery is gradual', () => {
    expect(updateMasteryScore(80, { isCorrect: false }, 50, AWE_CONFIG)).toBe(56); // 80 × 0.7
    const step1 = updateMasteryScore(56, { isCorrect: true }, 100, AWE_CONFIG);
    expect(step1).toBeCloseTo(69.2);
    expect(step1).toBeLessThan(80); // one right answer doesn't undo one wrong
  });

  it('a correct-but-slow answer earns less than a quick one', () => {
    const quick = updateMasteryScore(50, {
      isCorrect: true,
      timeTakenSeconds: 40,
      expectedTimeSeconds: 60,
    }, 100, AWE_CONFIG);
    const slow = updateMasteryScore(50, {
      isCorrect: true,
      timeTakenSeconds: 200,
      expectedTimeSeconds: 60,
    }, 100, AWE_CONFIG);
    expect(slow).toBeLessThan(quick);
  });

  it('the flashcard nudge cannot inflate a weak concept by flip-flopping', () => {
    const weak = makeMastery('sub-pl', { masteryScore: 20, attempts: 5, correct: 1, accuracy: 20 });
    const afterBoth = applyFlashcardSignal(
      applyFlashcardSignal(weak, true, NOW, AWE_CONFIG),
      false,
      NOW,
      AWE_CONFIG
    );
    expect(afterBoth.masteryScore).toBeLessThan(weak.masteryScore);
  });
});

describe('weakness ranking', () => {
  it('a single unlucky first attempt does not outrank a demonstrated weakness', () => {
    const fluke = makeMastery('a', { attempts: 1, correct: 0, incorrect: 1, accuracy: 0, lastAttemptAt: NOW });
    const real = makeMastery('b', { attempts: 20, correct: 9, incorrect: 11, accuracy: 45, lastAttemptAt: NOW });
    recomputeScores(fluke, NOW, AWE_CONFIG);
    recomputeScores(real, NOW, AWE_CONFIG);
    expect(real.weaknessScore).toBeGreaterThan(fluke.weaknessScore);
  });
});

describe('persisted state', () => {
  it('migrates a v1 blob without losing history', () => {
    const v1 = {
      masteries: {
        'sub-pl': {
          conceptId: 'sub-pl',
          conceptName: 'Profit & Loss',
          topicName: 'Arithmetic',
          topicWeight: 1,
          frequencyWeight: 1.3,
          attempts: 10,
          correct: 4,
          incorrect: 6,
          accuracy: 40,
          consecutiveCorrect: 0,
          consecutiveIncorrect: 2,
          last10: [false, true, false],
          masteryScore: 30,
          weaknessScore: 60,
          priorityWeight: 0.9,
          status: 'weak',
          everWasWeak: true,
          everWasVeryWeak: true,
          firstWeakAt: NOW,
          resolvedAt: null,
          timesReopened: 0,
          revisionFails: 1,
          lastAttemptAt: NOW,
        },
      },
      queue: [
        { id: 'q1', conceptId: 'sub-pl', reason: 'weak_concept', priority: 1, preferReplicas: false, count: 3, consumed: true, createdAt: NOW },
      ],
      flashcards: {
        'fc-pl-1': { cardId: 'fc-pl-1', conceptId: 'sub-pl', easeFactor: 2.3, intervalDays: 8, consecutiveCorrect: 2, reviewCount: 2, mastery: 'reviewing', nextReviewAt: NOW, lastReviewedAt: NOW },
      },
      meta: { examDate: null, reviewsDue: {}, lastDailyTick: null },
    };

    const s = migrateSnapshot(v1);
    expect(s.masteries['sub-pl'].attempts).toBe(10);
    expect(s.masteries['sub-pl'].everWasVeryWeak).toBe(true);
    expect(s.masteries['sub-pl'].skips).toBe(0); // new field defaulted
    expect(s.queue[0].served).toBe(3); // consumed → fully served
    expect(s.flashcards['fc-pl-1'].learningStep).toBe(-1); // reviewed → graduated
    expect(s.meta.seenQuestions).toEqual({});
  });

  it('merges two devices instead of one clobbering the other', () => {
    const laptop = migrateSnapshot({
      masteries: { a: { ...makeMastery('a', { attempts: 20, correct: 10 }) } },
      meta: { seenQuestions: { q1: NOW } },
    });
    const phone = migrateSnapshot({
      masteries: {
        a: { ...makeMastery('a', { attempts: 3, correct: 1, everWasVeryWeak: true }) },
        b: { ...makeMastery('b', { attempts: 5, correct: 2 }) },
      },
      meta: { seenQuestions: { q2: NOW } },
    });

    const merged = mergeSnapshots(laptop, phone);
    expect(merged.masteries['a'].attempts).toBe(20); // more evidence wins
    expect(merged.masteries['a'].everWasVeryWeak).toBe(true); // scars are never merged away
    expect(merged.masteries['b']).toBeDefined(); // the other device's work survives
    expect(Object.keys(merged.meta.seenQuestions).sort()).toEqual(['q1', 'q2']);
  });
});

describe('daily tick', () => {
  it('prunes served queue items and stale seen-question entries, once per day', () => {
    const store = new MemoryAweStore();
    const engine = new AweEngine(store);

    store.saveQueue([
      { id: 'done', conceptId: 'sub-pl', reason: 'weak_concept', priority: 1, preferReplicas: false, count: 2, served: 2, consumed: true, createdAt: NOW },
      { id: 'open', conceptId: 'sub-tsd', reason: 'weak_concept', priority: 1, preferReplicas: false, count: 2, served: 0, consumed: false, createdAt: NOW },
    ]);
    store.saveMeta({
      examDate: null,
      reviewsDue: {},
      lastDailyTick: null,
      seenQuestions: { old: at(-60), recent: at(-1) },
    });

    expect(engine.dailyTick(NOW)).toBe(true);
    expect(store.getQueue().map((i) => i.id)).toEqual(['open']);
    expect(Object.keys(store.getMeta().seenQuestions)).toEqual(['recent']);

    expect(engine.dailyTick(NOW)).toBe(false); // idempotent within the day
  });
});

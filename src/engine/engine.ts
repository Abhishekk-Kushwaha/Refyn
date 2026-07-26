import { AWE_CONFIG, AweConfig } from './aweConfig';
import { applyAttempt, applyConceptQuizResult, applyFlashcardSignal, initConceptMastery } from './rules';
import { buildQuiz } from './quizBuilder';
import { initFlashcardState, isDue, isLearning, previewIntervals, resurface, reviewCard } from './flashcardSM2';
import { AweStore } from './store';
import { AweStoreError, HybridAweStore } from './hybridStore';
import {
  AttemptSignal,
  ConceptMastery,
  EngineAction,
  FlashcardState,
  QueueItem,
  ReviewGrade,
} from './types';
import { MockQuestion, SUBTOPIC_META } from '@/lib/mockQuestions';
import { getFlashcardPool } from '@/services/flashcardPool';

// ============================================================
// AWE ENGINE FACADE — the three triggers (Doc 5 §10) over pure rules.
// onAttemptSaved fires per question during the session; onSessionCompleted
// fires once at the end; dailyTick does the housekeeping and buildDailyQuiz
// composes the 70/20/10 blend.
// ============================================================

const DAY_MS = 1000 * 60 * 60 * 24;

export interface SessionOutcome {
  question: MockQuestion;
  isCorrect: boolean;
  skipped?: boolean;
}

export class AweEngine {
  constructor(
    private store: AweStore,
    private config: AweConfig = AWE_CONFIG
  ) {}

  private getOrInitMastery(
    masteries: Record<string, ConceptMastery>,
    question: MockQuestion
  ): ConceptMastery {
    const existing = masteries[question.subtopicId];
    if (existing) return existing;
    // Prefer weights carried on the question (real Supabase taxonomy); fall back
    // to the mock meta table, then to neutral 1.0.
    const meta = SUBTOPIC_META[question.subtopicId] ?? { frequencyWeight: 1, topicWeight: 1 };
    return initConceptMastery({
      conceptId: question.subtopicId,
      conceptName: question.subtopicName,
      topicName: question.topicName,
      topicWeight: question.topicWeight ?? meta.topicWeight,
      frequencyWeight: question.frequencyWeight ?? meta.frequencyWeight,
    });
  }

  /**
   * Materialise (or resurface) a concept's cards.
   *
   * Creating state only when absent made `queue_flashcards` a permanent no-op
   * after the first firing: a concept that regressed months later re-queued
   * cards that were still scheduled 60 days out, so nothing ever appeared.
   */
  private materializeCards(
    cards: Record<string, FlashcardState>,
    conceptId: string,
    count: number,
    now: string
  ): boolean {
    const available = getFlashcardPool()
      .filter((c) => c.conceptId === conceptId)
      // Deterministic, and least-established cards first, so repeated queues
      // reach cards 4 and 5 instead of always re-picking the same slice.
      .sort((a, b) => {
        const sa = cards[a.id];
        const sb = cards[b.id];
        const rank = (s: FlashcardState | undefined) => (s ? s.intervalDays + 1 : 0);
        return rank(sa) - rank(sb) || a.id.localeCompare(b.id);
      })
      .slice(0, Math.max(1, count));

    let changed = false;
    for (const card of available) {
      const existing = cards[card.id];
      if (!existing) {
        cards[card.id] = initFlashcardState(card.id, card.conceptId, now, this.config);
        changed = true;
      } else {
        const next = resurface(existing, now);
        if (next !== existing) {
          cards[card.id] = next;
          changed = true;
        }
      }
    }
    return changed;
  }

  private executeActions(actions: EngineAction[], now: string): void {
    if (actions.length === 0) return;
    const queue = this.store.getQueue();
    const flashcards = this.store.getFlashcards();
    const meta = this.store.getMeta();
    const masteries = this.store.getMasteries();
    let queueChanged = false;
    let cardsChanged = false;
    let metaChanged = false;

    for (const action of actions) {
      if (action.type === 'queue_questions') {
        const priority = masteries[action.conceptId]?.priorityWeight ?? 1;
        // Top up an existing open request rather than stacking duplicates —
        // consumed items were never pruned and the queue grew without bound.
        const open = queue.find(
          (i) => !i.consumed && i.conceptId === action.conceptId && i.reason === action.reason
        );
        if (open) {
          open.count = Math.max(open.count, open.served + action.count);
          open.priority = priority;
          open.preferReplicas = open.preferReplicas || action.preferReplicas;
        } else {
          queue.push({
            id: `${action.conceptId}-${action.reason}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conceptId: action.conceptId,
            reason: action.reason,
            priority,
            preferReplicas: action.preferReplicas,
            count: action.count,
            served: 0,
            consumed: false,
            createdAt: now,
          } satisfies QueueItem);
        }
        queueChanged = true;
      } else if (action.type === 'queue_flashcards') {
        if (this.materializeCards(flashcards, action.conceptId, action.count, now)) {
          cardsChanged = true;
        }
      } else if (action.type === 'schedule_review') {
        meta.reviewsDue[action.conceptId] = new Date(
          new Date(now).getTime() + action.daysFromNow * DAY_MS
        ).toISOString();
        metaChanged = true;
      }
    }

    if (queueChanged) this.store.saveQueue(queue);
    if (cardsChanged) this.store.saveFlashcards(flashcards);
    if (metaChanged) this.store.saveMeta(meta);
  }

  /**
   * Trigger 1 — after every answered *or skipped* question.
   *
   * Called live from the session, not batched on the results screen: batching
   * meant a student who closed the tab mid-quiz taught the engine nothing, and
   * every attempt landed on an identical timestamp.
   */
  onAttemptSaved(
    question: MockQuestion,
    signal: AttemptSignal,
    now = new Date().toISOString()
  ): void {
    const masteries = this.store.getMasteries();
    const current = this.getOrInitMastery(masteries, question);
    const enriched: AttemptSignal = {
      ...signal,
      difficulty: signal.difficulty ?? question.difficulty,
      expectedTimeSeconds: signal.expectedTimeSeconds ?? question.expectedTimeSeconds,
    };
    const { mastery, actions } = applyAttempt(current, enriched, now, this.config);
    masteries[mastery.conceptId] = mastery;
    this.store.saveMasteries(masteries);
    this.executeActions(actions, now);
  }

  /** Trigger 2 — once when a session ends, with every result it contained. */
  onSessionCompleted(results: SessionOutcome[], now = new Date().toISOString()): void {
    if (results.length === 0) return;

    // Per-concept session accuracy, plus the sample size behind it. A concept
    // that contributed one question is not evidence of a lifecycle change.
    const byConcept = new Map<string, { correct: number; answered: number }>();
    for (const r of results) {
      if (r.skipped) continue;
      const entry = byConcept.get(r.question.subtopicId) ?? { correct: 0, answered: 0 };
      entry.answered += 1;
      if (r.isCorrect) entry.correct += 1;
      byConcept.set(r.question.subtopicId, entry);
    }

    const masteries = this.store.getMasteries();
    const allActions: EngineAction[] = [];
    for (const [conceptId, { correct, answered }] of byConcept) {
      const current = masteries[conceptId];
      if (!current || answered === 0) continue;
      const quizAccuracy = (correct / answered) * 100;
      const { mastery, actions } = applyConceptQuizResult(
        current,
        quizAccuracy,
        answered,
        now,
        this.config
      );
      masteries[conceptId] = mastery;
      allActions.push(...actions);
    }
    this.store.saveMasteries(masteries);
    this.executeActions(allActions, now);
  }

  /** Trigger 3 — housekeeping, once per day, idempotent within the day. */
  dailyTick(now = new Date().toISOString()): boolean {
    const meta = this.store.getMeta();
    const today = now.slice(0, 10);
    if (meta.lastDailyTick?.slice(0, 10) === today) return false;

    const nowMs = new Date(now).getTime();

    // 1. Drop fully-served queue items — they were never pruned and grew forever.
    const queue = this.store.getQueue().filter((i) => !i.consumed);
    this.store.saveQueue(queue);

    // 2. Expire scheduled reviews that have long since passed, and seen-question
    //    entries older than the cooldown, so the blob stays bounded.
    const cooldownMs = this.config.question_cooldown_days * DAY_MS;
    const reviewsDue: Record<string, string> = {};
    for (const [conceptId, iso] of Object.entries(meta.reviewsDue)) {
      if (nowMs - new Date(iso).getTime() < 90 * DAY_MS) reviewsDue[conceptId] = iso;
    }
    const seen = Object.entries(meta.seenQuestions)
      .filter(([, iso]) => nowMs - new Date(iso).getTime() < cooldownMs)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, this.config.seen_history_limit);

    this.store.saveMeta({
      ...meta,
      reviewsDue,
      seenQuestions: Object.fromEntries(seen),
      lastDailyTick: now,
    });

    // 3. Drop card states whose card no longer exists in the pool.
    this.pruneOrphanFlashcards();
    return true;
  }

  /**
   * Ensure every currently-weak concept actually has cards available.
   *
   * `queue_flashcards` only fires at the moment a concept *changes* state, so a
   * concept that was already weak got nothing: no cards if the card bank landed
   * later, and none for low-weight topics whose weakness never triggered R001 at
   * all. A student with eight weak Modern Maths concepts would see one card.
   *
   * Only creates state that is missing — existing cards keep their SM-2
   * schedule, so this is idempotent and never tramples spacing.
   */
  backfillWeakConceptCards(now = new Date().toISOString()): number {
    const pool = getFlashcardPool();
    if (pool.length === 0) return 0;

    const cards = this.store.getFlashcards();
    const perConcept = this.config.flashcard_backfill_per_concept;
    let created = 0;

    const weak = Object.values(this.store.getMasteries())
      .filter((m) => m.status === 'weak' || m.status === 'very_weak')
      .sort((a, b) => b.priorityWeight - a.priorityWeight);

    for (const concept of weak) {
      const available = pool
        .filter((c) => c.conceptId === concept.conceptId && !cards[c.id])
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, perConcept);
      for (const card of available) {
        cards[card.id] = initFlashcardState(card.id, card.conceptId, now, this.config);
        created += 1;
      }
    }

    if (created > 0) this.store.saveFlashcards(cards);
    return created;
  }

  /**
   * Remove SM-2 state for cards that are not in the current pool.
   *
   * Orphans (from a demo→account pool switch, or a re-seeded bank) were counted
   * as "materialised" but filtered out of the deck, so the Flashcards tab showed
   * "All caught up" forever while holding zero reviewable cards.
   */
  pruneOrphanFlashcards(): number {
    const live = new Set(getFlashcardPool().map((c) => c.id));
    if (live.size === 0) return 0; // pool not loaded yet — don't nuke valid state
    const cards = this.store.getFlashcards();
    let removed = 0;
    for (const id of Object.keys(cards)) {
      if (!live.has(id)) {
        delete cards[id];
        removed += 1;
      }
    }
    if (removed > 0) this.store.saveFlashcards(cards);
    return removed;
  }

  /** Compose the daily blended quiz (R007). */
  buildDailyQuiz(pool: MockQuestion[], total: number, now = new Date().toISOString()): MockQuestion[] {
    const masteries = Object.values(this.store.getMasteries());
    const queue = this.store.getQueue();
    const meta = this.store.getMeta();
    const daysToExam = meta.examDate
      ? Math.ceil((new Date(meta.examDate).getTime() - new Date(now).getTime()) / DAY_MS)
      : null;

    const { slots, queueServed, servedQuestionIds } = buildQuiz({
      masteries,
      pool,
      queue,
      total,
      config: this.config,
      daysToExam,
      reviewsDue: meta.reviewsDue,
      seenQuestions: meta.seenQuestions,
      now,
    });

    // Credit the queue by how many questions each item actually contributed.
    if (Object.keys(queueServed).length > 0) {
      this.store.saveQueue(
        queue.map((item) => {
          const justServed = queueServed[item.id];
          if (!justServed) return item;
          const served = Math.min(item.count, item.served + justServed);
          return { ...item, served, consumed: served >= item.count };
        })
      );
    }

    // Record what was served so the cooldown can keep the bank rotating.
    if (servedQuestionIds.length > 0) {
      const seenQuestions = { ...meta.seenQuestions };
      for (const id of servedQuestionIds) seenQuestions[id] = now;
      this.store.saveMeta({ ...this.store.getMeta(), seenQuestions });
    }

    return slots.map((s) => s.question);
  }

  getMasteries(): ConceptMastery[] {
    return Object.values(this.store.getMasteries());
  }

  // ---- Exam date (R009's pre-CAT revival window) ----

  getExamDate(): string | null {
    return this.store.getMeta().examDate;
  }

  setExamDate(iso: string | null): void {
    const meta = this.store.getMeta();
    this.store.saveMeta({ ...meta, examDate: iso });
  }

  /** Days until the exam, or null when no date is set. */
  daysToExam(now = new Date().toISOString()): number | null {
    const examDate = this.getExamDate();
    if (!examDate) return null;
    return Math.ceil((new Date(examDate).getTime() - new Date(now).getTime()) / DAY_MS);
  }

  // ---- Flashcards (Doc 5 §8) ----

  getFlashcardStates(): FlashcardState[] {
    return Object.values(this.store.getFlashcards());
  }

  /** Card states that still have content in the current pool. */
  getLiveFlashcardStates(): FlashcardState[] {
    const live = new Set(getFlashcardPool().map((c) => c.id));
    return this.getFlashcardStates().filter((s) => live.has(s.cardId));
  }

  /**
   * Cards due now — learning-step cards first (they are mid-acquisition), then
   * weakest concept first. Capped so a long absence doesn't present a
   * hundred-card wall.
   */
  getDueFlashcards(now = new Date().toISOString(), limit = this.config.flashcard_daily_limit): FlashcardState[] {
    const masteries = this.store.getMasteries();
    return this.getLiveFlashcardStates()
      .filter((s) => isDue(s, now))
      .sort((a, b) => {
        const learningDelta = Number(isLearning(b)) - Number(isLearning(a));
        if (learningDelta !== 0) return learningDelta;
        return (
          (masteries[b.conceptId]?.priorityWeight ?? 0) -
          (masteries[a.conceptId]?.priorityWeight ?? 0)
        );
      })
      .slice(0, limit);
  }

  getFlashcardState(cardId: string): FlashcardState | null {
    return this.store.getFlashcards()[cardId] ?? null;
  }

  /**
   * Cards that exist but aren't due yet, soonest first — so a student who is
   * caught up can still choose to study ahead instead of being told to go away.
   */
  getUpcomingFlashcards(now = new Date().toISOString(), limit = this.config.flashcard_daily_limit): FlashcardState[] {
    return this.getLiveFlashcardStates()
      .filter((s) => !isDue(s, now))
      .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))
      .slice(0, limit);
  }

  /** What each grade button will schedule, so the UI never re-derives the maths. */
  previewCard(cardId: string): Record<ReviewGrade, number> | null {
    const state = this.store.getFlashcards()[cardId];
    return state ? previewIntervals(state, this.config) : null;
  }

  /**
   * Apply an SM-2 review (R010/R011) and nudge the concept's mastery.
   *
   * The nudge only moves `masteryScore`, which R005 reads as a *gate* — so
   * consistent flashcard success genuinely contributes to opting a concept out,
   * but can never satisfy the mastery bar on its own.
   */
  reviewFlashcard(
    cardId: string,
    grade: ReviewGrade,
    now = new Date().toISOString()
  ): FlashcardState {
    const cards = this.store.getFlashcards();
    const current = cards[cardId];
    if (!current) throw new Error(`Unknown flashcard state: ${cardId}`);

    const next = reviewCard(current, grade, now, this.config);
    cards[cardId] = next;
    this.store.saveFlashcards(cards);

    const masteries = this.store.getMasteries();
    const m = masteries[current.conceptId];
    if (m) {
      masteries[m.conceptId] = applyFlashcardSignal(m, grade !== 'again', now, this.config);
      this.store.saveMasteries(masteries);
    }

    return next;
  }
}

// App-wide singleton over the hybrid store. Tests construct their own with
// MemoryAweStore. The store is (re)configured per auth state via the helpers below.
const hybridStore = new HybridAweStore();
export const aweEngine = new AweEngine(hybridStore);

/** Login screen / signed out: in-memory only, so nothing bleeds between users. */
export const configureAweEphemeral = (): void => hybridStore.configureEphemeral();

/** Demo/explore: point the engine at localStorage-backed state. */
export const configureAweLocal = (): void => hybridStore.configureLocal();

/** Signed-in: hydrate the engine from the user's awe_state row. */
export const configureAweSupabase = (userId: string, examSlug: string): Promise<void> =>
  hybridStore.configureSupabase(userId, examSlug);

/** Persist any pending engine writes immediately (before sign-out). */
export const flushAwe = (): Promise<void> => hybridStore.flushNow();

/** Subscribe to persistence failures so the UI can tell the user the truth. */
export const onAweStoreError = (listener: (e: AweStoreError | null) => void): (() => void) =>
  hybridStore.onError(listener);

export const getAweStoreError = (): AweStoreError | null => hybridStore.getLastError();

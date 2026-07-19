import { AWE_CONFIG, AweConfig } from './aweConfig';
import { applyAttempt, applyConceptQuizResult, initConceptMastery } from './rules';
import { buildQuiz } from './quizBuilder';
import { initFlashcardState, isDue, reviewGotIt, reviewNotSure } from './flashcardSM2';
import { recomputeScores } from './masteryScore';
import { AweStore } from './store';
import { HybridAweStore } from './hybridStore';
import { ConceptMastery, EngineAction, FlashcardState, QueueItem } from './types';
import { MockQuestion, SUBTOPIC_META } from '@/lib/mockQuestions';
import { getFlashcardPool } from '@/services/flashcardPool';

// ============================================================
// AWE ENGINE FACADE — the three triggers (Doc 5 §10) over pure rules.
// onAttemptSaved / onSessionCompleted fire from the practice flow;
// buildDailyQuiz composes the 70/20/10 blend on demand (client-first
// stand-in for the daily tick's queue build).
// ============================================================

const DAY_MS = 1000 * 60 * 60 * 24;

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

  private executeActions(actions: EngineAction[], now: string): void {
    if (actions.length === 0) return;
    const queue = this.store.getQueue();
    const flashcards = this.store.getFlashcards();
    const meta = this.store.getMeta();
    let queueChanged = false;
    let cardsChanged = false;
    let metaChanged = false;

    for (const action of actions) {
      if (action.type === 'queue_questions') {
        const masteries = this.store.getMasteries();
        const priority = masteries[action.conceptId]?.priorityWeight ?? 1;
        queue.push({
          id: `${action.conceptId}-${action.reason}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conceptId: action.conceptId,
          reason: action.reason,
          priority,
          preferReplicas: action.preferReplicas,
          count: action.count,
          consumed: false,
          createdAt: now,
        } satisfies QueueItem);
        queueChanged = true;
      } else if (action.type === 'queue_flashcards') {
        // Materialize SM-2 state for this concept's cards so they're due now.
        const cards = getFlashcardPool().filter((c) => c.conceptId === action.conceptId).slice(
          0,
          action.count
        );
        for (const card of cards) {
          if (!flashcards[card.id]) {
            flashcards[card.id] = initFlashcardState(card.id, card.conceptId, now);
            cardsChanged = true;
          }
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

  /** Trigger 1 — after every answered question (skips never reach here). */
  onAttemptSaved(question: MockQuestion, isCorrect: boolean, now = new Date().toISOString()): void {
    const masteries = this.store.getMasteries();
    const current = this.getOrInitMastery(masteries, question);
    const { mastery, actions } = applyAttempt(current, isCorrect, now, this.config);
    masteries[mastery.conceptId] = mastery;
    this.store.saveMasteries(masteries);
    this.executeActions(actions, now);
  }

  /** Trigger 2 — once when a session ends, with every answered result. */
  onSessionCompleted(
    results: { question: MockQuestion; isCorrect: boolean }[],
    now = new Date().toISOString()
  ): void {
    if (results.length === 0) return;

    // per-concept session accuracy
    const byConcept = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      const entry = byConcept.get(r.question.subtopicId) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (r.isCorrect) entry.correct += 1;
      byConcept.set(r.question.subtopicId, entry);
    }

    const masteries = this.store.getMasteries();
    const allActions: EngineAction[] = [];
    for (const [conceptId, { correct, total }] of byConcept) {
      const current = masteries[conceptId];
      if (!current) continue; // onAttemptSaved always ran first
      const quizAccuracy = (correct / total) * 100;
      const { mastery, actions } = applyConceptQuizResult(current, quizAccuracy, now, this.config);
      masteries[conceptId] = mastery;
      allActions.push(...actions);
    }
    this.store.saveMasteries(masteries);
    this.executeActions(allActions, now);
  }

  /** Trigger 3 (client-first form) — compose the daily blended quiz on demand. */
  buildDailyQuiz(pool: MockQuestion[], total: number, now = new Date().toISOString()): MockQuestion[] {
    const masteries = Object.values(this.store.getMasteries());
    const queue = this.store.getQueue();
    const meta = this.store.getMeta();
    const daysToExam = meta.examDate
      ? Math.ceil((new Date(meta.examDate).getTime() - new Date(now).getTime()) / DAY_MS)
      : null;

    const { slots, consumedQueueIds } = buildQuiz(
      masteries,
      pool,
      queue,
      total,
      this.config,
      daysToExam,
      meta.reviewsDue,
      now
    );

    if (consumedQueueIds.length > 0) {
      const consumed = new Set(consumedQueueIds);
      this.store.saveQueue(queue.map((i) => (consumed.has(i.id) ? { ...i, consumed: true } : i)));
    }

    return slots.map((s) => s.question);
  }

  getMasteries(): ConceptMastery[] {
    return Object.values(this.store.getMasteries());
  }

  setExamDate(iso: string | null): void {
    const meta = this.store.getMeta();
    this.store.saveMeta({ ...meta, examDate: iso });
  }

  // ---- Flashcards (Doc 5 §8) ----

  getFlashcardStates(): FlashcardState[] {
    return Object.values(this.store.getFlashcards());
  }

  /** Cards due now, weakest concept first (priorityWeight desc). */
  getDueFlashcards(now = new Date().toISOString()): FlashcardState[] {
    const masteries = this.store.getMasteries();
    return this.getFlashcardStates()
      .filter((s) => isDue(s, now))
      .sort(
        (a, b) =>
          (masteries[b.conceptId]?.priorityWeight ?? 0) -
          (masteries[a.conceptId]?.priorityWeight ?? 0)
      );
  }

  /**
   * Apply an SM-2 review (R010/R011) and nudge the concept's mastery —
   * consistent flashcard success is a positive mastery signal between quizzes;
   * a "Not sure" is a guard against false mastery (Doc 5 §8).
   */
  reviewFlashcard(cardId: string, gotIt: boolean, now = new Date().toISOString()): FlashcardState {
    const cards = this.store.getFlashcards();
    const current = cards[cardId];
    if (!current) throw new Error(`Unknown flashcard state: ${cardId}`);

    const next = gotIt ? reviewGotIt(current, now) : reviewNotSure(current, now);
    cards[cardId] = next;
    this.store.saveFlashcards(cards);

    const masteries = this.store.getMasteries();
    const m = masteries[current.conceptId];
    if (m) {
      const updated = { ...m };
      updated.masteryScore = gotIt
        ? Math.min(100, Math.round((updated.masteryScore + 2) * 10) / 10)
        : Math.round(updated.masteryScore * 0.95 * 10) / 10;
      recomputeScores(updated, now);
      masteries[updated.conceptId] = updated;
      this.store.saveMasteries(masteries);
    }

    return next;
  }
}

// App-wide singleton over the hybrid store. Tests construct their own with
// MemoryAweStore. The store is (re)configured per auth state via the helpers below.
const hybridStore = new HybridAweStore();
export const aweEngine = new AweEngine(hybridStore);

/** Demo/explore: point the engine at localStorage-backed state. */
export const configureAweLocal = (): void => hybridStore.configureLocal();

/** Signed-in: hydrate the engine from the user's awe_state row. */
export const configureAweSupabase = (userId: string, examSlug: string): Promise<void> =>
  hybridStore.configureSupabase(userId, examSlug);

/** Persist any pending engine writes immediately (before sign-out). */
export const flushAwe = (): Promise<void> => hybridStore.flushNow();

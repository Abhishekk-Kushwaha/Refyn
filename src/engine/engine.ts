import { AWE_CONFIG, AweConfig } from './aweConfig';
import { applyAttempt, applyConceptQuizResult, initConceptMastery } from './rules';
import { buildQuiz } from './quizBuilder';
import { initFlashcardState } from './flashcardSM2';
import { AweStore, LocalStorageAweStore } from './store';
import { ConceptMastery, EngineAction, QueueItem } from './types';
import { MockQuestion, SUBTOPIC_META } from '@/lib/mockQuestions';
import { MOCK_FLASHCARDS } from '@/lib/mockFlashcards';

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
    const meta = SUBTOPIC_META[question.subtopicId] ?? { frequencyWeight: 1, topicWeight: 1 };
    return initConceptMastery({
      conceptId: question.subtopicId,
      conceptName: question.subtopicName,
      topicName: question.topicName,
      topicWeight: meta.topicWeight,
      frequencyWeight: meta.frequencyWeight,
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
        const cards = MOCK_FLASHCARDS.filter((c) => c.conceptId === action.conceptId).slice(
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
}

// App-wide singleton over localStorage. Tests construct their own with MemoryAweStore.
export const aweEngine = new AweEngine(new LocalStorageAweStore());

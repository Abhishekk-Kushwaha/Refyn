// AWE — Adaptive Weakness Engine types (Doc 5 §3)
// These mirror the concept_mastery / quiz_queue / user_flashcards tables so the
// Phase 1 database swap changes storage only, never shape.

export type ConceptStatus =
  | 'unattempted'
  | 'learning'
  | 'weak'
  | 'very_weak'
  | 'improving'
  | 'mastered';

export interface ConceptMastery {
  conceptId: string; // = subtopicId
  conceptName: string;
  topicName: string;
  topicWeight: number; // 1.0 Arithmetic … 0.4 Number System
  frequencyWeight: number; // 1.3 very_high … 0.4 low

  // raw signal
  attempts: number; // answered only — skips are tracked separately
  correct: number;
  incorrect: number;
  accuracy: number; // 0–100, lifetime
  consecutiveCorrect: number;
  consecutiveIncorrect: number; // powers the "back-to-back" trigger (R001)
  last10: boolean[]; // rolling window of the last 10 answered results

  // skips — a skipped question on a weak concept is evidence, so it is recorded
  // rather than discarded. It never pollutes `accuracy`, which stays
  // answered-only per Doc 5 §3.
  skips: number;
  consecutiveSkips: number;

  // pacing — EWMA of timeTaken / expectedTime. Correct-but-slow is not mastery.
  avgTimeRatio: number | null;

  // Raw seconds, kept separately for right and wrong answers.
  //
  // avgTimeRatio alone cannot express "spent five minutes and still got it
  // wrong", because it collapses both outcomes into one smoothed number and
  // discards the actual duration. Totals and counts are stored rather than a
  // running mean so the averages stay exact and can be recombined at any
  // level — concept, topic or section.
  timeCorrectTotal: number; // seconds spent on answers that were right
  timeCorrectCount: number;
  timeIncorrectTotal: number; // seconds spent on answers that were wrong
  timeIncorrectCount: number;

  // computed
  masteryScore: number; // 0–100, rises slow / falls fast (§5)
  weaknessScore: number; // dashboard ranking: "what hurts most now"
  priorityWeight: number; // queue ordering: topicW × freqW × (1 − mastery)

  // lifecycle
  status: ConceptStatus;
  everWasWeak: boolean; // permanent once true
  everWasVeryWeak: boolean; // permanent once true — the pre-CAT revival flag
  firstWeakAt: string | null;
  resolvedAt: string | null;
  timesReopened: number;
  revisionFails: number; // failed revisions while mastered (R006)
  lastRevisionFailAt: string | null; // so "twice in a row" is bounded in time
  improvingSessions: number; // consecutive qualifying sessions before mastery (R005)

  lastAttemptAt: string | null;
}

export type QueueReason =
  | 'weak_concept'
  | 'replica_reinforcement'
  | 'revision'
  | 'old_weakness_revival'
  | 'balanced_practice';

export interface QueueItem {
  id: string;
  conceptId: string;
  reason: QueueReason;
  priority: number;
  preferReplicas: boolean;
  count: number; // how many questions this item asked for
  served: number; // how many have actually been served against it
  consumed: boolean; // true once served >= count
  createdAt: string;
}

// Side-effect *intentions* returned by pure rules — the engine facade turns
// these into queue/flashcard/store writes. Rules themselves touch nothing.
export type EngineAction =
  | { type: 'queue_questions'; conceptId: string; count: number; reason: QueueReason; preferReplicas: boolean }
  | { type: 'queue_flashcards'; conceptId: string; count: number }
  | { type: 'schedule_review'; conceptId: string; daysFromNow: number };

export interface RuleResult {
  mastery: ConceptMastery;
  actions: EngineAction[];
}

/** What a single answered/skipped question tells the engine. */
export interface AttemptSignal {
  isCorrect: boolean;
  skipped?: boolean;
  difficulty?: number;
  timeTakenSeconds?: number;
  expectedTimeSeconds?: number;
}

// SM-2 flashcard state (Doc 5 §8), one per (user, card).
export type FlashcardMastery = 'new' | 'learning' | 'reviewing' | 'mastered';

/** SM-2 recall quality. Binary grading gives the ease factor nothing to work with. */
export type ReviewGrade = 'again' | 'good' | 'easy';

export interface FlashcardState {
  cardId: string;
  conceptId: string;
  easeFactor: number; // starts 2.5, clamped [1.3, 2.7]
  intervalDays: number; // 0 while in the sub-day learning steps
  consecutiveCorrect: number;
  reviewCount: number;
  lapses: number; // times the card was forgotten after graduating
  learningStep: number; // index into the learning ladder; -1 once graduated
  mastery: FlashcardMastery;
  nextReviewAt: string; // ISO — day-aligned once the card graduates
  lastReviewedAt: string | null;
}

export interface EngineMeta {
  examDate: string | null; // ISO — powers the pre-CAT revival window (R009)
  reviewsDue: Record<string, string>; // conceptId → ISO due date (schedule_review)
  lastDailyTick: string | null; // ISO — the daily tick's idempotency key
  seenQuestions: Record<string, string>; // questionId → ISO last served (cooldown)
}

/** Bumped whenever the persisted shape changes; drives migrateState(). */
// v3 added per-outcome raw timing (timeCorrect*/timeIncorrect*). Older
// snapshots migrate cleanly — the fields default to zero, since those seconds
// were never recorded and must not be invented.
export const AWE_STATE_VERSION = 3;

export interface AweSnapshot {
  version: number;
  masteries: Record<string, ConceptMastery>;
  queue: QueueItem[];
  flashcards: Record<string, FlashcardState>;
  meta: EngineMeta;
}

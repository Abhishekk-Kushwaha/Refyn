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
  attempts: number; // answered only — skips never count
  correct: number;
  incorrect: number;
  accuracy: number; // 0–100
  consecutiveCorrect: number;
  consecutiveIncorrect: number; // powers the "back-to-back" trigger (R001)
  last10: boolean[]; // rolling window of the last 10 results

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
  revisionFails: number; // consecutive failed revisions while mastered (R006)

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
  count: number;
  consumed: boolean;
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

// SM-2 flashcard state (Doc 5 §8), one per (user, card).
export type FlashcardMastery = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface FlashcardState {
  cardId: string;
  conceptId: string;
  easeFactor: number; // starts 2.5, floor 1.3
  intervalDays: number; // starts 1
  consecutiveCorrect: number;
  reviewCount: number;
  mastery: FlashcardMastery;
  nextReviewAt: string; // ISO date
  lastReviewedAt: string | null;
}

export interface EngineMeta {
  examDate: string | null; // ISO — powers the pre-CAT revival window (R009)
  reviewsDue: Record<string, string>; // conceptId → ISO due date (schedule_review)
  lastDailyTick: string | null;
}

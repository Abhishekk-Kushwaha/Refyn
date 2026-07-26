// AWE tunable thresholds (Doc 5 §11). Keys deliberately match the awe_config
// table seeded in SQL/master_setup.sql — Phase 1 swaps this object for a
// one-time table read, nothing else changes.
export const AWE_CONFIG = {
  // ---- R001 — very weak trigger -------------------------------------------
  // Applied to the ROLLING window, not lifetime accuracy: a student with a long
  // good history can still collapse on a concept, and lifetime accuracy would
  // never fall below the threshold to let the rule notice.
  very_weak_accuracy_threshold: 50, // recent-window % below which the concept is in trouble
  very_weak_min_attempts: 3, // … with at least this much total history …
  consecutive_incorrect_trigger: 2, // … and this many wrong in a row ("back-to-back")
  high_value_topic_weight: 0.7, // at/above this topic weight R001 gives the full very_weak path
  recent_window_min_size: 3, // don't trust the rolling window below this many samples

  // ---- R003/R004 — quiz-driven transitions ---------------------------------
  weak_quiz_accuracy_threshold: 60,
  improving_quiz_accuracy_threshold: 80,
  // A "concept quiz accuracy" computed from one or two questions is noise. A
  // promotion needs real evidence; a demotion is allowed to be more eager
  // because the cost of practising something extra is low.
  min_quiz_sample_promote: 3,
  min_quiz_sample_demote: 2,

  // ---- R005 — mastery bar --------------------------------------------------
  mastered_accuracy_threshold: 85,
  mastered_lookback_attempts: 10,
  // Mastery must be corroborated by the slow-moving mastery score and survive
  // more than one session, so a single hot streak can't retire a concept.
  mastered_min_mastery_score: 70,
  mastery_confirm_sessions: 2,
  // A correct-but-very-slow answer is not mastery on a speed exam.
  mastered_max_time_ratio: 1.6,

  // ---- R006 — reopening a mastered concept ---------------------------------
  revision_fail_reopen_count: 2,
  revision_fail_window_days: 45, // fails older than this no longer count as "in a row"

  // ---- R007 — daily blended quiz composition -------------------------------
  daily_quiz_weak_topic_pct: 70,
  daily_quiz_revision_pct: 20,
  daily_quiz_mixed_pct: 10,
  // Don't serve the same question again inside this window — otherwise a thin
  // concept pool is memorised and "mastery" is recall of the answer key.
  question_cooldown_days: 14,
  seen_history_limit: 800, // cap on the seen-question ledger

  // ---- R009 — pre-CAT revival window ---------------------------------------
  cat_countdown_revival_days: 30,

  // ---- §5 — mastery score dynamics (rises slow, falls fast) ----------------
  mastery_gain_rate: 0.3,
  mastery_loss_multiplier: 0.7,
  // Difficulty/speed shape how much a single answer moves the score.
  mastery_difficulty_pivot: 5, // difficulty scored as "average"
  mastery_difficulty_span: 0.5, // ±50% gain swing across the difficulty range
  mastery_slow_answer_ratio: 1.5, // time/expected above this earns a reduced gain
  mastery_slow_answer_factor: 0.6,

  // ---- Skips (a skip is evidence, not an absence of evidence) --------------
  skip_help_threshold: 2, // consecutive skips before the engine offers help
  skip_weakness_weight: 0.7, // a skip counts as this fraction of a wrong answer when ranking

  // ---- Weakness ranking ----------------------------------------------------
  // Expected error rate is shrunk toward a neutral prior and then scaled by how
  // much evidence backs it, so one unlucky first attempt can't outrank a
  // thoroughly-demonstrated weakness.
  weakness_prior_error: 0.5,
  weakness_confidence_attempts: 5,
  recency_floor: 0.4,
  recency_decay_days: 60,

  // ---- Flashcards (SM-2) ---------------------------------------------------
  flashcard_ease_start: 2.5,
  flashcard_ease_min: 1.3,
  flashcard_ease_max: 2.7,
  flashcard_max_interval_days: 180,
  flashcard_mastered_interval_days: 30,
  flashcard_daily_limit: 30,
  // The mastery nudge is absolute in BOTH directions. A multiplicative penalty
  // is smaller than an additive bonus at low scores, which made flip-flopping
  // on a weak concept quietly inflate its mastery.
  flashcard_mastery_gain: 2,
  flashcard_mastery_loss: 3,
} as const;

export type AweConfig = typeof AWE_CONFIG;

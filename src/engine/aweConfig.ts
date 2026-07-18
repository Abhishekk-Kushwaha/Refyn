// AWE tunable thresholds (Doc 5 §11). Keys deliberately match the awe_config
// table seeded in SQL/master_setup.sql — Phase 1 swaps this object for a
// one-time table read, nothing else changes.
export const AWE_CONFIG = {
  // R001 — very weak trigger
  very_weak_accuracy_threshold: 50, // below this % …
  very_weak_min_attempts: 3, // … with at least this many attempts …
  consecutive_incorrect_trigger: 2, // … and this many wrong in a row ("back-to-back")
  high_value_topic_weight: 0.7, // R001 only fires at/above this topic weight

  // R003/R004 — quiz-driven transitions
  weak_quiz_accuracy_threshold: 60,
  improving_quiz_accuracy_threshold: 80,

  // R005 — mastery bar
  mastered_accuracy_threshold: 85,
  mastered_lookback_attempts: 10,

  // R006 — reopening a mastered concept
  revision_fail_reopen_count: 2,

  // R007 — daily blended quiz composition
  daily_quiz_weak_topic_pct: 70,
  daily_quiz_revision_pct: 20,
  daily_quiz_mixed_pct: 10,

  // R009 — pre-CAT revival window
  cat_countdown_revival_days: 30,

  // §5 — mastery score dynamics (rises slow, falls fast)
  mastery_gain_rate: 0.3,
  mastery_loss_multiplier: 0.7,
} as const;

export type AweConfig = typeof AWE_CONFIG;

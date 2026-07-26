-- ============================================================
-- REFYN — AWE CONFIG BACKFILL
-- Run AFTER master_setup.sql. Idempotent.
--
-- Doc 5 §11 promises that every AWE threshold is a row in awe_config, so the
-- Stage E swap is "a lookup instead of a constant". The original seed was
-- missing several keys that src/engine/aweConfig.ts actually reads — including
-- the back-to-back trigger itself, which the doc flagged as "(add this row)"
-- and which was never added.
--
-- That mattered more than a missing row usually does: every comparison against
-- an absent (undefined) threshold evaluates to false, so the swap would have
-- silently switched OFF R001, its topic gate, R006's reopen count and both
-- mastery-score dynamics rather than failing loudly.
--
-- awe_config.value is NUMERIC, so every key below carries the SAME literal value
-- as aweConfig.ts. No scaling, no unit drift — a mismatch between the two is the
-- one thing this table exists to prevent.
-- ============================================================

INSERT INTO awe_config (key, value, description) VALUES
  -- R001 — the back-to-back trigger (was missing entirely)
  ('consecutive_incorrect_trigger', 2, 'R001: wrong answers in a row that mark a concept weak ("back-to-back")'),
  ('high_value_topic_weight', 0.7, 'R001: min topic_weight for the full very_weak path (Arithmetic/Algebra/Geometry)'),
  ('recent_window_min_size', 3, 'R001/R005: minimum rolling-window samples before window accuracy is trusted'),

  -- R003/R004 — sample-size floors, so a 1-question slice cannot move the lifecycle
  ('min_quiz_sample_promote', 3, 'R004/R005: min answers on a concept in a session before it may be promoted'),
  ('min_quiz_sample_demote', 2, 'R003/R006: min answers on a concept in a session before it may be demoted'),

  -- R005 — mastery corroboration
  ('mastered_min_mastery_score', 70, 'R005: mastery_score floor before a concept may be retired'),
  ('mastery_confirm_sessions', 2, 'R005: separate qualifying sessions required before mastery'),
  ('mastered_max_time_ratio', 1.6, 'R005: max avg time/expected — correct-but-slow is not mastery'),

  -- R006 — reopening a mastered concept (reopen count was missing)
  ('revision_fail_reopen_count', 2, 'R006: consecutive failed revisions that reopen a mastered concept'),
  ('revision_fail_window_days', 45, 'R006: fails older than this no longer count as "in a row"'),

  -- R007 — question rotation
  ('question_cooldown_days', 14, 'R007: do not re-serve the same question inside this window'),
  ('seen_history_limit', 800, 'R007: cap on the seen-question ledger'),

  -- Doc 5 §5 — mastery score dynamics (both core rates were missing)
  ('mastery_gain_rate', 0.3, 'Doc 5 §5: how far a correct answer eases mastery toward recent form'),
  ('mastery_loss_multiplier', 0.7, 'Doc 5 §5: multiplier applied to mastery on a wrong answer'),
  ('mastery_difficulty_pivot', 5, 'Difficulty treated as average; harder questions move mastery more'),
  ('mastery_difficulty_span', 0.5, 'Difficulty gain swing (±50% across the difficulty range)'),
  ('mastery_slow_answer_ratio', 1.5, 'time/expected above which a correct answer earns a reduced gain'),
  ('mastery_slow_answer_factor', 0.6, 'Gain multiplier for a correct-but-slow answer'),

  -- Skips are evidence, not silence
  ('skip_help_threshold', 2, 'Consecutive skips on a concept before the engine offers help'),
  ('skip_weakness_weight', 0.7, 'A skip counts as this fraction of a wrong answer when ranking weakness'),

  -- Weakness ranking confidence
  ('weakness_prior_error', 0.5, 'Neutral prior error rate the ranking shrinks toward'),
  ('weakness_confidence_attempts', 5, 'Pseudo-attempts of evidence before a weakness ranks at full strength'),
  ('recency_floor', 0.4, 'Floor for the recency multiplier'),
  ('recency_decay_days', 60, 'Days over which the recency multiplier decays to its floor'),

  -- Flashcards (SM-2)
  ('flashcard_ease_start', 2.5, 'SM-2 starting ease factor'),
  ('flashcard_ease_min', 1.3, 'SM-2 minimum ease factor'),
  ('flashcard_ease_max', 2.7, 'SM-2 maximum ease factor — ease must be able to rise, not only fall'),
  ('flashcard_max_interval_days', 180, 'Cap on a card interval'),
  ('flashcard_mastered_interval_days', 30, 'Interval at which a card counts as mastered'),
  ('flashcard_daily_limit', 30, 'Max cards presented in one due deck'),
  ('flashcard_mastery_gain', 2, 'Mastery-score points added on a recalled card'),
  ('flashcard_mastery_loss', 3, 'Mastery-score points removed on a forgotten card (absolute, not multiplicative)')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ------------------------------------------------------------
-- Status vocabulary drift.
--
-- concept_mastery.status permits 'old_weakness', which is not a member of the
-- engine's ConceptStatus union — the "was once very weak" fact is carried by the
-- everWasVeryWeak flag, not by a status. The client migration folds any such row
-- into 'mastered'; the constraint is narrowed here so nothing can reintroduce it.
--
-- NOTE: concept_mastery and user_flashcards are not currently written by the app
-- — the client engine persists to awe_state (JSONB, see phase1_awe_state.sql).
-- They remain the Stage E target shape; aligning the vocabulary now means the
-- eventual shred has nothing to reconcile.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'concept_mastery'
  ) THEN
    UPDATE concept_mastery SET status = 'mastered' WHERE status = 'old_weakness';

    ALTER TABLE concept_mastery DROP CONSTRAINT IF EXISTS concept_mastery_status_check;
    ALTER TABLE concept_mastery ADD CONSTRAINT concept_mastery_status_check
      CHECK (status IN ('unattempted','learning','weak','very_weak','improving','mastered'));
  END IF;
END $$;

-- ============================================================
-- Done.
-- ============================================================

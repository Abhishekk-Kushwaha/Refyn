-- ============================================================
-- REFYN — PHASE 1: AWE STATE PERSISTENCE
-- Run AFTER master_setup.sql + seed_taxonomy.sql + seed_content.sql.
-- Idempotent.
--
-- The client-side Adaptive Weakness Engine computes a much richer per-concept
-- state than the structured concept_mastery columns capture (rolling last-10
-- window, weaknessScore, lifecycle flags, SM-2 flashcard state, the pending
-- queue, engine meta). Rather than shred that across many columns and risk
-- drift, we persist the engine's own state as JSONB blobs, one row per
-- (user, exam). The engine stays the single source of truth for its shape;
-- this table is pure durable storage so weakness data follows the account
-- across devices.
-- ============================================================

CREATE TABLE IF NOT EXISTS awe_state (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  masteries JSONB NOT NULL DEFAULT '{}'::jsonb,
  queue     JSONB NOT NULL DEFAULT '[]'::jsonb,
  flashcards JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exam_id)
);

ALTER TABLE awe_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own awe_state" ON awe_state;
CREATE POLICY "own awe_state" ON awe_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Done.
-- ============================================================

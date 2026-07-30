-- ============================================================
-- REFYN — DAILY FOCUS COACHING CACHE
--
-- The AWE engine decides WHICH concept a learner should attack today. This
-- table caches the prose that explains WHY, generated once per situation.
--
-- The cache key is deliberately (concept, band) and NOT the user. The
-- sentence "this concept is all over recent CAT papers and you are well
-- below where you need to be" is identical for every learner sitting in
-- that same state, so one generation serves all of them. Keying on user_id
-- instead would mean one model call per user per login — cost scaling with
-- traffic, which is exactly what the question-explanation cache exists to
-- avoid.
--
-- Ceiling: 126 subtopics x 6 bands = 756 rows, ever.
--
-- Because the row is shared, the generated text must never contain a
-- learner's own numbers. The dashboard renders real accuracy and attempt
-- counts from concept_mastery alongside this prose; the model is instructed
-- to stay qualitative. See supabase/functions/daily-focus/index.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Subtopic id when the engine is backed by Supabase, or its local slug in
  -- ephemeral/local mode. Kept as TEXT rather than a FK so the cache works
  -- in every engine mode; a stale key simply misses and regenerates.
  concept_key TEXT NOT NULL,
  concept_name TEXT NOT NULL,

  -- Weakness band from weakness.service.ts.
  band TEXT NOT NULL CHECK (
    band IN ('critical','weak','learning','improving','strong','untested')
  ),
  -- CAT frequency of the concept, bucketed from the engine's frequencyWeight.
  frequency_band TEXT CHECK (frequency_band IN ('low','medium','high','very_high')),

  message TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(concept_key, band)
);

CREATE INDEX IF NOT EXISTS idx_coaching_messages_lookup
  ON coaching_messages(concept_key, band);

ALTER TABLE coaching_messages ENABLE ROW LEVEL SECURITY;

-- Signed-in learners read. Only the daily-focus Edge Function writes, using
-- the service_role key, so the cache cannot be poisoned from a browser.
DROP POLICY IF EXISTS "read coaching messages" ON coaching_messages;
CREATE POLICY "read coaching messages" ON coaching_messages
  FOR SELECT USING (auth.role() = 'authenticated');

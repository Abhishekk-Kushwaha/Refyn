-- ============================================================
-- REFYN — AI EXPLANATION CACHE
-- Run in the Supabase SQL Editor (click "Run without RLS" — this file
-- sets up its own RLS below; the editor's linter offers a duplicate).
--
-- Why this exists: the Gemini free tier is capped per DAY, not per rupee.
-- Without a cache, every learner who taps "Explain with AI" on the same
-- question burns another request, so cost scales with traffic and the quota
-- dies at the worst moment. Explanations are deterministic enough to reuse:
-- generate once per (question, what the learner answered), serve from
-- Postgres forever after.
--
-- Ceiling on total API calls = questions x answer-variants, NOT users:
--   MCQ  -> 5 variants (a/b/c/d/skipped)
--   TITA -> 3 variants (correct/incorrect/skipped)
-- With 613 questions that is ~3,000 lifetime calls. After the bank is warm,
-- serving a million learners costs zero requests.
-- ============================================================

CREATE TABLE IF NOT EXISTS question_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,

  -- What the learner did, bucketed so the cache stays small:
  --   MCQ  -> 'a' | 'b' | 'c' | 'd' | 'skipped'
  --   TITA -> 'correct' | 'incorrect' | 'skipped'
  answer_variant TEXT NOT NULL,

  explanation TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(question_id, answer_variant)
);

CREATE INDEX IF NOT EXISTS idx_question_explanations_lookup
  ON question_explanations(question_id, answer_variant);

ALTER TABLE question_explanations ENABLE ROW LEVEL SECURITY;

-- Signed-in learners read cached explanations. Nobody writes through the
-- client: only the ai-explain Edge Function inserts, using the service_role
-- key, which bypasses RLS. That keeps the cache unpoisonable from a browser.
DROP POLICY IF EXISTS "read cached explanations" ON question_explanations;
CREATE POLICY "read cached explanations" ON question_explanations
  FOR SELECT USING (auth.role() = 'authenticated');

-- ---------- VERIFY ----------
SELECT count(*) AS cached_explanations FROM question_explanations;

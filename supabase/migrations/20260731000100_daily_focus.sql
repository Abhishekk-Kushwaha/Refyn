-- ============================================================
-- REFYN — PER-USER DAILY FOCUS
--
-- One row per learner per day. The row is both the cache and the history:
--   * Cache — the second, fifth and twentieth login on the same day read the
--     row instead of calling a model. Cost scales with DAILY ACTIVE USERS,
--     never with logins.
--   * History — yesterday's row records the stats today's message is
--     compared against, so "you pulled Time-Speed-Distance up from where it
--     was" costs no extra storage and no extra model call.
--
-- This is a deliberate step up in cost from coaching_messages, which keys on
-- (concept, band) and is shared by every learner in that state. That one is
-- free forever but has to stay impersonal. This one can name the learner's
-- real numbers and their progress, at one generation per active user per day.
-- Both exist: coaching_messages still backs the generic path.
--
-- focus_date is the LEARNER'S local date, supplied by the client. A student
-- in IST rolls over at their midnight, not UTC's.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_focus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  focus_date DATE NOT NULL,

  -- The concept the engine chose for this day.
  concept_key TEXT NOT NULL,
  concept_name TEXT NOT NULL,
  band TEXT NOT NULL,

  -- Snapshot of the stats the message was written against. Read back
  -- tomorrow to compute the improvement delta.
  concept_accuracy NUMERIC(5,2),
  concept_attempts INT,
  overall_accuracy NUMERIC(5,2),
  total_attempts INT,

  message TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, focus_date)
);

-- Serves both lookups: today's row, and the most recent previous row.
CREATE INDEX IF NOT EXISTS idx_daily_focus_user_date
  ON daily_focus(user_id, focus_date DESC);

ALTER TABLE daily_focus ENABLE ROW LEVEL SECURITY;

-- Own rows only. Unlike coaching_messages these are personal: they contain
-- the learner's accuracy and progress.
DROP POLICY IF EXISTS "read own daily focus" ON daily_focus;
CREATE POLICY "read own daily focus" ON daily_focus
  FOR SELECT USING (auth.uid() = user_id);

-- Writes go only through the daily-focus Edge Function on the service_role
-- key, which derives user_id from the verified JWT rather than trusting the
-- request body.

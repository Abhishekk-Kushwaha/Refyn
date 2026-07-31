-- Widen the daily briefing from one concept to the whole weakness profile.
--
-- The existing columns record only the focus concept, so the day-over-day
-- comparison could say "Profit & Loss moved" and nothing else. Every other
-- concept changed invisibly: a learner could fix Percentages while Ratios
-- quietly regressed and the briefing would never mention it.
--
-- snapshot stores the compact per-concept state the briefing was written
-- against, so tomorrow can diff the entire profile against it. Kept as JSONB
-- rather than a child table because it is written once, read once, and never
-- queried by field.
--
-- Shape (array, one entry per attempted concept):
--   k  concept key      n  name          t  topic
--   a  accuracy         at attempts      m  mastery score
--   s  status
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS snapshot JSONB;

COMMENT ON COLUMN daily_focus.snapshot IS
  'Per-concept state this briefing was written against; diffed by the next day''s briefing to find what improved or regressed.';

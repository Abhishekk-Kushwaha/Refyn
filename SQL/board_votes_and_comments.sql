-- ============================================================
-- BOARD: voting, accepted answers, and discussion
-- ------------------------------------------------------------
-- Adds what designs 6a / 6b need and master_setup.sql does not have:
--   · a vote rail on doubts (up AND down, so a net score exists)
--   · downvotes on answers — answer_votes was upvote-only
--   · an accepted answer, pinned above the ranked ones
--   · threaded discussion, separate from the ranked answers
--
-- The app degrades without this: the board still reads, scores just show 0.
-- Voting and commenting will error until it is applied.
--
-- Safe to run more than once.
-- ============================================================

-- ---------- 1. Doubts: score + accepted answer ----------

ALTER TABLE doubts ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS accepted_answer_id UUID;

-- Deliberately not a FK to answers(id): answers.doubt_id already references
-- doubts, and a circular FK pair makes deletion order a puzzle. The app only
-- ever writes an id it just read from this doubt's own answers.
COMMENT ON COLUMN doubts.accepted_answer_id IS
  'The answer the asker marked correct. Pinned first in the thread.';

-- ---------- 2. Answers: the sample behind the credibility ----------

-- A 94% off four questions is not credibility. The badge shows both.
ALTER TABLE answers ADD COLUMN IF NOT EXISTS author_solved INT;

-- ---------- 3. Votes ----------

-- answer_votes predates downvotes. Existing rows are upvotes, so the default
-- backfills them correctly.
ALTER TABLE answer_votes
  ADD COLUMN IF NOT EXISTS value SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE answer_votes DROP CONSTRAINT IF EXISTS answer_votes_value_check;
ALTER TABLE answer_votes
  ADD CONSTRAINT answer_votes_value_check CHECK (value IN (-1, 1));

CREATE TABLE IF NOT EXISTS doubt_votes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  doubt_id UUID REFERENCES doubts(id) ON DELETE CASCADE NOT NULL,
  value SMALLINT NOT NULL DEFAULT 1 CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (doubt_id, user_id)
);

-- ---------- 4. Discussion ----------

CREATE TABLE IF NOT EXISTS doubt_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID REFERENCES doubts(id) ON DELETE CASCADE NOT NULL,
  -- Self-referencing for one level of nesting. Cascade so deleting a parent
  -- takes its replies rather than orphaning them.
  parent_id UUID REFERENCES doubt_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT,
  author_credibility NUMERIC(5,2),
  body TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doubt_comments_doubt ON doubt_comments(doubt_id, created_at);

CREATE TABLE IF NOT EXISTS comment_votes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES doubt_comments(id) ON DELETE CASCADE NOT NULL,
  value SMALLINT NOT NULL DEFAULT 1 CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- ---------- 5. Denormalised counters ----------
--
-- Kept in triggers rather than computed on read: the board sorts by score, and
-- an aggregate per row would turn the feed query into a join over every vote
-- ever cast.

CREATE OR REPLACE FUNCTION sync_doubt_score() RETURNS TRIGGER AS $$
BEGIN
  UPDATE doubts SET score = (
    SELECT COALESCE(SUM(value), 0) FROM doubt_votes
    WHERE doubt_id = COALESCE(NEW.doubt_id, OLD.doubt_id)
  ) WHERE id = COALESCE(NEW.doubt_id, OLD.doubt_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_doubt_score ON doubt_votes;
CREATE TRIGGER trg_doubt_score
  AFTER INSERT OR UPDATE OR DELETE ON doubt_votes
  FOR EACH ROW EXECUTE FUNCTION sync_doubt_score();

CREATE OR REPLACE FUNCTION sync_answer_helpful() RETURNS TRIGGER AS $$
BEGIN
  UPDATE answers SET helpful_count = (
    SELECT COALESCE(SUM(value), 0) FROM answer_votes
    WHERE answer_id = COALESCE(NEW.answer_id, OLD.answer_id)
  ) WHERE id = COALESCE(NEW.answer_id, OLD.answer_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replaces the upvote-only counter from seed_content.sql, which counted rows
-- and so read a downvote as +1.
DROP TRIGGER IF EXISTS trg_answer_helpful ON answer_votes;
DROP TRIGGER IF EXISTS answer_votes_count ON answer_votes;
CREATE TRIGGER trg_answer_helpful
  AFTER INSERT OR UPDATE OR DELETE ON answer_votes
  FOR EACH ROW EXECUTE FUNCTION sync_answer_helpful();

CREATE OR REPLACE FUNCTION sync_comment_score() RETURNS TRIGGER AS $$
BEGIN
  UPDATE doubt_comments SET score = (
    SELECT COALESCE(SUM(value), 0) FROM comment_votes
    WHERE comment_id = COALESCE(NEW.comment_id, OLD.comment_id)
  ) WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_score ON comment_votes;
CREATE TRIGGER trg_comment_score
  AFTER INSERT OR UPDATE OR DELETE ON comment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_comment_score();

CREATE OR REPLACE FUNCTION sync_doubt_comment_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE doubts SET comment_count = (
    SELECT COUNT(*) FROM doubt_comments
    WHERE doubt_id = COALESCE(NEW.doubt_id, OLD.doubt_id)
  ) WHERE id = COALESCE(NEW.doubt_id, OLD.doubt_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_doubt_comment_count ON doubt_comments;
CREATE TRIGGER trg_doubt_comment_count
  AFTER INSERT OR DELETE ON doubt_comments
  FOR EACH ROW EXECUTE FUNCTION sync_doubt_comment_count();

-- ---------- 6. RLS ----------
--
-- Same shape as the existing board policies: everyone signed in can read,
-- you may only write rows that are yours.

ALTER TABLE doubt_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read doubt votes" ON doubt_votes;
CREATE POLICY "read doubt votes" ON doubt_votes
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "own doubt votes" ON doubt_votes;
CREATE POLICY "own doubt votes" ON doubt_votes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE doubt_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read comments" ON doubt_comments;
CREATE POLICY "read comments" ON doubt_comments
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "insert own comments" ON doubt_comments;
CREATE POLICY "insert own comments" ON doubt_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update own comments" ON doubt_comments;
CREATE POLICY "update own comments" ON doubt_comments
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read comment votes" ON comment_votes;
CREATE POLICY "read comment votes" ON comment_votes
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "own comment votes" ON comment_votes;
CREATE POLICY "own comment votes" ON comment_votes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- The existing answer_votes policy is FOR ALL on your own rows, which already
-- covers upsert. It has no SELECT policy for other people's votes, so a vote
-- rail could never show anyone else's — add one.
DROP POLICY IF EXISTS "read answer votes" ON answer_votes;
CREATE POLICY "read answer votes" ON answer_votes
  FOR SELECT USING (auth.role() = 'authenticated');

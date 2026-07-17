-- ============================================================
-- REFYN — MASTER DATABASE SETUP SCRIPT
-- Run this entire file in Supabase SQL Editor, top to bottom, once.
-- Source: Doc 2 (Database Design v2), all sections merged.
-- ============================================================

-- ============================================================
-- SECTION 0: EXAM HIERARCHY — exams, sections
-- ============================================================

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INT,
  UNIQUE(exam_id, slug)
);

INSERT INTO exams (name, slug, is_active, display_order) VALUES
  ('CAT', 'cat', TRUE, 1);

INSERT INTO sections (exam_id, name, slug, display_order)
  SELECT id, 'Quantitative Aptitude', 'qa', 1 FROM exams WHERE slug = 'cat';

-- ============================================================
-- SECTION 1: TAXONOMY — topics, subtopics
-- ============================================================

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  topic_weight NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  display_order INT,
  UNIQUE(section_id, slug)
);

CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  concept_code TEXT UNIQUE NOT NULL,
  primary_concept TEXT,
  secondary_concept TEXT,
  frequency_band TEXT CHECK (frequency_band IN ('low','medium','high','very_high')),
  priority_band TEXT CHECK (priority_band IN ('low','medium','high','very_high')),
  frequency_weight NUMERIC(4,2),
  display_order INT,
  UNIQUE(topic_id, slug)
);
CREATE INDEX idx_subtopics_concept_code ON subtopics(concept_code);

-- Seed topics + subtopics: see seed_taxonomy.sql (126 rows generated from
-- Refyn_Database.xlsx). Run that file's contents here, or paste inline —
-- kept as a separate file for readability. Copy its full contents in at
-- this point before continuing.

-- ============================================================
-- SECTION 2: QUESTIONS + REVISIONS
-- ============================================================

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  external_id TEXT NOT NULL,
  year INT,
  slot TEXT,
  source TEXT,
  is_pyq BOOLEAN DEFAULT FALSE,

  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'tita')),
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  correct_answer TEXT NOT NULL,
  solution TEXT,
  alternate_solution TEXT,

  difficulty INT CHECK (difficulty BETWEEN 1 AND 10),
  calculation_level TEXT CHECK (calculation_level IN ('low','medium','high')),
  logic_level TEXT CHECK (logic_level IN ('low','medium','high')),
  expected_time_seconds INT,
  primary_concept TEXT,
  secondary_concept TEXT,
  common_mistakes TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1,
  answer_corrected_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, external_id)
);
CREATE INDEX idx_questions_subtopic ON questions(subtopic_id);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);

CREATE OR REPLACE FUNCTION bump_question_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_version_bump
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION bump_question_version();

CREATE TABLE question_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  edited_by TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_revisions_question ON question_revisions(question_id, edited_at DESC);

-- ============================================================
-- SECTION 3: USERS — profiles, user_exams
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_pro BOOLEAN DEFAULT FALSE,
  pro_expires_at TIMESTAMPTZ,
  theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark','light')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  attempt_year INT,
  daily_target INT DEFAULT 20,
  streak INT DEFAULT 0,
  last_practice_date DATE,
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_id)
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SECTION 4: PRACTICE — sessions, attempts
-- ============================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('weakness','mock','topic')),
  subtopic_id UUID REFERENCES subtopics(id),
  total_questions INT NOT NULL,
  correct_count INT,
  accuracy NUMERIC(5,2),
  avg_time_seconds NUMERIC(6,2),
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attempts_user_subtopic ON attempts(user_id, subtopic_id);
CREATE INDEX idx_attempts_session ON attempts(session_id);

-- ============================================================
-- SECTION 5: AWE ENGINE — concept_mastery, weakness_history, quiz_queue, awe_config
-- ============================================================

CREATE TABLE concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  attempts_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  incorrect_count INT DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  consecutive_correct INT DEFAULT 0,
  consecutive_incorrect INT DEFAULT 0,

  mastery_score NUMERIC(5,2) DEFAULT 0,
  priority_weight NUMERIC(6,3),
  expected_score_gain NUMERIC(5,2),

  status TEXT NOT NULL DEFAULT 'unattempted' CHECK (
    status IN ('unattempted','learning','weak','very_weak','improving','mastered','old_weakness')
  ),

  last_attempt_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subtopic_id)
);
CREATE INDEX idx_mastery_user_exam_status ON concept_mastery(user_id, exam_id, status);
CREATE INDEX idx_mastery_priority ON concept_mastery(user_id, exam_id, priority_weight DESC);

CREATE TABLE weakness_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  first_weak_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  days_to_master INT,
  times_reopened INT DEFAULT 0,
  ever_was_very_weak BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subtopic_id)
);
CREATE INDEX idx_weakness_history_user_exam ON weakness_history(user_id, exam_id);

CREATE TABLE quiz_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  question_id UUID REFERENCES questions(id),
  replica_question_id UUID, -- FK added after replica_questions table exists (below)
  reason TEXT NOT NULL CHECK (
    reason IN ('weak_concept','replica_reinforcement','revision','old_weakness_revival','balanced_practice')
  ),
  priority INT NOT NULL DEFAULT 50,
  scheduled_for DATE,
  is_consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_queue_user_exam_priority ON quiz_queue(user_id, exam_id, priority DESC) WHERE is_consumed = FALSE;

CREATE TABLE awe_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT
);

INSERT INTO awe_config (key, value, description) VALUES
  ('very_weak_accuracy_threshold', 50, 'Below this accuracy % + min attempts -> very_weak'),
  ('very_weak_min_attempts', 3, 'Minimum attempts before very_weak can trigger'),
  ('weak_quiz_accuracy_threshold', 60, 'Concept quiz below this % -> weak (R003)'),
  ('improving_quiz_accuracy_threshold', 80, 'Concept quiz at/above this % -> improving (R004)'),
  ('mastered_accuracy_threshold', 85, 'Last-10 accuracy at/above this % -> mastered (R005)'),
  ('mastered_lookback_attempts', 10, 'How many recent attempts define "last 10" for mastery'),
  ('cat_countdown_revival_days', 30, 'Days before exam to start injecting old_weakness revival (R009)'),
  ('daily_quiz_weak_topic_pct', 70, 'Rule R007: % of daily quiz from weak Arithmetic/Algebra'),
  ('daily_quiz_revision_pct', 20, 'Rule R007: % of daily quiz from revision'),
  ('daily_quiz_mixed_pct', 10, 'Rule R007: % of daily quiz mixed/other');

-- ============================================================
-- SECTION 6: REPLICA QUESTIONS — verification pipeline
-- ============================================================

CREATE TABLE replica_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_question_id UUID REFERENCES questions(id),
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','tita')),
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  correct_answer TEXT NOT NULL,
  solution TEXT,
  difficulty INT CHECK (difficulty BETWEEN 1 AND 10),

  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','auto_checked','auto_failed','human_reviewed','verified','flagged')
  ),
  auto_check_result JSONB,
  auto_check_confidence NUMERIC(4,3),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,

  generated_by TEXT DEFAULT 'gemini',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_replica_status ON replica_questions(status);
CREATE INDEX idx_replica_subtopic ON replica_questions(subtopic_id) WHERE status = 'verified';

ALTER TABLE quiz_queue ADD CONSTRAINT fk_queue_replica
  FOREIGN KEY (replica_question_id) REFERENCES replica_questions(id);

ALTER TABLE quiz_queue ADD CONSTRAINT chk_one_source CHECK (
  (question_id IS NOT NULL AND replica_question_id IS NULL) OR
  (question_id IS NULL AND replica_question_id IS NOT NULL)
);

-- ============================================================
-- SECTION 7: TRICKS / SHORTCUTS + FLASHCARDS
-- ============================================================

CREATE TABLE tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('formula', 'technique')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  explanation TEXT NOT NULL,
  formula TEXT,
  worked_example TEXT,
  difficulty TEXT CHECK (difficulty IN ('basic','intermediate','advanced')),
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trick_subtopics (
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE CASCADE,
  PRIMARY KEY (trick_id, subtopic_id)
);

CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  front TEXT NOT NULL,
  back_formula TEXT,
  back_explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  years_appeared INT[],
  display_order INT,
  trick_id UUID REFERENCES tricks(id)
);
CREATE INDEX idx_flashcards_trick ON flashcards(trick_id);

CREATE TABLE question_tricks (
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, trick_id)
);

CREATE TABLE replica_question_tricks (
  replica_question_id UUID REFERENCES replica_questions(id) ON DELETE CASCADE,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  PRIMARY KEY (replica_question_id, trick_id)
);

CREATE OR REPLACE FUNCTION sync_trick_to_flashcard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty, trick_id)
    VALUES (
      NEW.subtopic_id,
      NEW.summary,
      NEW.formula,
      NEW.explanation,
      CASE NEW.difficulty
        WHEN 'basic' THEN 'easy'
        WHEN 'intermediate' THEN 'medium'
        WHEN 'advanced' THEN 'hard'
      END,
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE flashcards
    SET front = NEW.summary,
        back_formula = NEW.formula,
        back_explanation = NEW.explanation
    WHERE trick_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trick_flashcard_sync
  AFTER INSERT OR UPDATE ON tricks
  FOR EACH ROW EXECUTE FUNCTION sync_trick_to_flashcard();

CREATE TABLE user_flashcards (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  mastery TEXT DEFAULT 'new' CHECK (mastery IN ('new','learning','reviewing','mastered')),
  review_count INT DEFAULT 0,
  ease_factor NUMERIC(3,2) DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  next_review_at DATE,
  last_reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, flashcard_id)
);
CREATE INDEX idx_user_flashcards_due ON user_flashcards(user_id, next_review_at);

-- ============================================================
-- SECTION 8: DOUBT BOARD
-- ============================================================

CREATE TABLE doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id),
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  answer_count INT DEFAULT 0,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_doubts_exam ON doubts(exam_id, created_at DESC);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID REFERENCES doubts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_answers_doubt ON answers(doubt_id);

CREATE TABLE answer_votes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  answer_id UUID REFERENCES answers(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (user_id, answer_id)
);

CREATE OR REPLACE FUNCTION increment_answer_count(doubt_id UUID)
RETURNS VOID AS $$
  UPDATE doubts SET answer_count = answer_count + 1 WHERE id = doubt_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- SECTION 9: PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  plan_id TEXT NOT NULL,
  amount_paise INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created','paid','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON payments(user_id);

-- ============================================================
-- SECTION 10: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile safely" ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_pro = (SELECT is_pro FROM profiles WHERE id = auth.uid())
    AND pro_expires_at IS NOT DISTINCT FROM (SELECT pro_expires_at FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE user_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_exams" ON user_exams FOR ALL USING (auth.uid() = user_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON attempts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE concept_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mastery only" ON concept_mastery FOR ALL USING (auth.uid() = user_id);

ALTER TABLE weakness_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history only" ON weakness_history FOR ALL USING (auth.uid() = user_id);

ALTER TABLE quiz_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own queue only" ON quiz_queue FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE replica_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read verified replicas only" ON replica_questions
  FOR SELECT USING (status = 'verified');

ALTER TABLE user_flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flashcard progress" ON user_flashcards FOR ALL USING (auth.uid() = user_id);

ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tricks" ON tricks FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read exams" ON exams FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sections" ON sections FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read topics" ON topics FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read subtopics" ON subtopics FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read questions" ON questions FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read flashcards" ON flashcards FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE doubts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read doubts" ON doubts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert own doubts" ON doubts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own doubts" ON doubts FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read answers" ON answers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert own answers" ON answers FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE answer_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own votes" ON answer_votes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments read only" ON payments FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE policy on payments — only the service-role Edge Function writes here.

-- No client write policy on: replica_questions (beyond the SELECT above),
-- questions, subtopics, topics, sections, exams, flashcards, tricks —
-- these are admin/service-role-authored content tables by design.

-- ============================================================
-- END OF MASTER SCRIPT
-- Remember to also run seed_taxonomy.sql for the 126 subtopic rows.
-- ============================================================

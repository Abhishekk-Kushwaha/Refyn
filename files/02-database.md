# REFYN — Database Design
### Doc 2 of 4 · Multi-exam schema, built for growth from day one

---

## 1. CORE DESIGN DECISION: EXAM AS A FIRST-CLASS ENTITY

The single most important structural decision: **`exams` is a table, not a hardcoded assumption.**

Everything hangs off exam:
- Topics belong to an exam (CAT's "Quadratic Equations" ≠ GMAT's)
- Questions belong to an exam
- A user can prep for multiple exams (their weakness profile is per-exam)
- Frequency/relevance data is per-exam (a topic hot in CAT may be rare in SSC)

This means adding SSC/GMAT/GRE later = **inserting rows**, not altering schema. No migration pain.

```
exams (CAT, SSC-CGL, GMAT, GRE)
  └── sections (QA, VARC, DILR / Reasoning, Quant...)
        └── topics (Arithmetic, Algebra...)
              └── subtopics (Percentages, Quadratic Eq...)
                    └── questions
```

---

## 2. ENTITY RELATIONSHIP OVERVIEW

```
┌─────────┐     ┌──────────┐     ┌────────┐     ┌───────────┐
│  exams  │────<│ sections │────<│ topics │────<│ subtopics │
└─────────┘     └──────────┘     └────────┘     └───────────┘
                                                       │
                                                       ∧
┌──────────┐    ┌───────────┐                    ┌──────────┐
│ profiles │───<│user_exams │                    │questions │
└──────────┘    └───────────┘                    └──────────┘
     │                                                 │
     │           ┌──────────┐    ┌──────────┐          │
     ├──────────<│ sessions │───<│ attempts │>─────────┤
     │           └──────────┘    └──────────┘          │
     │                                                 │
     ├──────────<│ weakness_scores │                   │
     │                                                 │
     ├──────────<│ doubts │───<│ answers │             │
     │                                                 │
     └──────────<│ flashcard_progress │>──│flashcards │┘

(  ────< means one-to-many  )
```

---

## 3. FULL SCHEMA

### 3.1 Exam structure (the taxonomy backbone)

```sql
-- EXAMS — top of the hierarchy
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- 'CAT', 'SSC CGL', 'GMAT', 'GRE'
  slug TEXT UNIQUE NOT NULL,       -- 'cat', 'ssc-cgl'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,  -- toggle exams on/off
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECTIONS — QA / VARC / DILR per exam
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,              -- 'Quantitative Aptitude'
  slug TEXT NOT NULL,              -- 'qa'
  display_order INT,
  UNIQUE(exam_id, slug)
);

-- TOPICS — Arithmetic, Algebra... (level 1)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INT,
  UNIQUE(section_id, slug)
);

-- SUBTOPICS — Percentages, Quadratic Equations... (level 2)
CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  concepts TEXT[],                 -- ['Factoring', 'Roots', ...]
  -- exam-frequency data lives here, per subtopic:
  total_appearances INT DEFAULT 0, -- times seen across all past papers
  last_appeared_year INT,
  frequency_weight NUMERIC(4,2) DEFAULT 1.0, -- precomputed for weakness algo
  display_order INT,
  UNIQUE(topic_id, slug)
);
```

**Why frequency data lives on `subtopics`:** The weakness score needs `frequency_weight` per subtopic. Storing it here (not per-question) means one place to update when new exam data comes in, and the weakness algorithm reads it directly.

### 3.2 Questions

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  -- identity
  external_id TEXT,                -- 'CAT2025_QA_17' (human-readable)
  year INT,
  slot TEXT,                       -- 'Slot 1'
  source TEXT,                     -- 'CAT 2025', 'TIME Mock 4'
  is_pyq BOOLEAN DEFAULT FALSE,

  -- content
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'tita')),
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT, -- null if TITA
  correct_answer TEXT NOT NULL,    -- 'b' for MCQ, or the numeric answer for TITA
  solution TEXT,
  alternate_solution TEXT,

  -- difficulty & analytics metadata
  difficulty INT CHECK (difficulty BETWEEN 1 AND 10),
  calculation_level TEXT CHECK (calculation_level IN ('low','medium','high')),
  logic_level TEXT CHECK (logic_level IN ('low','medium','high')),
  expected_time_seconds INT,
  primary_concept TEXT,
  secondary_concept TEXT,
  common_mistakes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast question selection
CREATE INDEX idx_questions_subtopic ON questions(subtopic_id);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
```

**Note on AWE tags:** Per the design decision — AWE weakness tags are NOT stored on questions. They are computed from user attempt history (see `attempts` + `weakness_scores`). A question's "diagnostic power" emerges from which users get it wrong, not from a manual tag.

### 3.3 Users & their exams

```sql
-- PROFILES (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_pro BOOLEAN DEFAULT FALSE,        -- SERVER-WRITE ONLY (see RLS)
  pro_expires_at TIMESTAMPTZ,
  theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark','light')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER_EXAMS — which exams a user preps for (many-to-many)
CREATE TABLE user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  attempt_year INT,                    -- target year e.g. 2025
  daily_target INT DEFAULT 20,
  streak INT DEFAULT 0,
  last_practice_date DATE,
  is_primary BOOLEAN DEFAULT TRUE,     -- their main exam
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_id)
);
```

**Why `user_exams` is separate:** A user's streak, daily target, and progress are *per exam*. Someone prepping CAT + GMAT has two separate journeys. This table makes that clean.

### 3.4 Practice & attempts

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('weakness','mock','topic')),
  subtopic_id UUID REFERENCES subtopics(id), -- null for weakness/mock modes
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
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL, -- denormalized for fast weakness queries
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attempts_user_subtopic ON attempts(user_id, subtopic_id);
CREATE INDEX idx_attempts_session ON attempts(session_id);
```

**Denormalization note:** `attempts.subtopic_id` duplicates data reachable via `question_id → questions.subtopic_id`. This is intentional — the weakness algorithm queries attempts by subtopic constantly, and the denormalized column + index makes it fast without a join. Worth the small redundancy.

### 3.5 Weakness scores (computed, per user per exam)

```sql
CREATE TABLE weakness_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  accuracy NUMERIC(5,2) DEFAULT 0,
  attempts_count INT DEFAULT 0,
  weakness_score NUMERIC(5,2),         -- (1-accuracy) × freq × recency
  last_attempted_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subtopic_id)
);
CREATE INDEX idx_weakness_user_exam ON weakness_scores(user_id, exam_id);
```

### 3.6 Flashcards

```sql
CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) NOT NULL,
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  front TEXT NOT NULL,             -- concept name
  back_formula TEXT,
  back_explanation TEXT,
  years_appeared INT[],
  display_order INT
);

-- Per-user flashcard confidence (spaced-repetition-lite)
CREATE TABLE flashcard_progress (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  confidence TEXT CHECK (confidence IN ('not_sure','got_it')),
  last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, flashcard_id)
);
```

### 3.7 Doubt board (social)

```sql
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
```

### 3.8 Payments (audit trail)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  plan_id TEXT NOT NULL,           -- 'monthly', 'yearly'
  amount_paise INT NOT NULL,       -- server-set, never client
  status TEXT NOT NULL CHECK (status IN ('created','paid','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON payments(user_id);
```

**Why a payments table:** Never rely only on the `is_pro` flag. Keep an audit trail of every transaction — needed for refunds, disputes, and debugging. This was a gap in Oryn.

---

## 4. ROW LEVEL SECURITY MODEL

Security posture: **private data is private, content data is shared-read, sensitive flags are server-only.**

| Table | Read | Write |
|---|---|---|
| exams, sections, topics, subtopics | all authenticated | none (admin only) |
| questions | all authenticated | none (admin only) |
| flashcards | all authenticated | none (admin only) |
| profiles | own row only | own row, EXCEPT is_pro/pro_expires_at |
| user_exams | own rows only | own rows |
| sessions | own rows only | own rows |
| attempts | own rows only | own rows |
| weakness_scores | own rows only | server (Edge Function) only |
| flashcard_progress | own rows only | own rows |
| doubts | all authenticated | insert/update own |
| answers | all authenticated | insert own |
| answer_votes | own rows only | own rows |
| payments | own rows only | server (Edge Function) only |

**The critical policy — block client from writing `is_pro`:**

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "update own profile safely" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_pro = (SELECT is_pro FROM profiles WHERE id = auth.uid())
    AND pro_expires_at IS NOT DISTINCT FROM (SELECT pro_expires_at FROM profiles WHERE id = auth.uid())
  );
```

`is_pro` and `pro_expires_at` are only ever changed by the Razorpay-verification Edge Function using the service role key, which bypasses RLS. The client physically cannot flip Pro on. This directly fixes the Oryn vulnerability.

---

## 5. SCALABILITY CONSIDERATIONS

**What happens at 10,000 users / 500,000 attempts:**
- Attempts table grows fastest. Indexed on `(user_id, subtopic_id)` — weakness queries stay fast.
- Weakness scores are precomputed (not calculated live), so dashboard load is O(number of subtopics), tiny.
- Doubt board indexed on `(exam_id, created_at DESC)` — feed stays fast.

**When to worry (not now, but know the path):**
- Attempts table past a few million rows → partition by `created_at` (monthly) or archive old attempts
- Doubt board heavy traffic → add full-text search index on `doubts.title/body`
- These are Postgres-native solutions — no re-architecture needed

**Adding a new exam (SSC CGL) later — the whole process:**
1. Insert one row into `exams`
2. Insert its `sections`, `topics`, `subtopics`
3. Import its `questions` and `flashcards`
4. Done. Zero code changes, zero schema changes, zero migration.

That's the payoff of exam-as-first-class-entity.

---

## 6. SEED DATA STRATEGY

Order of seeding (foreign keys demand this sequence):
```
1. exams        → insert 'CAT'
2. sections     → insert QA (VARC, DILR later)
3. topics       → Arithmetic, Algebra, Geometry, Number Theory, Modern Math, DI
4. subtopics    → full taxonomy with concepts[] + frequency data
5. questions    → the tagged question bank (via import script)
6. flashcards   → formula cards per subtopic
```

Steps 1–4 are a one-time SQL seed script. Step 5 is the Gemini-assisted tagging pipeline output. Step 6 is manual/curated.

---

*Doc 2 of 4 — Database. Next: Theming (dark + light token system), Build Phases.*

# REFYN — Database Design v2
### Doc 2 of 4 (Revised) · Merged taxonomy + AWE Rule Engine, replica verification pipeline

*This revises Doc 2 v1. Sections 1–3.4 (exam hierarchy, questions, profiles, sessions/attempts) are unchanged — see v1 for those. This doc adds and replaces everything from Section 3.5 onward to incorporate the AWE weakness-tracking system.*

---

## 1. WHAT CHANGED FROM v1, AND WHY

v1 had a single flat `weakness_scores` table (accuracy × frequency × recency, recomputed after each session). That was a reasonable v1 formula, but your AWE design is a real upgrade:

| v1 (simple) | v2 (AWE) |
|---|---|
| One weakness_score number per subtopic | Full mastery lifecycle: Very Weak → Learning → Improving → Mastered → Old Weakness |
| Recomputed, previous state discarded | History tracked — how long to master, how many times reopened |
| No automatic action | Rule engine triggers: queue quizzes, generate flashcards, schedule revision |
| Flat frequency weight | Two-level weighting: topic weight (Arithmetic=1.0, Number System=0.4) × subtopic frequency (Very High/High/Medium/Low) |
| No "forgetting" concern | "Old Weakness" state — mastered but revived automatically before CAT |
| No replica question system | Full replica generation + verification pipeline before anything reaches a user |

**The key architectural decision:** the AWE Rule Engine's 12 rules are **not stored as executable logic in the database.** They're implemented as an Edge Function (`awe-engine`) that runs after specific triggers (attempt saved, quiz completed, daily cron). The database stores *state* (mastery scores, history, queue) and *tunable thresholds* (a config table), not the rule logic itself. This keeps rules editable without a schema migration, while keeping actual decision logic in code where it's testable.

---

## 2. UPDATED ENTITY RELATIONSHIP OVERVIEW

```
exams ─< sections ─< topics ─< subtopics ─< questions
                        │            │
                   topic_weights     concepts (= subtopics, using AWE Tag as concept_code)
                                           │
profiles ─< user_exams                    │
    │                                     │
    ├─< sessions ─< attempts >────────────┤
    │                                     │
    ├─< concept_mastery >─────────────────┤   (per user, per subtopic — replaces weakness_scores)
    │        │
    │        └─< weakness_history          (lifecycle tracking)
    │
    ├─< quiz_queue                          (what to serve next, and why)
    │
    ├─< flashcard_progress >─ flashcards    (spaced repetition, SM-2 style)
    │
    ├─< doubts ─< answers
    │
    └─< payments

replica_questions ─(parent_question_id)→ questions
                  ─(subtopic_id)→ subtopics
                  [status: draft → auto_checked → human_reviewed → verified/flagged]
```

---

## 3. TAXONOMY TABLES — REVISED (incorporates your spreadsheet)

Replaces v1's `subtopics` table. Adds `concepts` as columns rather than a separate table, plus real frequency/priority data pulled straight from your sheet — not placeholder values.

```sql
-- TOPICS — Arithmetic, Algebra, Geometry, Number System, Modern Math
-- (unchanged from v1, but now gets a topic-level weight)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  topic_weight NUMERIC(3,2) NOT NULL DEFAULT 0.5,  -- from CAT_Topic_Weights sheet
  display_order INT,
  UNIQUE(section_id, slug)
);

-- SUBTOPICS = the AWE "concept" unit. Your AWE Tag becomes concept_code.
CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                     -- 'Single Worker'
  slug TEXT NOT NULL,
  concept_code TEXT UNIQUE NOT NULL,      -- 'TW_SINGLE' — from your AWE Tag column
  primary_concept TEXT,                   -- 'Work Rate'
  secondary_concept TEXT,                 -- 'Efficiency'
  frequency_band TEXT CHECK (frequency_band IN ('low','medium','high','very_high')),
  priority_band TEXT CHECK (priority_band IN ('low','medium','high','very_high')),
  frequency_weight NUMERIC(4,2),          -- derived from frequency_band, see below
  display_order INT,
  UNIQUE(topic_id, slug)
);
CREATE INDEX idx_subtopics_concept_code ON subtopics(concept_code);
```

**Frequency band → numeric weight mapping** (used by the mastery/priority formula):
```sql
-- Applied at seed time or via a small lookup:
-- 'low' → 0.4, 'medium' → 0.7, 'high' → 1.0, 'very_high' → 1.3
```

**Seed data — Topic weights** (from your `CAT_Topic_Weights` sheet, exact values):
```sql
UPDATE topics SET topic_weight = 1.00 WHERE slug = 'arithmetic';
UPDATE topics SET topic_weight = 0.95 WHERE slug = 'algebra';
UPDATE topics SET topic_weight = 0.70 WHERE slug = 'geometry';
UPDATE topics SET topic_weight = 0.45 WHERE slug = 'modern-mathematics';
UPDATE topics SET topic_weight = 0.40 WHERE slug = 'number-system';
```

This directly encodes your instruction: "more focused on Arithmetic and Algebra, extreme priority" — it's now a real multiplier in the schema, not just a design intention.

---

## 4. CONCEPT MASTERY — replaces v1's `weakness_scores`

This is the heart of the AWE system — per user, per subtopic (= concept), tracked with full state.

```sql
CREATE TABLE concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,   -- denormalized, powers fast per-exam filtering
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  -- raw stats
  attempts_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  incorrect_count INT DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  consecutive_correct INT DEFAULT 0,      -- powers "back-to-back" rules
  consecutive_incorrect INT DEFAULT 0,    -- powers R001's "back-to-back failure" trigger

  -- computed scores
  mastery_score NUMERIC(5,2) DEFAULT 0,   -- 0-100, rises with sustained correct answers
  priority_weight NUMERIC(6,3),           -- topic_weight × frequency_weight × (1-mastery)
  expected_score_gain NUMERIC(5,2),       -- estimated CAT-score impact of fixing this concept

  -- lifecycle status — this is the state machine from your rule engine
  status TEXT NOT NULL DEFAULT 'unattempted' CHECK (
    status IN ('unattempted','learning','weak','very_weak','improving','mastered','old_weakness')
  ),

  last_attempt_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subtopic_id)
);
CREATE INDEX idx_mastery_user_exam_status ON concept_mastery(user_id, exam_id, status);
CREATE INDEX idx_mastery_priority ON concept_mastery(user_id, exam_id, priority_weight DESC);
```

**Why `exam_id` here even though `subtopic_id` already implies it:** the dashboard's most common query is "give me this user's weak concepts *for their currently selected exam*." Without a direct `exam_id` column, that query has to join `concept_mastery → subtopics → topics → sections → exams` every single time the dashboard loads. Denormalizing `exam_id` onto the row directly turns that into a single indexed lookup — same reasoning as `attempts.subtopic_id` in the original schema.

**Status state machine (implements your rule engine's states):**
```
unattempted → learning       (first attempt, regardless of result)
learning → weak              (accuracy < 60% after a quiz, Rule R003)
weak → very_weak             (incorrect AND attempts≥3 AND accuracy<50% AND high CAT importance, Rule R001)
very_weak/weak → improving   (quiz accuracy ≥ 80%, Rule R004)
improving → mastered         (last 10 attempts ≥ 85% accuracy, Rule R005)
mastered → old_weakness      (was ever 'very_weak' or 'weak' at some point — flagged permanently for pre-CAT revival)
mastered → weak              (revision review failed twice, Rule R006 — reopens)
```

**On "old_weakness" — this is your key insight, now enforced by data, not memory:**
A concept that reaches `mastered` checks its own history (see `weakness_history` below) — if it was ever `very_weak`, it doesn't just become `mastered`, it becomes `mastered` with a permanent flag that the pre-CAT scheduler (Rule R009) reads to decide whether to inject a light revival dose in the final 30 days. This is stored in `weakness_history`, not lost when status flips to `mastered`.

---

## 5. WEAKNESS HISTORY — lifecycle tracking (from your `User_Weakness_History` sheet)

```sql
CREATE TABLE weakness_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,   -- denormalized, same reasoning as concept_mastery
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  first_weak_at TIMESTAMPTZ,           -- when it first became weak/very_weak
  resolved_at TIMESTAMPTZ,             -- when it first reached 'mastered'
  days_to_master INT,                  -- computed on resolution
  times_reopened INT DEFAULT 0,        -- incremented each time it drops from mastered back to weak
  ever_was_very_weak BOOLEAN DEFAULT FALSE,  -- the permanent flag for pre-CAT revival

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subtopic_id)
);
CREATE INDEX idx_weakness_history_user_exam ON weakness_history(user_id, exam_id);
```

This table is append-light, update-heavy — one row per user per subtopic, updated as status transitions happen. The Edge Function updates this alongside `concept_mastery` on every status change.

---

## 6. QUIZ QUEUE — what to serve next, and why (from your `Quiz_Queue` sheet)

```sql
CREATE TABLE quiz_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) NOT NULL,   -- denormalized, same reasoning as concept_mastery
  question_id UUID REFERENCES questions(id),           -- null if referencing a replica instead
  replica_question_id UUID REFERENCES replica_questions(id), -- null if referencing a real question
  reason TEXT NOT NULL CHECK (
    reason IN ('weak_concept','replica_reinforcement','revision','old_weakness_revival','balanced_practice')
  ),
  priority INT NOT NULL DEFAULT 50,     -- 0-100, higher = more urgent
  scheduled_for DATE,                   -- null = available now
  is_consumed BOOLEAN DEFAULT FALSE,    -- becomes true once served in a session
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_queue_user_exam_priority ON quiz_queue(user_id, exam_id, priority DESC) WHERE is_consumed = FALSE;

-- exactly one of question_id / replica_question_id must be set
ALTER TABLE quiz_queue ADD CONSTRAINT chk_one_source CHECK (
  (question_id IS NOT NULL AND replica_question_id IS NULL) OR
  (question_id IS NULL AND replica_question_id IS NOT NULL)
);
```

**How the queue gets populated:** the Edge Function (triggered by rules R001, R002, R003, R007) inserts rows here when a concept needs reinforcement. When the user starts a "Fix my weaknesses" practice session, the app reads the top N rows from `quiz_queue` ordered by priority, rather than a live weakness computation — this is faster and matches exactly what the rule engine decided.

---

## 7. REPLICA QUESTIONS — with mandatory verification pipeline

This is the piece we specifically slowed down on. AI-generated, but **never served unverified.**

```sql
CREATE TABLE replica_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_question_id UUID REFERENCES questions(id),   -- the real question this was modeled on
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,

  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','tita')),
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  correct_answer TEXT NOT NULL,
  solution TEXT,
  difficulty INT CHECK (difficulty BETWEEN 1 AND 10),

  -- THE VERIFICATION PIPELINE — a replica cannot skip states
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','auto_checked','auto_failed','human_reviewed','verified','flagged')
  ),
  auto_check_result JSONB,             -- stores the independent solve-pass output for audit
  auto_check_confidence NUMERIC(4,3),  -- 0-1, how confident the verifier is the answer is right
  reviewed_by UUID REFERENCES profiles(id), -- null until a human (you) reviews it
  reviewed_at TIMESTAMPTZ,

  generated_by TEXT DEFAULT 'gemini',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_replica_status ON replica_questions(status);
CREATE INDEX idx_replica_subtopic ON replica_questions(subtopic_id) WHERE status = 'verified';
```

**The pipeline, as an Edge Function sequence (`generate-replica`):**
```
1. Rule engine decides a replica is needed for concept X (Rule R001/R002)
   → calls generate-replica Edge Function with subtopic_id + parent_question_id

2. Edge Function calls Gemini: generate question + solution + answer
   → INSERT with status = 'draft'

3. Immediately, an independent verification pass runs:
   → Either a SECOND Gemini call (different prompt: "solve this, don't trust the given answer")
     comparing its independent answer against the generated one
   → Or a SymPy-based symbolic check for anything algebraically verifiable
   → Writes result to auto_check_result + auto_check_confidence
   → status → 'auto_checked' (if answers match, confidence high) or 'auto_failed' (mismatch → discard, never shown to anyone)

4. 'auto_checked' items sit in a review queue. Early on (low volume), Abhishek reviews
   each one manually → 'human_reviewed' → 'verified'.
   Once trust is established at scale, high-confidence auto_checked items can graduate
   to 'verified' automatically — but that threshold is a deliberate later decision,
   not a v1 default.

5. ONLY status = 'verified' replica_questions are eligible to be inserted into quiz_queue.
   This is enforced by a CHECK at the application/service layer, not just a convention —
   the questions.service.ts function that pulls queue content filters strictly on
   status = 'verified'.
```

**Why this matters concretely:** a `draft` or `auto_failed` question sitting in the table causes zero harm — it's just data. The only dangerous moment is *serving* it to a user, and that path is gated on `status = 'verified'` at the query level. This is the same pattern as `is_pro` being server-gated — the dangerous field is structurally hard to misuse.

---

## 8. FLASHCARDS — spaced repetition (replaces v1's simple not_sure/got_it)

Your `User_Flashcards` sheet specifies `ease_factor` and `next_review` — that's the SM-2 algorithm (same one Anki uses). Worth implementing properly since you specified it.

```sql
CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,
  front TEXT NOT NULL,
  back_formula TEXT,
  back_explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  years_appeared INT[],
  display_order INT
);

CREATE TABLE user_flashcards (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  mastery TEXT DEFAULT 'new' CHECK (mastery IN ('new','learning','reviewing','mastered')),
  review_count INT DEFAULT 0,
  ease_factor NUMERIC(3,2) DEFAULT 2.5,     -- SM-2 standard starting ease
  interval_days INT DEFAULT 1,
  next_review_at DATE,
  last_reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, flashcard_id)
);
CREATE INDEX idx_user_flashcards_due ON user_flashcards(user_id, next_review_at);
```

**SM-2 logic (Rules R010/R011), in the Edge Function, not the DB:**
```
On "Got it" (correct review):
  consecutive_correct += 1
  if consecutive_correct >= 3: interval jumps 3→7→14→30→60 days (R011)
  else: interval = interval × ease_factor

On "Not sure" (incorrect review):
  consecutive_correct = 0
  ease_factor = max(1.3, ease_factor - 0.2)   -- lower ease, review sooner (R010)
  interval_days = 1  -- review again tomorrow
```

---

## 9. AWE CONFIG — tunable thresholds (replaces hardcoded rule engine values)

Rather than hardcoding "accuracy < 50%" and "attempts ≥ 3" inside Edge Function code, store them here so thresholds can be tuned without redeploying:

```sql
CREATE TABLE awe_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT
);

INSERT INTO awe_config (key, value, description) VALUES
  ('very_weak_accuracy_threshold', 50, 'Below this accuracy % + min attempts → very_weak'),
  ('very_weak_min_attempts', 3, 'Minimum attempts before very_weak can trigger'),
  ('weak_quiz_accuracy_threshold', 60, 'Concept quiz below this % → weak (R003)'),
  ('improving_quiz_accuracy_threshold', 80, 'Concept quiz at/above this % → improving (R004)'),
  ('mastered_accuracy_threshold', 85, 'Last-10 accuracy at/above this % → mastered (R005)'),
  ('mastered_lookback_attempts', 10, 'How many recent attempts define "last 10" for mastery'),
  ('cat_countdown_revival_days', 30, 'Days before exam to start injecting old_weakness revival (R009)'),
  ('daily_quiz_weak_topic_pct', 70, 'Rule R007: % of daily quiz from weak Arithmetic/Algebra'),
  ('daily_quiz_revision_pct', 20, 'Rule R007: % of daily quiz from revision'),
  ('daily_quiz_mixed_pct', 10, 'Rule R007: % of daily quiz mixed/other');
```

The Edge Function reads these at runtime instead of hardcoding magic numbers. You can tune the whole system's behavior from a SQL UPDATE, no deploy needed.

---

## 10. THE AWE RULE ENGINE — implementation, not a table

Your 12 rules become a single Edge Function, `awe-engine`, triggered three ways:

| Trigger | When | Rules handled |
|---|---|---|
| `on_attempt_saved` | After every single question attempt | R001, R002 |
| `on_session_completed` | After a practice session/quiz ends | R003, R004, R005, R006, R012 |
| `daily_cron` (scheduled) | Once daily, per active user | R007, R008, R009, R010, R011 |

**Pseudocode shape (for Antigravity to implement faithfully — this is not final code, it's the logic contract):**

```typescript
// awe-engine/index.ts — triggered on_attempt_saved
async function onAttemptSaved(userId: string, questionId: string, isCorrect: boolean) {
  const subtopicId = await getSubtopicForQuestion(questionId)
  const mastery = await getOrCreateConceptMastery(userId, subtopicId)
  const config = await getAweConfig()

  // update raw counters
  mastery.attempts_count++
  isCorrect ? mastery.correct_count++ : mastery.incorrect_count++
  mastery.consecutive_correct = isCorrect ? mastery.consecutive_correct + 1 : 0
  mastery.consecutive_incorrect = isCorrect ? 0 : mastery.consecutive_incorrect + 1
  mastery.accuracy = mastery.correct_count / mastery.attempts_count * 100

  // R001 — very weak trigger
  const topic = await getTopicForSubtopic(subtopicId)
  const isHighImportance = topic.topic_weight >= 0.7  // Arithmetic/Algebra/Geometry
  if (!isCorrect
      && mastery.attempts_count >= config.very_weak_min_attempts
      && mastery.accuracy < config.very_weak_accuracy_threshold
      && isHighImportance) {
    mastery.status = 'very_weak'
    await queueReplicaGeneration(subtopicId, count: 5)
    await queueFlashcards(subtopicId, count: 3)
    await scheduleReview(userId, subtopicId, daysFromNow: 3)
    await recordWeaknessHistoryStart(userId, subtopicId)
  }

  // R002 — first-attempt-wrong, gentler response
  if (!isCorrect && mastery.attempts_count === 1) {
    mastery.status = 'learning'
    await queueFlashcards(subtopicId, count: 1)
    await queueSimilarQuestions(subtopicId, count: 2)
  }

  await saveConceptMastery(mastery)
}
```

The remaining rules (R003–R012) follow the same shape — read config, check condition, mutate state, trigger queue/schedule actions. I'll write the full Edge Function once we're actually in the build phase; right now this establishes the contract between database state and rule behavior so the schema above is validated against real usage, not just theory.

---

## 11. UPDATED SEED ORDER

```
1. exams, sections           → CAT, QA
2. topics                    → 5 topics + topic_weight from CAT_Topic_Weights
3. subtopics                 → all 116 rows from your taxonomy sheet, concept_code = AWE Tag,
                                 frequency_band + priority_band from sheet, frequency_weight derived
4. awe_config                → the 10 tunable thresholds
5. questions                 → tagged PYQ bank (via Gemini tagging pipeline, human-reviewed)
6. flashcards                → curated per subtopic
   (concept_mastery, weakness_history, quiz_queue, replica_questions, user_flashcards
    are NOT seeded — they populate naturally as real users generate real attempts)
```

---

## 12. RLS ADDITIONS (on top of v1's model)

```sql
ALTER TABLE concept_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mastery only" ON concept_mastery FOR ALL USING (auth.uid() = user_id);

ALTER TABLE weakness_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history only" ON weakness_history FOR ALL USING (auth.uid() = user_id);

ALTER TABLE quiz_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own queue only" ON quiz_queue FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE on quiz_queue is server-only (Edge Function, service role) — client never writes it directly

ALTER TABLE replica_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read verified replicas only" ON replica_questions
  FOR SELECT USING (status = 'verified');
-- No client INSERT/UPDATE policy at all — only the Edge Function (service role) can write here.
-- This is what makes the verification gate unbypassable from the client.

ALTER TABLE user_flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flashcard progress" ON user_flashcards FOR ALL USING (auth.uid() = user_id);
```

**The one rule that matters most in this whole doc:** `replica_questions` has no client write policy whatsoever. The only way a row's status becomes `verified` is through the service-role Edge Function. A client cannot insert a fake "verified" replica question even if it tried. Same defensive pattern as `is_pro`.

---

## 13. GRANULARITY DECISION — LOCKED

**Decision: subtopic-level mastery tracking for v1** (subtopic = concept granularity, AWE Tag = `concept_code`). The separate Concept_Master C0xx numbering is retired as redundant.

**Why, not just what:**

1. **Data volume.** Splitting mastery to individual concepts (e.g., "Nature of Roots" vs. "Discriminant" within Quadratic Equations separately) means each unit needs its own stream of attempts before its accuracy number is meaningful. Early on, with a modest question bank and a handful of users, concept-level splits already-thin attempt data too thin to distinguish "genuinely weak" from "just an unlucky sample."

2. **Tagging burden.** Concept-level requires deciding, per question, whether it tests the primary concept, secondary, or both — a real judgment call that slows down tagging. Subtopic-level tagging is unambiguous and fast.

3. **Matches the original spec.** The system was described as: "if the user is not able to solve *that topic's* questions back to back, that topic is weak." That's a subtopic-level signal, not sub-concept-level — building finer than what was asked for solves a problem that doesn't exist yet.

4. **Non-destructive upgrade path.** `subtopic_id` remains the foreign key on `concept_mastery` now. If concept-level tracking is ever needed later, a `concepts` table can be inserted between `subtopics` and `concept_mastery` as an additive migration — existing data and code aren't disrupted.

This decision is final for v1. Revisit only once there's enough real attempt volume per subtopic that finer-grained tracking would actually be statistically meaningful.

---

## 14. TRICKS / SHORTCUTS SYSTEM

A reusable content library for shortcuts, formulas, and technique tips — written once, referenced everywhere (solutions, flashcards, and future surfaces) instead of duplicated. Scope is broad: both formula-based shortcuts (e.g., successive percentage change) and general problem-solving approaches (e.g., "always check the answer options before brute-forcing DI tables").

```sql
CREATE TABLE tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id UUID REFERENCES subtopics(id) NOT NULL,   -- primary home
  type TEXT NOT NULL CHECK (type IN ('formula', 'technique')),
  title TEXT NOT NULL,              -- the heading, e.g. "Successive % Change Shortcut"
  summary TEXT NOT NULL,            -- one-line version — becomes the flashcard front
  explanation TEXT NOT NULL,        -- the full trick/method — becomes the flashcard back
  formula TEXT,                     -- only used when type = 'formula'
  worked_example TEXT,              -- optional short example applying it
  difficulty TEXT CHECK (difficulty IN ('basic','intermediate','advanced')),
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A trick can apply to more than one subtopic (a percentage shortcut
-- also helping Profit & Loss, for example) — many-to-many:
CREATE TABLE trick_subtopics (
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE CASCADE,
  PRIMARY KEY (trick_id, subtopic_id)
);

-- Which tricks a given question's solution actually uses —
-- powers a "Related tricks" block shown under any solution:
CREATE TABLE question_tricks (
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, trick_id)
);

-- Replica questions can reference tricks too, same pattern:
CREATE TABLE replica_question_tricks (
  replica_question_id UUID REFERENCES replica_questions(id) ON DELETE CASCADE,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE,
  PRIMARY KEY (replica_question_id, trick_id)
);

-- Link from flashcards back to the trick that generated them:
ALTER TABLE flashcards ADD COLUMN trick_id UUID REFERENCES tricks(id);
CREATE INDEX idx_flashcards_trick ON flashcards(trick_id);
```

### 14.1 Auto-flashcard generation — a database trigger, not app logic

Every trick auto-generates a flashcard the moment it's inserted. This is implemented as a **trigger**, not application code, so it fires reliably no matter how the trick was added — manual entry in an admin tool, a bulk import script, or a future Gemini-assisted authoring flow. App code can't accidentally skip it.

```sql
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
    -- Keep the linked flashcard in sync if the trick is edited later —
    -- this is what prevents the flashcard and the trick from drifting apart.
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
```

**Why a trigger and not "auto-generate, then let me review before it's live":** the earlier question asked whether generation should be immediate or review-gated. Since tricks are authored by you (not AI-generated content reaching a user unverified — that gate is `replica_questions`, a different table with a different risk profile), there's no correctness risk here comparable to replica questions. A trick you wrote is trusted the moment you write it, the same way a `questions` row you tag is trusted. If you want a review step later (e.g., once you're bulk-importing tricks via Gemini assistance), add a `status` column here the same way `replica_questions` has one — but that's not needed for manually-authored v1 content.

### 14.2 Where tricks surface in the app

- **Flashcards feature** — tricks appear automatically via the sync trigger, no separate content pass needed
- **Question solution view** — after a solution, a "Related tricks" section reads from `question_tricks`, showing the relevant shortcut/technique inline rather than re-explaining it in every solution
- **Future** — since tricks are independent, first-class content, they support things not yet built: a searchable "shortcuts library" screen, tagging tricks by exam-relevance the same way subtopics are, or surfacing "most-used tricks" analytics later

### 14.3 RLS for tricks

```sql
ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tricks" ON tricks FOR SELECT USING (auth.role() = 'authenticated');
-- No client write policy — tricks are admin-authored content, same posture as questions/subtopics.
```

---

## 15. MULTI-EXAM CONTENT ISOLATION

How the database guarantees an SSC aspirant only ever sees SSC-relevant content, and a CAT aspirant only sees CAT content.

### 15.1 The isolation chain

Every content table terminates in `exam_id`, either directly or through its parent:

```
exams
  └── sections (exam_id)
        └── topics (section_id → exam)
              └── subtopics (topic_id → exam)
                    └── questions (subtopic_id → exam, PLUS direct exam_id)
                    └── tricks (subtopic_id → exam)
                    └── flashcards (subtopic_id → exam)
```

**Design choice: full separation, not shared taxonomy.** "Percentages" under CAT and "Percentages" under SSC are two distinct `subtopics` rows — different question pools, different topic weights, different mastery tracking. This was a deliberate call, not an oversight: SSC and CAT questions differ meaningfully in style even on nominally the same topic (SSC rewards speed on simpler questions; CAT rewards depth on fewer, harder ones), so treating them as genuinely separate content makes sense. It also means a user prepping both exams starts each one fresh — a reasonable tradeoff for v1, and one that can be revisited later without breaking anything (see 15.4).

### 15.2 How exam selection flows through the app

1. During onboarding, the user picks their target exam → stored as a row in `user_exams` (`user_id`, `exam_id`, `is_primary = true`)
2. The app holds the user's active exam in `examStore` (Zustand) — read once at login, switchable later if they prep multiple exams
3. **Every service function that fetches content takes `examId` as a required parameter** — there is no "fetch questions" function that doesn't scope by exam. This is enforced at the service layer (see Architecture doc), not left to each component to remember.

### 15.3 The actual query pattern

```typescript
// services/questions.service.ts
export const getQuestionsForPractice = async (userId: string, examId: string, subtopicIds: string[]) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)              // hard filter — never optional
    .in('subtopic_id', subtopicIds)
  if (error) throw new AppError('NETWORK_ERROR', "Couldn't load questions.", error)
  return data
}

// services/weakness.service.ts
export const getWeakConcepts = async (userId: string, examId: string) => {
  const { data, error } = await supabase
    .from('concept_mastery')
    .select('*, subtopics(name, slug)')
    .eq('user_id', userId)
    .eq('exam_id', examId)              // the denormalized column from Section 4 — one indexed lookup
    .order('priority_weight', { ascending: false })
  if (error) throw new AppError('NETWORK_ERROR', "Couldn't load weakness data.", error)
  return data
}
```

Because `exam_id` is required (not optional/nullable) on every relevant query function's signature, it's structurally difficult to accidentally leak CAT content into an SSC user's session — the query simply can't run without specifying which exam.

### 15.4 Adding a new exam (SSC, Banking, GMAT) — the actual steps

```
1. INSERT INTO exams (name, slug) VALUES ('SSC CGL', 'ssc-cgl');
2. INSERT sections for it (likely just one: Quantitative Aptitude, or split further if SSC's
   own sections differ from CAT's)
3. INSERT topics under those sections, each with its own topic_weight
   (SSC's Arithmetic/Algebra/Geometry balance may differ meaningfully from CAT's —
   this is exactly why topic_weight lives per-topic-row, not as a global constant)
4. INSERT subtopics — reuse the naming/structure pattern from the CAT taxonomy sheet,
   but as new rows, tagged to SSC's topics
5. Import SSC-specific PYQs into questions, tagged to the new subtopics
6. Done. Zero schema changes. The existing app code already scopes everything by exam_id,
   so SSC content simply becomes selectable the moment a user's user_exams row points to it.
```

### 15.5 If cross-exam concept sharing is ever wanted later

Not needed now, but worth knowing the path exists: a `canonical_concepts` table could sit above `subtopics`, with each exam-specific subtopic optionally linking to one canonical concept (`subtopics.canonical_concept_id`, nullable). A user's mastery of "successive percentage change" could then be surfaced across exams without merging the actual question pools or taxonomy trees. This is purely additive — nothing in the current design has to be torn out to add it later.

---

## 16. QUESTION UPDATES — editing existing content + ongoing bulk imports

Two separate but related needs: (a) fixing/editing questions already in the database, and (b) continuing to add new questions over time without creating duplicates.

### 16.1 Schema additions for safe editing

```sql
ALTER TABLE questions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE questions ADD COLUMN version INT DEFAULT 1;
ALTER TABLE questions ADD COLUMN answer_corrected_at TIMESTAMPTZ;  -- null unless correct_answer was ever changed post-import

-- Auto-bump updated_at + version on any edit — generic, applies to every UPDATE
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
```

**Audit trail — a full log of what changed, when, and why:**

```sql
CREATE TABLE question_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  field_changed TEXT NOT NULL,      -- 'correct_answer', 'solution', 'question_text', etc.
  old_value TEXT,
  new_value TEXT,
  reason TEXT,                      -- required for correct_answer changes — why was it wrong?
  edited_by TEXT NOT NULL,          -- your identifier, e.g. 'abhishek'
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_revisions_question ON question_revisions(question_id, edited_at DESC);
```

This table is populated by whatever edit tool you use (see 16.3) at the moment of the edit — not by an automatic trigger — because a meaningful `reason` needs a human writing it, not a generic diff.

### 16.2 The correct_answer policy — deliberate, not automatic

When `correct_answer` specifically changes on a question that already has real `attempts` against it:

**Default v1 behavior: do NOT retroactively recompute past attempts.** A user's `attempts.is_correct` from before the fix stays as it was recorded at the time. Their `concept_mastery` isn't silently rewritten.

**Why not auto-recompute:** silently changing someone's mastery score after the fact is confusing and, worse, could flip a `mastered` status back to `weak` (or vice versa) without the user understanding why — a bad experience for something that should be a quiet backend fix.

**What you get instead:** `answer_corrected_at` gets set, and `question_revisions` logs the change with your reason. If a question turns out to have been wrong for a *lot* of attempts (rare, but possible with a bad PYQ source), you have the option to manually trigger a recompute for just that question's affected attempts — a deliberate action you take when it's actually warranted, not a default that runs on every typo fix.

```sql
-- Optional manual recompute, run only when you decide it's warranted:
-- (conceptually — implemented as an Edge Function you call explicitly, not automatic)
-- 1. Find all attempts for this question_id
-- 2. Recompute is_correct against the new correct_answer
-- 3. Re-run the AWE mastery recalculation for each affected user's concept_mastery row
```

### 16.3 How you'll actually make edits (no admin UI needed for v1)

Given this is solo-operated, two tools cover everything without building a custom admin screen:

1. **Supabase Table Editor** (built into the Supabase dashboard) — for occasional one-off fixes: typo in a solution, wrong option text. Direct, no extra build.
2. **An upsert import script** (Python or Node, using the service-role key) — for both bulk corrections and ongoing new-question additions. This is the same script from the Gemini tagging pipeline, extended to upsert rather than insert-only.

Neither requires a new in-app admin screen for v1. If question volume grows large enough that spreadsheet-and-script workflow becomes painful, a proper admin screen is a reasonable v2+ addition — not needed now.

### 16.4 Ongoing bulk imports without duplicates

The risk with "keep adding questions over time" is accidentally importing the same question twice. Fixed with a uniqueness constraint on the human-readable ID you're already using:

```sql
ALTER TABLE questions ALTER COLUMN external_id SET NOT NULL;
ALTER TABLE questions ADD CONSTRAINT uq_questions_exam_external UNIQUE (exam_id, external_id);
```

The import script then **upserts** instead of blindly inserting:

```typescript
// scripts/import-questions.ts
const { error } = await supabase
  .from('questions')
  .upsert(questionRows, {
    onConflict: 'exam_id,external_id',   // matches the unique constraint above
    ignoreDuplicates: false               // false = update existing row if external_id matches
  })
```

Run this script anytime you have a new batch of tagged questions — CAT2025_QA_17 only ever exists once per exam. If it's re-imported with corrected data, it updates the existing row (and the version-bump trigger + your manual revision log capture that change) rather than creating a duplicate.

---

*Doc 2 of 4 (Revised) — Database with AWE Rule Engine and Tricks system merged in. Next: update Doc 4 (Build Phases) to include the AWE engine, replica pipeline, and tricks system as part of the relevant phases.*

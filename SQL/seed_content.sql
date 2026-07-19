-- ============================================================
-- REFYN — CONTENT SEED + BOARD PATCH
-- Run AFTER master_setup.sql + seed_taxonomy.sql, in the Supabase SQL Editor.
-- Idempotent: safe to run more than once.
--
-- Contains:
--   1. Doubt-board patch (denormalized author names, credibility snapshot,
--      vote visibility, helpful_count trigger)
--   2. AWE config addition (back-to-back trigger threshold)
--   3. Question bank: 10 launch questions
--   4. 6 hand-authored replicas (status 'verified')
--   5. 10 flashcards
-- ============================================================

-- ---------- 1. DOUBT BOARD PATCH ----------

-- Display names are denormalized onto posts at write time so the profiles
-- table can stay fully locked down (RLS: users read only their own row).
ALTER TABLE doubts  ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Credibility badge = answerer's accuracy in the doubt's concept, snapshotted
-- at answer time (concept_mastery is own-rows-only under RLS, so it can't be
-- joined live for other users — the writer computes their own and stores it).
ALTER TABLE answers ADD COLUMN IF NOT EXISTS author_credibility NUMERIC(5,2);

-- Votes must be readable by all signed-in users so vote state renders.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'answer_votes' AND policyname = 'read votes'
  ) THEN
    CREATE POLICY "read votes" ON answer_votes
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- helpful_count is maintained server-side (no UPDATE policy on answers).
CREATE OR REPLACE FUNCTION sync_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE answers SET helpful_count = helpful_count + 1 WHERE id = NEW.answer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE answers SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS answer_votes_count ON answer_votes;
CREATE TRIGGER answer_votes_count
  AFTER INSERT OR DELETE ON answer_votes
  FOR EACH ROW EXECUTE FUNCTION sync_helpful_count();

-- ---------- 2. AWE CONFIG ADDITION ----------

INSERT INTO awe_config (key, value, description)
VALUES ('consecutive_incorrect_trigger', 2, 'Wrong-in-a-row needed for the R001 back-to-back trigger')
ON CONFLICT (key) DO NOTHING;

-- ---------- 3. QUESTION BANK (10 launch questions) ----------

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_01',
  'A shopkeeper marks an item 40% above its cost price and then offers a 25% discount on the marked price. What is his profit or loss percentage?',
  'mcq', '5% profit', '10% profit', '5% loss', '10% loss', 'a',
  'Let CP = 100. Marked price = 140. After 25% discount: 140 × 0.75 = 105. Profit = 105 − 100 = 5, so profit = 5%.',
  4, 90, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'PL_CP_SP'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_02',
  'Two trains, each 150 m long, run on parallel tracks in opposite directions, each at 45 km/h. How long do they take to cross each other?',
  'mcq', '8 seconds', '10 seconds', '12 seconds', '15 seconds', 'c',
  'Relative speed = 45 + 45 = 90 km/h = 25 m/s. Total distance = 150 + 150 = 300 m. Time = 300 / 25 = 12 seconds.',
  5, 100, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'TSD_RELATIVE'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_03',
  'A can complete a job in 12 days and B can complete it in 18 days. They work together for 4 days, after which A leaves. In how many more days will B finish the remaining work? (Enter a number)',
  'tita', NULL, NULL, NULL, NULL, '8',
  'A''s rate = 1/12, B''s rate = 1/18. Combined rate for 4 days = 4×(1/12+1/18) = 4×(5/36) = 20/36 = 5/9. Remaining = 4/9. B alone takes (4/9)/(1/18) = 8 days.',
  6, 120, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'TW_COMBINED'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_04',
  'If the roots of x² − 7x + k = 0 are in the ratio 2:5, what is the value of k?',
  'mcq', '8', '10', '12', '14', 'b',
  'Let roots be 2a and 5a. Sum = 7a = 7 → a = 1. Roots = 2, 5. Product = k = 10.',
  6, 110, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'ALG_QUAD_ROOT'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_05',
  'The ratio of the ages of A and B, 5 years ago, was 3:4. Their present age ratio is 4:5. What is the present age of A?',
  'mcq', '20 years', '25 years', '30 years', '35 years', 'a',
  'Let ages 5 years ago be 3k, 4k. Present ages: 3k+5, 4k+5. Given (3k+5)/(4k+5) = 4/5: 15k+25 = 16k+20 → k = 5. Present age of A = 3(5)+5 = 20.',
  5, 100, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'RATIO_BASIC'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_06',
  'In a right triangle, the two legs are 9 cm and 12 cm. What is the length of the altitude drawn to the hypotenuse?',
  'mcq', '6.4 cm', '7.2 cm', '8.0 cm', '9.6 cm', 'b',
  'Hypotenuse = √(9²+12²) = 15. Area = (1/2)×9×12 = 54. Altitude = 2×Area/hypotenuse = 108/15 = 7.2 cm.',
  5, 100, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'GEO_TRI_BASIC'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_07',
  'A sum of ₹8,000 amounts to ₹9,261 in 3 years at compound interest, compounded annually. What is the rate of interest?',
  'mcq', '4%', '5%', '6%', '7%', 'b',
  '9261/8000 = (1+r)³. 9261 = 21³, 8000 = 20³. So (1+r) = 21/20 → r = 5%.',
  4, 90, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'CI_ANNUAL'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_08',
  'What is the remainder when 7^100 is divided by 100? (Enter a number)',
  'tita', NULL, NULL, NULL, NULL, '1',
  'The last two digits of 7^n cycle every 4: 07, 49, 43, 01. Since 100 mod 4 = 0, 7^100 ends in 01 → remainder mod 100 is 1.',
  7, 140, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'NS_REMAINDER'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_09',
  'The average weight of 8 people increases by 2.5 kg when a new person replaces one of them weighing 65 kg. What is the weight of the new person?',
  'mcq', '80 kg', '82 kg', '85 kg', '90 kg', 'c',
  'Total weight increase = 8 × 2.5 = 20 kg. New person''s weight = 65 + 20 = 85 kg.',
  3, 70, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'MIX_ALLIGATION'
ON CONFLICT (exam_id, external_id) DO NOTHING;

INSERT INTO questions (exam_id, subtopic_id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, source, is_pyq)
SELECT (SELECT id FROM exams WHERE slug='cat'), s.id, 'CAT_MOCK_QA_10',
  'In how many ways can the letters of the word "MOBILE" be arranged so that the vowels always come together?',
  'mcq', '144', '288', '360', '720', 'a',
  'Vowels O, I, E treated as one unit: (M, B, L, [OIE]) = 4 units → 4! = 24 arrangements. Vowels internally arrange in 3! = 6 ways. Total = 24 × 6 = 144.',
  5, 100, 'refyn_launch', FALSE
FROM subtopics s WHERE s.concept_code = 'MOD_LINEAR'
ON CONFLICT (exam_id, external_id) DO NOTHING;

-- ---------- 4. VERIFIED REPLICAS (hand-authored, Gemini slots in later) ----------

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'A trader marks an item 50% above its cost price and then offers a 20% discount on the marked price. What is his profit percentage?',
  'mcq', '10%', '15%', '20%', '25%', 'c',
  'Let CP = 100. Marked = 150. After 20% discount: 150 × 0.8 = 120. Profit = 20%.',
  4, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_01' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'Two trains, each 200 m long, run on parallel tracks in opposite directions, each at 36 km/h. How long do they take to cross each other?',
  'mcq', '15 seconds', '18 seconds', '20 seconds', '24 seconds', 'c',
  'Relative speed = 36 + 36 = 72 km/h = 20 m/s. Distance = 200 + 200 = 400 m. Time = 400 / 20 = 20 s.',
  5, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_02' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'A can complete a job in 10 days and B in 15 days. They work together for 4 days, after which A leaves. In how many more days will B finish the remaining work? (Enter a number)',
  'tita', NULL, NULL, NULL, NULL, '5',
  'Combined rate = 1/10 + 1/15 = 1/6. In 4 days: 4/6 = 2/3 done. Remaining 1/3. B alone: (1/3)/(1/15) = 5 days.',
  6, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_03' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'If the roots of x² − 9x + k = 0 are in the ratio 1:2, what is the value of k?',
  'mcq', '12', '14', '18', '20', 'c',
  'Roots a, 2a. Sum = 3a = 9 → a = 3. Roots 3, 6. Product k = 18.',
  6, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_04' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'The ratio of the ages of A and B, 4 years ago, was 5:7. Their present age ratio is 3:4. What is the present age of A?',
  'mcq', '20 years', '24 years', '28 years', '32 years', 'b',
  'Ages 4 years ago: 5k, 7k. Present: 5k+4, 7k+4. (5k+4)/(7k+4) = 3/4 → 20k+16 = 21k+12 → k = 4. A = 5(4)+4 = 24.',
  5, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_05' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

INSERT INTO replica_questions (parent_question_id, subtopic_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, status, generated_by)
SELECT q.id, q.subtopic_id,
  'In a right triangle, the two legs are 6 cm and 8 cm. What is the length of the altitude drawn to the hypotenuse?',
  'mcq', '4.2 cm', '4.8 cm', '5.0 cm', '5.6 cm', 'b',
  'Hypotenuse = √(36+64) = 10. Area = (1/2)(6)(8) = 24. Altitude = 2×24/10 = 4.8 cm.',
  5, 'verified', 'hand_authored'
FROM questions q
WHERE q.external_id = 'CAT_MOCK_QA_06' AND q.exam_id = (SELECT id FROM exams WHERE slug='cat')
  AND NOT EXISTS (SELECT 1 FROM replica_questions r WHERE r.parent_question_id = q.id);

-- ---------- 5. FLASHCARDS ----------

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Markup m% then discount d% — net effect?', 'Net % = m − d − (m×d)/100',
  'Mark 40%, discount 25%: 40 − 25 − 10 = 5% profit. One line, no CP assumption needed.', 'medium'
FROM subtopics s WHERE s.concept_code = 'PL_CP_SP'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Markup m% then discount d% — net effect?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Two trains crossing in opposite directions — time?', 't = (L₁ + L₂) / (v₁ + v₂)',
  'Add both lengths, add both speeds (opposite directions). Convert km/h → m/s by × 5/18 first.', 'medium'
FROM subtopics s WHERE s.concept_code = 'TSD_RELATIVE'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Two trains crossing in opposite directions — time?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'A and B together, then A leaves — how to split the work?', 'Work done = t × (1/a + 1/b); remaining ÷ B''s rate',
  'Compute the joint fraction finished, subtract from 1, divide the remainder by the stayer''s rate.', 'medium'
FROM subtopics s WHERE s.concept_code = 'TW_COMBINED'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'A and B together, then A leaves — how to split the work?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Roots in ratio p:q for x² − Sx + P = 0 — fastest path?', 'Roots pk, qk → (p+q)k = S; P = pq·k²',
  'Let the roots be pk and qk. Sum pins k instantly; product gives the constant term.', 'medium'
FROM subtopics s WHERE s.concept_code = 'ALG_QUAD_ROOT'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Roots in ratio p:q for x² − Sx + P = 0 — fastest path?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Age ratio then vs now — setup?', '(ak + t)/(bk + t) = new ratio',
  'Old ages ak, bk; add the elapsed years to BOTH before equating to the new ratio. Cross-multiply, solve k.', 'easy'
FROM subtopics s WHERE s.concept_code = 'RATIO_BASIC'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Age ratio then vs now — setup?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Altitude to the hypotenuse of a right triangle?', 'h = (leg₁ × leg₂) / hypotenuse',
  'Both expressions for area: ½·leg₁·leg₂ = ½·hyp·h. Equate and solve — no trig needed.', 'easy'
FROM subtopics s WHERE s.concept_code = 'GEO_TRI_BASIC'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Altitude to the hypotenuse of a right triangle?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Spotting the CI rate from amount ratio?', 'A/P = (1 + r)ⁿ — look for perfect nth powers',
  '9261/8000 = (21/20)³ → r = 1/20 = 5%. CAT amounts are usually built from clean powers.', 'medium'
FROM subtopics s WHERE s.concept_code = 'CI_ANNUAL'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Spotting the CI rate from amount ratio?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Last-two-digits / mod 100 of aᵇ?', 'Find the cycle of aⁿ mod 100',
  '7ⁿ mod 100 cycles 07, 49, 43, 01 every 4. Reduce the exponent mod 4 and read off.', 'hard'
FROM subtopics s WHERE s.concept_code = 'NS_REMAINDER'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Last-two-digits / mod 100 of aᵇ?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'One person replaced, average shifts by x?', 'New weight = old weight + n·x',
  'The whole shift times group size lands on the swapped person. 8 people, +2.5 → new = old + 20.', 'easy'
FROM subtopics s WHERE s.concept_code = 'MIX_ALLIGATION'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'One person replaced, average shifts by x?');

INSERT INTO flashcards (subtopic_id, front, back_formula, back_explanation, difficulty)
SELECT s.id, 'Arrangements with vowels together?', '(n−v+1)! × v!',
  'Glue the vowels into one block, arrange the blocks, then arrange inside the block. MOBILE: 4!×3! = 144.', 'medium'
FROM subtopics s WHERE s.concept_code = 'MOD_LINEAR'
  AND NOT EXISTS (SELECT 1 FROM flashcards f WHERE f.subtopic_id = s.id AND f.front = 'Arrangements with vowels together?');

-- ============================================================
-- Sanity checks (run these after; expected counts in comments)
-- ============================================================
-- SELECT count(*) FROM questions;          -- 10
-- SELECT count(*) FROM replica_questions;  -- 6, all status='verified'
-- SELECT count(*) FROM flashcards;         -- 10
-- ============================================================

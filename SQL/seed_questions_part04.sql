-- ============================================================
-- REFYN — QUESTION BANK SEED (part 4 of 4)
-- Source: Refyn_Question_Intake_8_fixed.xlsx, sheet "Question_Intake"
-- Rows 601-613 of 613
--
-- Run AFTER master_setup.sql + seed_taxonomy.sql, in the Supabase SQL Editor.
-- Idempotent: re-running skips rows already present (exam_id, external_id).
--
-- Transforms applied to the sheet data:
--   * question_type / correct_answer (MCQ) lowercased to match existing seeds
--   * calculation_level 'hard'->'high', 'easy'->'low' (CHECK allows low/medium/high)
--   * TITA rows get NULL options
--   * 39 solutions that were left mid-draft in the sheet were re-derived and
--     rewritten; answer keys were verified unchanged.
--   * subtopic resolved by concept_code; a row whose code is missing from
--     subtopics would be skipped -- the verification query at the end of
--     part 4 reports the final count.
-- ============================================================

INSERT INTO questions (
  exam_id, subtopic_id,
  external_id, year, slot, source, is_pyq,
  question_text, question_type,
  option_a, option_b, option_c, option_d,
  correct_answer, solution, alternate_solution,
  difficulty, calculation_level, logic_level,
  expected_time_seconds, common_mistakes
)
SELECT
  (SELECT id FROM exams WHERE slug = 'cat'), s.id,
  v.external_id, v.year, v.slot, v.source, v.is_pyq,
  v.question_text, v.question_type,
  v.option_a, v.option_b, v.option_c, v.option_d,
  v.correct_answer, v.solution, v.alternate_solution,
  v.difficulty, v.calculation_level, v.logic_level,
  v.expected_time_seconds, v.common_mistakes
FROM (VALUES
  ('CAT2018_QA_S2_22', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'GEO_SECTOR', 'From rectangle ABCD (area 768 sq cm), a semicircle with diameter AB and area 72π sq cm is removed. Find the perimeter of the remaining shape.', 'mcq', '80+16π', '86+8π', '88+12π', '82+24π', 'c', '72π=(1/2)π(AB/2)² gives AB=24 cm, so BC=768/24=32 cm; remaining perimeter = AD+DC+BC+semicircular arc = 32+24+32+12π=88+12π.', NULL, 7, 'high', 'high', 150, 'Including the removed diameter AB as part of the perimeter instead of replacing it with the semicircular arc.'),
  ('CAT2018_QA_S2_23', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'NS_DIVISIBILITY', 'A={6^(2n)-35n-1} and B={35(n-1)} for n=1,2,3,.... Which statement about A and B is true?', 'mcq', 'Every member of A is in B and at least one member of B is not in A', 'Neither every member of A is in B nor every member of B is in A', 'Every member of B is in A', 'At least one member of A is not in B', 'a', '6^(2n) = 36^n, and 36 ≡ 1 (mod 35), so 36^n ≡ 1 (mod 35) and 36^n − 1 is always a multiple of 35. Subtracting 35n keeps it a multiple of 35, so every member of A is a multiple of 35 — that is, A ⊆ B. But A is sparse: n=1 gives 36 − 35 − 1 = 0, n=2 gives 1296 − 70 − 1 = 1225 = 35 × 35, n=3 gives 46550 = 35 × 1330. B contains 35 itself, which A never produces, so at least one member of B is not in A.', NULL, 7, 'high', 'high', 150, 'Assuming both sets simply enumerate all multiples of 35, missing that A only hits a sparse subset.'),
  ('CAT2018_QA_S2_24', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'ALG_INDICES', 'Find the smallest integer n for which 4^n > 17^19.', 'mcq', '37', '35', '33', '39', 'd', '4^n=16^(n/2)>17^19 requires n/2>19 (since 16<17 the exponent must be larger), so n>38, giving the smallest integer 39.', NULL, 6, 'medium', 'medium', 120, 'Comparing 4^n and 17^19 directly without rewriting 4 as 16^(1/2) to compare exponents on a common-ish base.'),
  ('CAT2018_QA_S2_25', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'MIX_REPLACEMENT', 'A jar has 175 ml water and 700 ml alcohol. 10% of the mixture is removed and replaced with water, twice. Find the resulting percentage of water.', 'mcq', '30.3', '35.2', '25.4', '20.5', 'b', 'Alcohol remaining after two 10% replacements = 700×0.9²=567 ml, so water=875-567=308 ml, giving 308/875≈35.2%.', NULL, 6, 'medium', 'medium', 120, 'Applying the replacement formula to the water quantity instead of the alcohol (non-replaced) quantity.'),
  ('CAT2018_QA_S2_26', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'ALG_INEQ_QUAD', 'Integers a,b satisfy 2x²-ax+2>0 and x²-bx+8≥0 for all real x. Find the largest possible value of 2a-6b.', 'tita', NULL, NULL, NULL, NULL, '36', 'The first condition needs discriminant a²-16<0 so -3≤a≤3 (integers); the second needs b²-32≤0 so -5≤b≤5; maximising 2a-6b uses a=3, b=-5, giving 36.', NULL, 7, 'high', 'high', 150, 'Using non-strict inequality thresholds inconsistently between the two discriminant conditions.'),
  ('CAT2018_QA_S2_27', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'ALG_LOG', 'Evaluate 1/log_2(100) - 1/log_4(100) + 1/log_5(100) - 1/log_10(100) + 1/log_20(100) - 1/log_25(100) + 1/log_50(100).', 'mcq', '1/2', '10', '0', '-4', 'a', 'Using 1/log_x(100)=log_10(x)/2, the expression becomes (1/2)[log2-log4+log5-log10+log20-log25+log50], which telescopes to (1/2)log10(10)=1/2.', NULL, 7, 'high', 'high', 150, 'Forgetting the factor of 1/2 that comes from converting 1/log_x(100) using log_10(100)=2.'),
  ('CAT2018_QA_S2_28', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'ALG_LOG', 'If p³=q⁴=r⁵=s⁶, find the value of log_s(pqr).', 'mcq', '47/10', '24/5', '16/5', '1', 'a', 'Writing p=s^(2/3), q=s^(3/2), r=s^(6/5) from the common value s^6=k, log_s(pqr) sums the exponents to 47/10.', NULL, 7, 'high', 'high', 150, 'Adding the exponents from the original equation directly instead of first re-expressing each variable as a power of s.'),
  ('CAT2018_QA_S2_29', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'MIX_ALLIGATION', 'Drum 1 has paints A:B=18:7. Mixing drums 1 and 2 in ratio 3:4 gives A:B=13:7 in the final mix. Find A:B in drum 2.', 'mcq', '251:163', '239:161', '220:149', '229:141', 'b', 'Setting drum 2''s ratio as x:1 and equating the weighted concentration of A across the 3:4 mix to 13/20 gives x=239/161.', NULL, 7, 'high', 'high', 150, 'Equating concentrations of B instead of A, or mixing up the weighting ratio 3:4.'),
  ('CAT2018_QA_S2_30', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'TW_COMBINED', 'Ramesh and Ganesh together finish work in 16 days. After 7 days together, Ramesh''s efficiency drops 30%, and the job then takes 17 days total. How many days would Ganesh alone need for the remaining work?', 'mcq', '14.5', '11', '13.5', '12', 'c', 'From 16(R+G)=7(R+G)+10(0.7R+G), we get R=0.5G; the work remaining after day 7 is 9(R+G)=13.5G, so Ganesh alone needs 13.5G/G=13.5 days.', NULL, 7, 'high', 'high', 150, 'Applying the reduced efficiency to the whole remaining period instead of only to Ramesh''s contribution.'),
  ('CAT2018_QA_S2_31', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'SI_BASIC', 'Gopal borrows Rs X from Ankit at 8%, adds Rs Y, and lends X+Y to Ishan at 10%. His retained interest equals Ankit''s interest. If he''d lent X+2Y instead, his retained interest would rise by Rs 150. Find X+Y.', 'tita', NULL, NULL, NULL, NULL, '4000', 'From 0.08X=0.02X+0.1Y we get X=(5/3)Y; the second scenario gives an interest increase of 0.1Y=150, so Y=1500 and X=2500, making X+Y=4000.', NULL, 8, 'high', 'high', 180, 'Not setting up the ''retained interest'' correctly as the difference between what Ishan pays and what''s owed to Ankit.'),
  ('CAT2018_QA_S2_32', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'MIX_ALLIGATION', 'Solutions A,B,C mixed 1:2:3 give 20% strength; mixed 3:2:1 give 30% strength. D is B and C mixed 2:7. Find the ratio of D''s strength to A''s strength.', 'mcq', '3:10', '1:3', '1:4', '2:5', 'b', 'From a+2b+3c=120 and 3a+2b+c=180, we get b=45-2c and a=30+c; D''s strength=(2b+7c)/9=(90+3c)/9, which simplifies to a ratio of 1:3 with a=30+c.', NULL, 7, 'high', 'high', 150, 'Not reducing the two linear equations far enough to express everything in a single variable before forming the final ratio.'),
  ('CAT2018_QA_S2_33', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'TSD_RELATIVE', 'A and B are 350 km apart on an east-west road. Cars from A and B moving toward each other meet in 1 hr; moving in the same (east) direction they meet in 7 hr. Find the difference in their speeds.', 'tita', NULL, NULL, NULL, NULL, '50', 'Meeting while moving in the same direction requires their speed difference to cover 350 km in 7 hr, so the difference is 50 km/h.', NULL, 6, 'low', 'low', 90, 'Using the sum of speeds (from the towards-each-other case) instead of the difference for the same-direction case.'),
  ('CAT2018_QA_S2_34', 2018, 'Slot 2', 'CAT 2018 Slot 2 Official', TRUE, 'ALG_SERIES_SPECIAL', 'Real numbers t1,t2,... satisfy t1+t2+...+tn=2n²+9n+13 for n≥2. If tk=103, find k.', 'tita', NULL, NULL, NULL, NULL, '24', 'tk = [2k²+9k+13] - [2(k-1)²+9(k-1)+13] = 4k+7; setting 4k+7=103 gives k=24.', NULL, 6, 'medium', 'medium', 120, 'Applying the sum formula directly to n=k as if it gave tk instead of subtracting consecutive partial sums.')
) AS v (
  external_id, year, slot, source, is_pyq,
  concept_code,
  question_text, question_type,
  option_a, option_b, option_c, option_d,
  correct_answer, solution, alternate_solution,
  difficulty, calculation_level, logic_level,
  expected_time_seconds, common_mistakes
)
JOIN subtopics s ON s.concept_code = v.concept_code
ON CONFLICT (exam_id, external_id) DO NOTHING;

-- ---------- VERIFY ----------
-- Expected after all 4 parts: 613 PYQ rows, plus any earlier seeds.
SELECT count(*) AS total_questions FROM questions;
SELECT is_pyq, count(*) FROM questions GROUP BY is_pyq;
SELECT t.name AS topic, count(*) AS questions
FROM questions q
JOIN subtopics sub ON sub.id = q.subtopic_id
JOIN topics t ON t.id = sub.topic_id
GROUP BY t.name ORDER BY questions DESC;

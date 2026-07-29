-- ============================================================
-- REFYN — TRICKS SEED: Modern Mathematics
-- Run AFTER master_setup.sql + seed_taxonomy.sql. Idempotent.
--
-- Flashcards are NOT inserted here. master_setup.sql's `trick_flashcard_sync`
-- trigger (AFTER INSERT OR UPDATE ON tricks) creates and maintains the card for
-- every trick, mapping difficulty basic/intermediate/advanced → easy/medium/hard.
-- Write the shortcut once; its card exists automatically (Doc 5 §8).
--
-- Each insert is guarded by NOT EXISTS on (subtopic_id, summary). The trigger
-- inserts unconditionally, so re-running an unguarded tricks insert would
-- duplicate cards.
--
-- Subtopics are matched by `name`, so a row whose name differs in this taxonomy
-- simply inserts nothing rather than erroring.
-- ============================================================

CREATE OR REPLACE FUNCTION refyn_add_trick(
  p_subtopic_name TEXT,
  p_type TEXT,
  p_title TEXT,
  p_summary TEXT,
  p_formula TEXT,
  p_explanation TEXT,
  p_difficulty TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO tricks (subtopic_id, type, title, summary, explanation, formula, difficulty)
  SELECT s.id, p_type, p_title, p_summary, p_explanation, p_formula, p_difficulty
  FROM subtopics s
  WHERE s.name = p_subtopic_name
    AND NOT EXISTS (
      SELECT 1 FROM tricks t WHERE t.subtopic_id = s.id AND t.summary = p_summary
    );
END;
$$ LANGUAGE plpgsql;

-- ---------------- Selection (combinations) ----------------
SELECT refyn_add_trick('Selection', 'formula',
  'Compulsory and barred items',
  'Choosing r from n when k items MUST be included?',
  'C(n − k, r − k)',
  'Lock the k compulsory items in first, then choose the remaining r − k from the n − k still available. Mirror case: if k items are barred, it is simply C(n − k, r).',
  'intermediate');

SELECT refyn_add_trick('Selection', 'formula',
  'At least one',
  'Selecting at least one from n distinct items?',
  '2ⁿ − 1',
  'Every item is independently in or out, giving 2ⁿ subsets; discard the empty one. For "at least one from each of two groups" of sizes a and b, multiply: (2ᵃ − 1)(2ᵇ − 1).',
  'basic');

-- ---------------- Counting Principle ----------------
SELECT refyn_add_trick('Counting Principle', 'technique',
  'Repetition allowed or not',
  'Filling r slots from n options — repetition allowed vs not?',
  'With repetition: nʳ · Without: n!/(n − r)!',
  'Repetition allowed means every one of the r slots still has all n choices, so nʳ. Without repetition the pool shrinks n, n−1, n−2 … which is exactly nPr.',
  'basic');

SELECT refyn_add_trick('Counting Principle', 'technique',
  'Fill the constrained slot first',
  'Digit problems where the leading digit cannot be zero?',
  '(n − 1) × (n − 1) × (n − 2) × …',
  'Always fill the most-restricted position first. The leading slot excludes 0, so it has n − 1 choices; the remaining slots then draw from whatever is left. Filling left-to-right blindly double-counts.',
  'intermediate');

-- ---------------- Set Operations ----------------
SELECT refyn_add_trick('Set Operations', 'formula',
  'Union of two sets',
  'Finding |A ∪ B| from the parts?',
  '|A ∪ B| = |A| + |B| − |A ∩ B|',
  'Adding both totals counts the overlap twice, so subtract it once. Inside a universe of n, "neither" is n − |A ∪ B|, which is what most worded questions are really asking for.',
  'basic');

SELECT refyn_add_trick('Set Operations', 'formula',
  'Difference and symmetric difference',
  'Finding |A − B| and |A Δ B|?',
  '|A − B| = |A| − |A ∩ B| · |A Δ B| = |A| + |B| − 2|A ∩ B|',
  'A − B strips the shared part out of A. Symmetric difference wants "in exactly one of them", so remove the overlap entirely — subtract it twice, not once.',
  'intermediate');

-- ---------------- Linear Arrangement ----------------
SELECT refyn_add_trick('Linear Arrangement', 'formula',
  'Vowels together',
  'Arrangements with all vowels together?',
  '(n − v + 1)! × v!',
  'Glue the v vowels into a single block: you are now arranging n − v + 1 units, and the vowels permute v! ways inside the block. Divide by the factorials of any repeated letters.',
  'intermediate');

SELECT refyn_add_trick('Linear Arrangement', 'formula',
  'No two vowels adjacent',
  'Arrangements with no two vowels adjacent?',
  'c! × (c + 1)! / (c + 1 − v)!',
  'Arrange the c consonants first (c! ways). That creates c + 1 gaps including the ends. Drop the v vowels into distinct gaps — that is (c+1)P v. Never place two vowels in one gap.',
  'advanced');

-- ---------------- Distribution ----------------
SELECT refyn_add_trick('Distribution', 'formula',
  'Identical items, gaps method',
  'Identical items into distinct groups, none empty?',
  'C(n − 1, r − 1)',
  'Line up the n identical items and insert r − 1 dividers into the n − 1 internal gaps. If empty groups ARE allowed the count becomes C(n + r − 1, r − 1) — the classic stars-and-bars pair.',
  'intermediate');

SELECT refyn_add_trick('Distribution', 'technique',
  'Identical vs distinct items',
  'Distinct items into distinct boxes, any number each?',
  'rⁿ',
  'Each of the n distinct items independently chooses one of r boxes, so rⁿ. Compare identical items, which is the gaps method instead — deciding which case you are in is most of the marks.',
  'basic');

-- ---------------- Venn Diagrams ----------------
SELECT refyn_add_trick('Venn Diagrams', 'formula',
  'Exactly-two and exactly-one regions',
  'Exactly two / exactly one from a three-set Venn?',
  'exactly two = S₂ − 3d · exactly one = S₁ − 2S₂ + 3d',
  'With S₁ the singles, S₂ the sum of the three pairwise intersections and d the triple: each pairwise region still contains d, so exactly-two is S₂ − 3d. Substituting that gives exactly-one as S₁ − 2S₂ + 3d.',
  'advanced');

SELECT refyn_add_trick('Venn Diagrams', 'technique',
  'Minimum and maximum overlap',
  'Largest and smallest possible |A ∩ B|?',
  'max = min(|A|, |B|) · min = max(0, |A| + |B| − n)',
  'The overlap is biggest when the smaller set sits entirely inside the larger. It is smallest when the sets spread as far apart as a universe of n permits — and it can never go below zero, so clamp.',
  'intermediate');

-- ---------------- Inclusion-Exclusion ----------------
SELECT refyn_add_trick('Inclusion-Exclusion', 'formula',
  'Three-set union',
  'Finding |A ∪ B ∪ C|?',
  '|A|+|B|+|C| − (|A∩B|+|B∩C|+|A∩C|) + |A∩B∩C|',
  'Add the singles, subtract every pairwise overlap (each was counted twice), then add the triple back (it was subtracted three times after being added three times). Alternating signs continue for four sets.',
  'intermediate');

SELECT refyn_add_trick('Inclusion-Exclusion', 'technique',
  'None-of questions',
  '"Neither / none of them" counting problems?',
  'none = n − |A ∪ B ∪ C|',
  'Compute the union with inclusion–exclusion, then subtract from the total. Almost every "how many read neither newspaper" question is this in disguise — find the union, not the pieces.',
  'basic');

DROP FUNCTION IF EXISTS refyn_add_trick(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- ============================================================
-- Verify: should report 7 subtopics, 14 tricks, 14 cards.
--
--   select s.name, count(distinct t.id) tricks, count(distinct f.id) cards
--   from subtopics s
--   join tricks t on t.subtopic_id = s.id
--   left join flashcards f on f.trick_id = t.id
--   group by s.name order by s.name;
-- ============================================================

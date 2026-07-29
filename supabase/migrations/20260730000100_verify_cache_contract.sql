-- Verification migration for the ai-explain cache contract.
-- Every check below raises on failure, so a successful `supabase db push`
-- is itself the proof. Leaves no rows behind.

DO $$
DECLARE
  qid UUID;
  n INT;
BEGIN
  -- 1. Table exists with the columns the Edge Function writes.
  PERFORM 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='question_explanations';
  IF NOT FOUND THEN RAISE EXCEPTION 'question_explanations table missing'; END IF;

  FOR n IN
    SELECT 1 FROM (VALUES ('question_id'),('answer_variant'),('explanation'),('model')) AS c(col)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='question_explanations' AND column_name=c.col)
  LOOP
    RAISE EXCEPTION 'question_explanations is missing a column the function writes';
  END LOOP;

  -- 2. RLS is on (the function bypasses it via service_role; clients must not).
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname='question_explanations') THEN
    RAISE EXCEPTION 'RLS is not enabled on question_explanations';
  END IF;

  -- 3. Round-trip the exact insert the function performs, against a real question.
  --    On a fresh database the bank is seeded from SQL/ files rather than
  --    migrations, so skip rather than block `db push`.
  SELECT id INTO qid FROM questions LIMIT 1;
  IF qid IS NULL THEN
    RAISE NOTICE 'no questions yet - skipping cache round-trip checks';
    RETURN;
  END IF;

  INSERT INTO question_explanations (question_id, answer_variant, explanation, model)
  VALUES (qid, '__selftest__', 'probe', 'probe-model');

  SELECT count(*) INTO n FROM question_explanations
    WHERE question_id=qid AND answer_variant='__selftest__';
  IF n <> 1 THEN RAISE EXCEPTION 'cache insert did not land'; END IF;

  -- 4. The unique constraint must absorb the race between two learners
  --    asking about the same question at the same moment.
  BEGIN
    INSERT INTO question_explanations (question_id, answer_variant, explanation, model)
    VALUES (qid, '__selftest__', 'duplicate', 'probe-model');
    RAISE EXCEPTION 'duplicate insert was allowed - unique constraint is missing';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- expected
  END;

  -- 5. FK must reject a question that does not exist.
  BEGIN
    INSERT INTO question_explanations (question_id, answer_variant, explanation)
    VALUES ('00000000-0000-0000-0000-000000000001', '__selftest_fk__', 'x');
    RAISE EXCEPTION 'FK did not reject an unknown question_id';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL; -- expected
  END;

  DELETE FROM question_explanations WHERE answer_variant LIKE '__selftest%';

  RAISE NOTICE 'CACHE CONTRACT OK. sample_question_id=%', qid;
END $$;

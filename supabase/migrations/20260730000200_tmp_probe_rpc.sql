-- TEMPORARY: exposes one question id so the deployed ai-explain cache path can
-- be verified end-to-end. Dropped immediately afterwards by the next migration.
CREATE OR REPLACE FUNCTION public.__probe_question_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM questions WHERE external_id = 'CAT2023_QA_S1_17' LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.__probe_question_id() TO anon, authenticated;

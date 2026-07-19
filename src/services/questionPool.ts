import { ALL_QUESTIONS, MockQuestion } from '@/lib/mockQuestions';
import { getSupabase } from './supabase/client';
import { getExamUuid } from './taxonomy.service';

// The servable question pool for the current session.
//   · demo/explore → the mock bank (originals + hand-authored replicas)
//   · signed-in    → the real Supabase bank (questions + verified replicas),
//     fetched once and cached
//
// buildDailyQuiz is synchronous, so the pool must be materialized before the
// practice flow runs. configureQuestionPool() is awaited during auth-ready;
// getPool() is the sync accessor everything else uses.

let pool: MockQuestion[] = ALL_QUESTIONS;
let configuredFor: string | null = null; // exam uuid we loaded, or 'demo'

interface QuestionRow {
  id: string;
  external_id: string;
  question_text: string;
  question_type: 'mcq' | 'tita';
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  solution: string | null;
  difficulty: number | null;
  expected_time_seconds: number | null;
  subtopics: {
    id: string;
    name: string;
    frequency_weight: number | null;
    topics: { name: string; topic_weight: number | null } | null;
  } | null;
}

interface ReplicaRow {
  id: string;
  parent_question_id: string | null;
  question_text: string;
  question_type: 'mcq' | 'tita';
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  solution: string | null;
  difficulty: number | null;
  subtopics: {
    id: string;
    name: string;
    frequency_weight: number | null;
    topics: { name: string; topic_weight: number | null } | null;
  } | null;
}

const opts = (
  a: string | null,
  b: string | null,
  c: string | null,
  d: string | null
): MockQuestion['options'] =>
  a !== null && b !== null && c !== null && d !== null ? { a, b, c, d } : undefined;

const mapQuestionRow = (row: QuestionRow): MockQuestion | null => {
  if (!row.subtopics) return null;
  return {
    id: row.id,
    subtopicId: row.subtopics.id,
    subtopicName: row.subtopics.name,
    topicName: row.subtopics.topics?.name ?? 'General',
    externalId: row.external_id,
    questionText: row.question_text,
    questionType: row.question_type,
    options: opts(row.option_a, row.option_b, row.option_c, row.option_d),
    correctAnswer: row.correct_answer,
    solution: row.solution ?? '',
    difficulty: row.difficulty ?? 5,
    expectedTimeSeconds: row.expected_time_seconds ?? 90,
    frequencyWeight: row.subtopics.frequency_weight ?? undefined,
    topicWeight: row.subtopics.topics?.topic_weight ?? undefined,
  };
};

const mapReplicaRow = (row: ReplicaRow): MockQuestion | null => {
  if (!row.subtopics) return null;
  return {
    id: row.id,
    subtopicId: row.subtopics.id,
    subtopicName: row.subtopics.name,
    topicName: row.subtopics.topics?.name ?? 'General',
    externalId: `REPLICA_${row.id.slice(0, 8)}`,
    questionText: row.question_text,
    questionType: row.question_type,
    options: opts(row.option_a, row.option_b, row.option_c, row.option_d),
    correctAnswer: row.correct_answer,
    solution: row.solution ?? '',
    difficulty: row.difficulty ?? 5,
    expectedTimeSeconds: 90,
    isReplica: true,
    // Attempts FK to questions(id); a replica attributes to its parent so the
    // structured attempts insert stays valid.
    parentQuestionId: row.parent_question_id ?? undefined,
    frequencyWeight: row.subtopics.frequency_weight ?? undefined,
    topicWeight: row.subtopics.topics?.topic_weight ?? undefined,
  };
};

const SUBTOPIC_SELECT = 'id, name, frequency_weight, topics(name, topic_weight)';

/** Load and cache the real bank for a signed-in user. */
export const configureQuestionPoolSupabase = async (examSlug: string): Promise<void> => {
  const examUuid = await getExamUuid(examSlug);
  if (configuredFor === examUuid) return;

  const supabase = getSupabase();
  const [questionsRes, replicasRes] = await Promise.all([
    supabase
      .from('questions')
      .select(`id, external_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, expected_time_seconds, subtopics(${SUBTOPIC_SELECT})`)
      .eq('exam_id', examUuid),
    supabase
      .from('replica_questions')
      .select(`id, parent_question_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, solution, difficulty, subtopics(${SUBTOPIC_SELECT})`)
      .eq('status', 'verified'),
  ]);

  const questions = (questionsRes.data as unknown as QuestionRow[] | null) ?? [];
  const replicas = (replicasRes.data as unknown as ReplicaRow[] | null) ?? [];

  const mapped = [
    ...questions.map(mapQuestionRow),
    ...replicas.map(mapReplicaRow),
  ].filter((q): q is MockQuestion => q !== null);

  // If the DB bank is empty (seed not applied yet), keep the mock pool so the
  // app is never left with zero questions.
  pool = mapped.length > 0 ? mapped : ALL_QUESTIONS;
  configuredFor = examUuid;
};

/** Demo/explore mode — serve the mock bank. */
export const configureQuestionPoolDemo = (): void => {
  pool = ALL_QUESTIONS;
  configuredFor = 'demo';
};

/** Synchronous accessor for the current pool. */
export const getPool = (): MockQuestion[] => pool;

export const resetQuestionPool = (): void => {
  pool = ALL_QUESTIONS;
  configuredFor = null;
};

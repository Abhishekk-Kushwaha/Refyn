import { MockQuestion } from '@/lib/mockQuestions';
import { AppError } from '@/lib/errors';
import { getPool } from './questionPool';

export interface PracticeConfig {
  mode: 'weakness' | 'mock' | 'topic';
  questionCount: number;
  isTimed: boolean;
  topicFilter?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// Reads from the runtime pool (mocks in demo, the real Supabase bank when
// signed in — see questionPool.ts). Callers are unchanged from Phase 0.
export const getQuestionsForPractice = async (
  examId: string,
  config: PracticeConfig
): Promise<MockQuestion[]> => {
  void examId; // pool is already scoped to the active exam
  await delay(300);

  try {
    // Non-replica originals for general/mock/topic practice; replicas are
    // reserved for targeted reinforcement drills.
    let poolQuestions = getPool().filter((q) => !q.isReplica);

    if (config.mode === 'topic' && config.topicFilter) {
      poolQuestions = poolQuestions.filter((q) => q.topicName === config.topicFilter);
    }

    const selected = shuffle(poolQuestions).slice(0, config.questionCount);

    if (selected.length === 0) {
      throw new AppError(
        'NOT_FOUND',
        'No questions available for this selection. Try a different topic or mode.'
      );
    }

    return selected;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('UNKNOWN', "Couldn't load questions. Please try again.", e);
  }
};

/**
 * Pull questions for a single subtopic — powers "Start targeted drill" from a
 * weak topic on the dashboard. Includes verified replicas (reinforcement supply).
 */
export const getQuestionsForSubtopic = async (
  examId: string,
  subtopicId: string,
  questionCount = 5,
  subtopicName?: string
): Promise<MockQuestion[]> => {
  void examId;
  await delay(300);

  try {
    let pool = getPool().filter((q) => q.subtopicId === subtopicId);

    // Fall back to matching on name when the id finds nothing.
    //
    // getPool() starts as the mock bank, whose subtopic ids are slugs like
    // 'sub-pl', and only becomes real Supabase UUIDs once
    // configureQuestionPoolSupabase resolves. Anything attempted before that
    // — or in demo mode — leaves the AWE engine holding a mock id for a
    // concept that the live pool keys by UUID, so drilling it would 404 even
    // though the bank is full of those questions. Names survive the switch.
    if (pool.length === 0 && subtopicName) {
      pool = getPool().filter((q) => q.subtopicName === subtopicName);
      if (pool.length > 0 && import.meta.env.DEV) {
        console.warn(
          `[questions] subtopic id "${subtopicId}" missed the pool; recovered ${pool.length} question(s) by name "${subtopicName}".`
        );
      }
    }

    const selected = shuffle(pool).slice(0, questionCount);

    if (selected.length === 0) {
      throw new AppError('NOT_FOUND', 'No questions available for this topic yet.');
    }

    return selected;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('UNKNOWN', "Couldn't load questions. Please try again.", e);
  }
};

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
  questionCount = 5
): Promise<MockQuestion[]> => {
  void examId;
  await delay(300);

  try {
    const pool = getPool().filter((q) => q.subtopicId === subtopicId);
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

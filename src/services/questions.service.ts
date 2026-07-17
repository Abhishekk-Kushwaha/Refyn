import { MOCK_QUESTIONS, MockQuestion } from '@/lib/mockQuestions';
import { AppError } from '@/lib/errors';

export interface PracticeConfig {
  mode: 'weakness' | 'mock' | 'topic';
  questionCount: number;
  isTimed: boolean;
  topicFilter?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// Mirrors the shape of services/questions.service.ts from the Architecture doc —
// swap this body for a real Supabase call in Phase 1 without touching callers.
export const getQuestionsForPractice = async (
  examId: string,
  config: PracticeConfig
): Promise<MockQuestion[]> => {
  void examId; // required per Architecture doc Rule 4; unused until Phase 1 swaps in Supabase
  await delay(500);

  try {
    let pool = MOCK_QUESTIONS;

    if (config.mode === 'topic' && config.topicFilter) {
      pool = pool.filter((q) => q.topicName === config.topicFilter);
    }

    const selected = shuffle(pool).slice(0, config.questionCount);

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

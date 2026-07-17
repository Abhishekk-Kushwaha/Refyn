import { AppError } from '@/lib/errors';

export interface SessionResult {
  mode: 'weakness' | 'mock' | 'topic';
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  avgTimeSeconds: number;
  completedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HISTORY_KEY = 'refyn-session-history';

// Mock persistence via localStorage — swap for a real `sessions` + `attempts`
// insert against Supabase in Phase 1 without touching callers.
export const saveSession = async (result: Omit<SessionResult, 'completedAt'>): Promise<void> => {
  await delay(400);

  try {
    const history: SessionResult[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.push({ ...result, completedAt: new Date().toISOString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    throw new AppError('UNKNOWN', "Couldn't save your session. Your results may not persist.", e);
  }
};

export const getSessionHistory = (): SessionResult[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

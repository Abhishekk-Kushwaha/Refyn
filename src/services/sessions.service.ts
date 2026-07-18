import { AppError } from '@/lib/errors';

export interface SessionResult {
  mode: 'weakness' | 'mock' | 'topic';
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  avgTimeSeconds: number;
  completedAt: string;
}

// One persisted answer, denormalized with the subtopic/topic it belongs to —
// mirrors the `attempts` table (attempts.subtopic_id denormalized for fast
// weakness queries, per Database doc §3.4). This is what the weakness engine reads.
export interface AttemptRecord {
  questionId: string;
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  attemptedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HISTORY_KEY = 'refyn-session-history';
const ATTEMPTS_KEY = 'refyn-attempts';

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

// Append this session's answered attempts (skipped questions are not attempts —
// they carry no signal about whether the user knows the concept). Swap for an
// `attempts` insert in Phase 1.
export const saveAttempts = async (attempts: AttemptRecord[]): Promise<void> => {
  if (attempts.length === 0) return;
  await delay(200);

  try {
    const existing: AttemptRecord[] = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
    existing.push(...attempts);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(existing));
  } catch (e) {
    throw new AppError('UNKNOWN', "Couldn't save your attempt data.", e);
  }
};

export const getAttempts = (): AttemptRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
  } catch {
    return [];
  }
};

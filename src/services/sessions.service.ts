import { AppError } from '@/lib/errors';
import { getSupabase } from './supabase/client';
import { getExamUuid } from './taxonomy.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';

export interface SessionResult {
  mode: 'weakness' | 'mock' | 'topic';
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  avgTimeSeconds: number;
  completedAt: string;
}

// One persisted answer, denormalized with the subtopic/topic it belongs to —
// mirrors the `attempts` table. This is what durable history reads.
export interface AttemptRecord {
  questionId: string;
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  attemptedAt: string;
  // Real replicas FK their attempt to the parent question id (attempts.question_id
  // references questions(id); a replica_questions id is not valid there).
  dbQuestionId?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HISTORY_KEY = 'refyn-session-history';
const ATTEMPTS_KEY = 'refyn-attempts';

const isRealSession = (): boolean => {
  const { session, isDemo } = useAuthStore.getState();
  return Boolean(session && !isDemo);
};

// ============================================================
// DEMO / LOCALSTORAGE PATH
// ============================================================

const lsSaveSession = (result: Omit<SessionResult, 'completedAt'>): void => {
  try {
    const history: SessionResult[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.push({ ...result, completedAt: new Date().toISOString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    throw new AppError('UNKNOWN', "Couldn't save your session. Your results may not persist.", e);
  }
};

const lsSaveAttempts = (attempts: AttemptRecord[]): void => {
  if (attempts.length === 0) return;
  try {
    const existing: AttemptRecord[] = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
    existing.push(...attempts);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(existing));
  } catch (e) {
    throw new AppError('UNKNOWN', "Couldn't save your attempt data.", e);
  }
};

// ============================================================
// SUPABASE PATH
// ============================================================

const sbPersist = async (
  userId: string,
  examSlug: string,
  result: Omit<SessionResult, 'completedAt'>,
  attempts: AttemptRecord[]
): Promise<void> => {
  const supabase = getSupabase();
  const examUuid = await getExamUuid(examSlug);

  // 1. Insert the session and grab its id to hang attempts off.
  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      exam_id: examUuid,
      mode: result.mode,
      total_questions: result.totalQuestions,
      correct_count: result.correctCount,
      accuracy: result.accuracy,
      avg_time_seconds: result.avgTimeSeconds,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (sessionError || !sessionRow) return; // best-effort history; never block the UI

  // 2. Insert attempts, mapping replicas to their parent question id. Any row
  //    whose question id isn't a real questions(id) (e.g. mock fallback) is
  //    dropped rather than failing the whole batch.
  const attemptRows = attempts
    .map((a) => {
      const questionId = a.dbQuestionId ?? a.questionId;
      return {
        user_id: userId,
        session_id: sessionRow.id,
        question_id: questionId,
        subtopic_id: a.subtopicId,
        is_correct: a.isCorrect,
        time_taken_seconds: a.timeTakenSeconds,
      };
    })
    // crude UUID sniff — mock ids like "q1"/"sub-pl" won't satisfy the FK
    .filter((r) => /^[0-9a-f-]{36}$/i.test(r.question_id) && /^[0-9a-f-]{36}$/i.test(r.subtopic_id));

  if (attemptRows.length > 0) {
    await supabase.from('attempts').insert(attemptRows);
  }
};

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Persist a completed session and its answered attempts together. Real accounts
 * write to the sessions + attempts tables (linked); demo writes to localStorage.
 * Always best-effort on the Supabase path — a storage hiccup never breaks review.
 */
export const persistSession = async (
  result: Omit<SessionResult, 'completedAt'>,
  attempts: AttemptRecord[]
): Promise<void> => {
  if (isRealSession()) {
    const { session } = useAuthStore.getState();
    const examId = useExamStore.getState().selectedExamId ?? 'cat';
    try {
      await sbPersist(session!.user.id, examId, result, attempts);
    } catch {
      // swallow — the AWE engine (persisted separately) is the source of truth
    }
    return;
  }

  await delay(300);
  lsSaveSession(result);
  lsSaveAttempts(attempts);
};

export const getSessionHistory = (): SessionResult[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

export const getAttempts = (): AttemptRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
  } catch {
    return [];
  }
};

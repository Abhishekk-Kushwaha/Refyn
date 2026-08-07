import { getSupabase, isSupabaseConfigured } from './supabase/client';
import { getExamUuid } from './taxonomy.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';

/**
 * Practice streak — consecutive days with at least one completed session.
 *
 * `user_exams` already carries `streak` and `last_practice_date`, but nothing
 * had ever written them. Rather than make the streak a server-only number,
 * the day log lives in localStorage and the server columns are mirrored
 * best-effort:
 *
 *   · a local log works identically in demo and signed-in mode, and needs no
 *     round-trip to render a number that appears on the first screen;
 *   · the mirror keeps the DB honest for anything that later reads it.
 *
 * The local log is the source of truth for display. If the two disagree, the
 * device that did the practising wins, which is the one the learner is
 * looking at.
 */

const DAYS_KEY = 'refyn-practice-days';
/** A year of history is far more than any streak needs. */
const MAX_DAYS = 400;

const dayKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const readDays = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAYS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
};

/** Mirrors the streak onto user_exams. Best-effort: never blocks the UI. */
const syncRemote = async (streak: number): Promise<void> => {
  const { session, isDemo } = useAuthStore.getState();
  if (!session || isDemo || !isSupabaseConfigured) return;

  try {
    const examUuid = await getExamUuid(useExamStore.getState().selectedExamId ?? 'cat');
    await getSupabase()
      .from('user_exams')
      .update({ streak, last_practice_date: dayKey(new Date()) })
      .eq('user_id', session.user.id)
      .eq('exam_id', examUuid);
  } catch {
    // The local log still has it; a failed mirror costs nothing on screen.
  }
};

/**
 * Marks today as practised. Idempotent — call it on every completed session.
 */
export const recordPracticeDay = (): void => {
  try {
    const days = readDays();
    const today = dayKey(new Date());
    if (!days.includes(today)) {
      days.push(today);
      days.sort();
      localStorage.setItem(DAYS_KEY, JSON.stringify(days.slice(-MAX_DAYS)));
    }
  } catch {
    return; // no log, no streak — but the session still saved
  }

  void syncRemote(getStreak());
};

/**
 * Consecutive practice days ending today, or ending yesterday when today has
 * no session yet.
 *
 * Counting only from today would flick a live streak to zero every midnight
 * and reset the number a learner is trying to protect, before they have had
 * any chance to practise. The grace day is what makes it a streak rather than
 * a "practised today" flag.
 */
export const getStreak = (): number => {
  const days = new Set(readDays());
  if (days.size === 0) return 0;

  const cursor = new Date();
  // Today doesn't count against you until it's over.
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

/** True when a session has already been logged today. */
export const practisedToday = (): boolean => readDays().includes(dayKey(new Date()));

export const resetStreak = (): void => {
  try {
    localStorage.removeItem(DAYS_KEY);
  } catch {
    /* nothing to clean up */
  }
};

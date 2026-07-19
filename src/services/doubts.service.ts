import { AppError } from '@/lib/errors';
import { aweEngine } from '@/engine/engine';
import { getSupabase } from './supabase/client';
import { getExamUuid } from './taxonomy.service';
import { useAuthStore } from '@/stores/authStore';

// Doubt board service — dual-path:
//   · signed-in users hit Supabase (doubts / answers / answer_votes tables)
//   · demo/explore sessions stay on the localStorage mock, seeded so the
//     board isn't empty
// Requires SQL/seed_content.sql to be applied (author_name +
// author_credibility columns, votes read policy, helpful_count trigger).

export interface Doubt {
  id: string;
  authorId: string;
  authorName: string;
  examId: string;
  conceptId?: string;
  conceptName?: string;
  title: string;
  body: string;
  isResolved: boolean;
  answerCount: number;
  createdAt: string;
}

export interface DoubtAnswer {
  id: string;
  doubtId: string;
  authorId: string;
  authorName: string;
  authorCredibility: number | null; // accuracy % snapshot at answer time
  body: string;
  helpfulCount: number;
  votedBy: string[];
  createdAt: string;
}

export type BoardFilter = 'all' | 'unanswered' | 'mine';

const isRealSession = (): boolean => {
  const { session, isDemo } = useAuthStore.getState();
  return Boolean(session && !isDemo);
};

/** Current user's accuracy in a concept, from the AWE — the credibility source. */
export const getOwnCredibility = (conceptId: string | undefined): number | null => {
  if (!conceptId) return null;
  const m = aweEngine.getMasteries().find((x) => x.conceptId === conceptId);
  if (!m || m.attempts < 3) return null; // too little data to badge honestly
  return Math.round(m.accuracy);
};

// ============================================================
// SUPABASE PATH
// ============================================================

interface DoubtRow {
  id: string;
  user_id: string;
  author_name: string | null;
  exam_id: string;
  subtopic_id: string | null;
  title: string;
  body: string | null;
  is_resolved: boolean;
  answer_count: number;
  created_at: string;
  subtopics: { name: string } | null;
}

const mapDoubtRow = (row: DoubtRow, examSlug: string): Doubt => ({
  id: row.id,
  authorId: row.user_id,
  authorName: row.author_name ?? 'Student',
  examId: examSlug,
  conceptId: row.subtopic_id ?? undefined,
  conceptName: row.subtopics?.name,
  title: row.title,
  body: row.body ?? '',
  isResolved: row.is_resolved,
  answerCount: row.answer_count,
  createdAt: row.created_at,
});

const sbGetDoubts = async (
  examSlug: string,
  filter: BoardFilter,
  currentUserId: string
): Promise<Doubt[]> => {
  const examUuid = await getExamUuid(examSlug);
  let query = getSupabase()
    .from('doubts')
    .select('*, subtopics(name)')
    .eq('exam_id', examUuid)
    .order('created_at', { ascending: false });

  if (filter === 'unanswered') query = query.eq('answer_count', 0);
  if (filter === 'mine') query = query.eq('user_id', currentUserId);

  const { data, error } = await query;
  if (error) throw new AppError('UNKNOWN', "Couldn't load the board.", error);
  return (data as DoubtRow[]).map((row) => mapDoubtRow(row, examSlug));
};

const sbGetDoubtThread = async (
  doubtId: string
): Promise<{ doubt: Doubt; answers: DoubtAnswer[] }> => {
  const supabase = getSupabase();
  const { data: doubtRow, error: doubtError } = await supabase
    .from('doubts')
    .select('*, subtopics(name)')
    .eq('id', doubtId)
    .single();
  if (doubtError || !doubtRow) {
    throw new AppError('NOT_FOUND', "This doubt doesn't exist or was removed.", doubtError);
  }

  const { data: answerRows, error: answersError } = await supabase
    .from('answers')
    .select('*, answer_votes(user_id)')
    .eq('doubt_id', doubtId);
  if (answersError) throw new AppError('UNKNOWN', "Couldn't load answers.", answersError);

  const answers: DoubtAnswer[] = (answerRows ?? [])
    .map((row) => ({
      id: row.id,
      doubtId: row.doubt_id,
      authorId: row.user_id,
      authorName: row.author_name ?? 'Student',
      authorCredibility: row.author_credibility !== null ? Number(row.author_credibility) : null,
      body: row.body,
      helpfulCount: row.helpful_count ?? 0,
      votedBy: (row.answer_votes ?? []).map((v: { user_id: string }) => v.user_id),
      createdAt: row.created_at,
    }))
    .sort((a, b) => b.helpfulCount - a.helpfulCount || a.createdAt.localeCompare(b.createdAt));

  return { doubt: mapDoubtRow(doubtRow as DoubtRow, 'cat'), answers };
};

const sbPostDoubt = async (input: {
  examId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  conceptId?: string;
}): Promise<Doubt> => {
  const examUuid = await getExamUuid(input.examId);
  const { data, error } = await getSupabase()
    .from('doubts')
    .insert({
      user_id: input.authorId,
      author_name: input.authorName,
      exam_id: examUuid,
      subtopic_id: input.conceptId ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .select('*, subtopics(name)')
    .single();
  if (error || !data) throw new AppError('UNKNOWN', "Couldn't post your doubt.", error);
  return mapDoubtRow(data as DoubtRow, input.examId);
};

const sbPostAnswer = async (input: {
  doubtId: string;
  authorId: string;
  authorName: string;
  body: string;
  conceptId?: string;
}): Promise<void> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('answers').insert({
    doubt_id: input.doubtId,
    user_id: input.authorId,
    author_name: input.authorName,
    author_credibility: getOwnCredibility(input.conceptId),
    body: input.body.trim(),
  });
  if (error) throw new AppError('UNKNOWN', "Couldn't post your answer.", error);

  // SECURITY DEFINER function from master_setup — keeps answer_count in sync.
  await supabase.rpc('increment_answer_count', { doubt_id: input.doubtId });
};

const sbToggleHelpful = async (answerId: string, userId: string): Promise<void> => {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('answer_votes')
    .select('answer_id')
    .eq('answer_id', answerId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('answer_votes')
      .delete()
      .eq('answer_id', answerId)
      .eq('user_id', userId);
    if (error) throw new AppError('UNKNOWN', "Couldn't remove your vote.", error);
  } else {
    const { error } = await supabase
      .from('answer_votes')
      .insert({ answer_id: answerId, user_id: userId });
    if (error) throw new AppError('UNKNOWN', "Couldn't record your vote.", error);
  }
  // helpful_count is maintained by the answer_votes trigger (seed_content.sql).
};

const sbMarkResolved = async (doubtId: string, userId: string): Promise<void> => {
  const { error } = await getSupabase()
    .from('doubts')
    .update({ is_resolved: true })
    .eq('id', doubtId)
    .eq('user_id', userId); // RLS enforces this too
  if (error) throw new AppError('UNKNOWN', "Couldn't mark as resolved.", error);
};

// ============================================================
// DEMO / LOCALSTORAGE PATH (seeded mock)
// ============================================================

const DOUBTS_KEY = 'refyn-doubts';
const ANSWERS_KEY = 'refyn-doubt-answers';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const SEED_DOUBTS: Doubt[] = [
  {
    id: 'seed-d1',
    authorId: 'peer-priya',
    authorName: 'Priya K',
    examId: 'cat',
    conceptId: 'sub-tsd',
    conceptName: 'Relative Speed',
    title: 'Why do we ADD speeds for opposite directions?',
    body: "I keep mixing up when to add and when to subtract speeds in train problems. Opposite directions means add, same direction means subtract — but I don't get the intuition. Can someone explain without formulas?",
    isResolved: true,
    answerCount: 2,
    createdAt: daysAgo(2),
  },
  {
    id: 'seed-d2',
    authorId: 'peer-rahul',
    authorName: 'Rahul M',
    examId: 'cat',
    conceptId: 'sub-quad',
    conceptName: 'Roots',
    title: 'Roots in ratio p:q — is assuming roots = pk, qk always valid?',
    body: 'Every solution assumes the roots are pk and qk for some k. Why is that always allowed? What if the roots are negative?',
    isResolved: false,
    answerCount: 1,
    createdAt: daysAgo(1),
  },
  {
    id: 'seed-d3',
    authorId: 'peer-sneha',
    authorName: 'Sneha T',
    examId: 'cat',
    conceptId: 'sub-ci',
    conceptName: 'Annual CI',
    title: 'Spotting perfect powers in CI problems fast?',
    body: '9261/8000 = (21/20)³ — how do people SEE that in 10 seconds? Is there a list of cubes/ratios worth memorizing for CAT?',
    isResolved: false,
    answerCount: 0,
    createdAt: daysAgo(0.2),
  },
];

const SEED_ANSWERS: DoubtAnswer[] = [
  {
    id: 'seed-a1',
    doubtId: 'seed-d1',
    authorId: 'peer-arjun',
    authorName: 'Arjun S',
    authorCredibility: 92,
    body: "Sit in one train and imagine you're stationary. If the other train comes toward you, its speed relative to you is its speed PLUS yours (you're rushing at each other). Same direction: it only gains on you by the difference. The relative-speed frame is the whole trick — distances stay real, speeds become relative.",
    helpfulCount: 14,
    votedBy: [],
    createdAt: daysAgo(1.8),
  },
  {
    id: 'seed-a2',
    doubtId: 'seed-d1',
    authorId: 'peer-rahul',
    authorName: 'Rahul M',
    authorCredibility: 58,
    body: 'Shortcut I use: opposite = "closing in fast" = add. Same direction = "slowly catching up" = subtract. Two cars on a highway vs head-on feels obvious once you picture it.',
    helpfulCount: 6,
    votedBy: [],
    createdAt: daysAgo(1.5),
  },
  {
    id: 'seed-a3',
    doubtId: 'seed-d2',
    authorId: 'peer-arjun',
    authorName: 'Arjun S',
    authorCredibility: 88,
    body: "It's valid because a ratio only fixes the proportion, not the scale — k carries the scale AND the sign. If the roots are negative, k is negative; p:q stays positive. The assumption breaks only if one root is 0 or the ratio itself is negative (opposite-sign roots), which the question would have to say.",
    helpfulCount: 9,
    votedBy: [],
    createdAt: daysAgo(0.8),
  },
];

const loadDoubts = (): Doubt[] => {
  try {
    const raw = localStorage.getItem(DOUBTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  localStorage.setItem(DOUBTS_KEY, JSON.stringify(SEED_DOUBTS));
  return [...SEED_DOUBTS];
};

const loadAnswers = (): DoubtAnswer[] => {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(SEED_ANSWERS));
  return [...SEED_ANSWERS];
};

const saveDoubts = (d: Doubt[]) => localStorage.setItem(DOUBTS_KEY, JSON.stringify(d));
const saveAnswers = (a: DoubtAnswer[]) => localStorage.setItem(ANSWERS_KEY, JSON.stringify(a));

// ============================================================
// PUBLIC API — dispatches per session type
// ============================================================

export const getDoubts = async (
  examId: string,
  filter: BoardFilter,
  currentUserId: string
): Promise<Doubt[]> => {
  if (isRealSession()) return sbGetDoubts(examId, filter, currentUserId);

  await delay(250);
  let doubts = loadDoubts().filter((d) => d.examId === examId);
  if (filter === 'unanswered') doubts = doubts.filter((d) => d.answerCount === 0);
  if (filter === 'mine') doubts = doubts.filter((d) => d.authorId === currentUserId);
  return doubts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getDoubtThread = async (
  doubtId: string
): Promise<{ doubt: Doubt; answers: DoubtAnswer[] }> => {
  if (isRealSession()) return sbGetDoubtThread(doubtId);

  await delay(250);
  const doubt = loadDoubts().find((d) => d.id === doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', "This doubt doesn't exist or was removed.");
  const answers = loadAnswers()
    .filter((a) => a.doubtId === doubtId)
    .sort((a, b) => b.helpfulCount - a.helpfulCount || a.createdAt.localeCompare(b.createdAt));
  return { doubt, answers };
};

export const postDoubt = async (input: {
  examId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  conceptId?: string;
  conceptName?: string;
}): Promise<Doubt> => {
  if (!input.title.trim()) throw new AppError('VALIDATION_ERROR', 'Give your doubt a title.');
  if (isRealSession()) return sbPostDoubt(input);

  await delay(300);
  const doubt: Doubt = {
    id: uid(),
    authorId: input.authorId,
    authorName: input.authorName,
    examId: input.examId,
    conceptId: input.conceptId,
    conceptName: input.conceptName,
    title: input.title.trim(),
    body: input.body.trim(),
    isResolved: false,
    answerCount: 0,
    createdAt: new Date().toISOString(),
  };
  const doubts = loadDoubts();
  doubts.push(doubt);
  saveDoubts(doubts);
  return doubt;
};

export const postAnswer = async (input: {
  doubtId: string;
  authorId: string;
  authorName: string;
  body: string;
  conceptId?: string;
}): Promise<void> => {
  if (!input.body.trim()) throw new AppError('VALIDATION_ERROR', 'Write an answer before posting.');
  if (isRealSession()) return sbPostAnswer(input);

  await delay(300);
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === input.doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', "This doubt doesn't exist anymore.");

  const answer: DoubtAnswer = {
    id: uid(),
    doubtId: input.doubtId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorCredibility: getOwnCredibility(doubt.conceptId),
    body: input.body.trim(),
    helpfulCount: 0,
    votedBy: [],
    createdAt: new Date().toISOString(),
  };
  const answers = loadAnswers();
  answers.push(answer);
  saveAnswers(answers);

  doubt.answerCount += 1;
  saveDoubts(doubts);
};

export const toggleHelpful = async (answerId: string, userId: string): Promise<void> => {
  if (isRealSession()) return sbToggleHelpful(answerId, userId);

  await delay(150);
  const answers = loadAnswers();
  const answer = answers.find((a) => a.id === answerId);
  if (!answer) throw new AppError('NOT_FOUND', 'Answer not found.');
  if (answer.votedBy.includes(userId)) {
    answer.votedBy = answer.votedBy.filter((v) => v !== userId);
    answer.helpfulCount = Math.max(0, answer.helpfulCount - 1);
  } else {
    answer.votedBy.push(userId);
    answer.helpfulCount += 1;
  }
  saveAnswers(answers);
};

export const markResolved = async (doubtId: string, userId: string): Promise<void> => {
  if (isRealSession()) return sbMarkResolved(doubtId, userId);

  await delay(150);
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', 'Doubt not found.');
  if (doubt.authorId !== userId)
    throw new AppError('PERMISSION_DENIED', 'Only the asker can mark this resolved.');
  doubt.isResolved = true;
  saveDoubts(doubts);
};

import { AppError } from '@/lib/errors';
import { aweEngine } from '@/engine/engine';

// Doubt board service — mock/localStorage today, mirrors the doubts / answers /
// answer_votes tables (Database doc §3.7) so Phase 1 swaps storage only.
// Realtime updates and image upload arrive with Supabase.

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
  // Accuracy % in the doubt's concept at time of answering — the credibility
  // badge. null = answerer hasn't practiced that concept (no badge).
  authorCredibility: number | null;
  body: string;
  helpfulCount: number;
  votedBy: string[]; // client-first stand-in for the answer_votes table
  createdAt: string;
}

export type BoardFilter = 'all' | 'unanswered' | 'mine';

const DOUBTS_KEY = 'refyn-doubts';
const ANSWERS_KEY = 'refyn-doubt-answers';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- seed content: fake peers so the board isn't a ghost town pre-launch ----

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

// ---- storage helpers (seed on first read) ----

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

/** Current user's accuracy in a concept, from the AWE — the credibility source. */
export const getOwnCredibility = (conceptId: string | undefined): number | null => {
  if (!conceptId) return null;
  const m = aweEngine.getMasteries().find((x) => x.conceptId === conceptId);
  if (!m || m.attempts < 3) return null; // too little data to badge honestly
  return Math.round(m.accuracy);
};

// ---- the service API (Phase 1 swaps these bodies for Supabase queries) ----

export const getDoubts = async (
  examId: string,
  filter: BoardFilter,
  currentUserId: string
): Promise<Doubt[]> => {
  await delay(250);
  // The board is exam-scoped (Architecture Rule 4): a CAT student's board only
  // ever shows CAT doubts. In Phase 1 this becomes WHERE exam_id = $1 on the
  // doubts table — cross-exam posts are invisible by query, not by convention.
  let doubts = loadDoubts().filter((d) => d.examId === examId);
  if (filter === 'unanswered') doubts = doubts.filter((d) => d.answerCount === 0);
  if (filter === 'mine') doubts = doubts.filter((d) => d.authorId === currentUserId);
  return doubts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getDoubtThread = async (
  doubtId: string
): Promise<{ doubt: Doubt; answers: DoubtAnswer[] }> => {
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
  await delay(300);
  if (!input.title.trim()) throw new AppError('VALIDATION_ERROR', 'Give your doubt a title.');
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
}): Promise<DoubtAnswer> => {
  await delay(300);
  if (!input.body.trim()) throw new AppError('VALIDATION_ERROR', "Write an answer before posting.");
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
  return answer;
};

/** Toggle a helpful vote; one vote per user per answer (answer_votes PK). */
export const toggleHelpful = async (answerId: string, userId: string): Promise<DoubtAnswer> => {
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
  return answer;
};

/** Only the doubt's author may resolve it — enforced by RLS in Phase 1 too. */
export const markResolved = async (doubtId: string, userId: string): Promise<Doubt> => {
  await delay(150);
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', 'Doubt not found.');
  if (doubt.authorId !== userId)
    throw new AppError('PERMISSION_DENIED', 'Only the asker can mark this resolved.');
  doubt.isResolved = true;
  saveDoubts(doubts);
  return doubt;
};

import { AppError } from '@/lib/errors';
import { aweEngine } from '@/engine/engine';
import { getSupabase } from './supabase/client';
import { getExamUuid } from './taxonomy.service';
import { useAuthStore } from '@/stores/authStore';

// Doubt board service — dual-path:
//   · signed-in users hit Supabase (doubts / answers / *_votes / doubt_comments)
//   · demo/explore sessions stay on the localStorage mock, seeded so the
//     board isn't empty
//
// Requires SQL/seed_content.sql (author_name + author_credibility columns,
// votes read policy, helpful_count trigger) and, for voting / accepted answers
// / discussion, SQL/board_votes_and_comments.sql. Reads degrade gracefully
// when the newer migration hasn't been applied — a missing column simply
// reads as a zero score — but writes to the new tables will fail loudly,
// which is the right way round.

/** -1 down, 0 none, 1 up. */
export type VoteValue = -1 | 0 | 1;

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
  /** Net votes: ups minus downs. */
  score: number;
  /** This viewer's own vote, for the rail's lit state. */
  myVote: VoteValue;
  /** The answer the asker marked correct, if any. */
  acceptedAnswerId?: string;
  commentCount: number;
  /**
   * The best answer so far, for the feed card. Carries the answerer's real
   * accuracy — the whole point of the board is that you can see who is worth
   * believing before you open the thread.
   */
  topAnswer?: {
    authorName: string;
    authorCredibility: number | null;
    body: string;
  };
}

export interface DoubtAnswer {
  id: string;
  doubtId: string;
  authorId: string;
  authorName: string;
  authorCredibility: number | null; // accuracy % snapshot at answer time
  /** Questions answered in the concept — the sample behind the credibility. */
  authorSolved: number | null;
  body: string;
  helpfulCount: number;
  myVote: VoteValue;
  isAccepted: boolean;
  createdAt: string;
}

/** Casual chatter, deliberately separate from the ranked answers. */
export interface DoubtComment {
  id: string;
  doubtId: string;
  /** Null for a top-level comment; otherwise the comment being replied to. */
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorCredibility: number | null;
  body: string;
  score: number;
  myVote: VoteValue;
  createdAt: string;
}

export type BoardFilter = 'hot' | 'unanswered' | 'mine' | 'discuss';

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

/** Attempts behind that accuracy. A 94% off 4 questions is not credibility. */
export const getOwnSolved = (conceptId: string | undefined): number | null => {
  if (!conceptId) return null;
  const m = aweEngine.getMasteries().find((x) => x.conceptId === conceptId);
  return m && m.attempts >= 3 ? m.attempts : null;
};

/**
 * Hotness: net score decayed by age.
 *
 * The classic gravity curve — a doubt with 40 votes from last week should not
 * outrank one climbing fast today, or the top of the board never moves and
 * new askers never get seen. Answers are worth a nudge too, since a doubt
 * people are actively working is the one worth surfacing.
 */
export const hotness = (d: Doubt, now = Date.now()): number => {
  const ageHours = Math.max(0, (now - new Date(d.createdAt).getTime()) / 3_600_000);
  const signal = d.score + d.answerCount * 1.5 + d.commentCount * 0.5;
  return signal / Math.pow(ageHours + 2, 1.4);
};

const sortByFilter = (doubts: Doubt[], filter: BoardFilter): Doubt[] => {
  if (filter === 'hot') return [...doubts].sort((a, b) => hotness(b) - hotness(a));
  if (filter === 'discuss')
    return [...doubts].sort(
      (a, b) => b.commentCount - a.commentCount || b.createdAt.localeCompare(a.createdAt)
    );
  return [...doubts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  score?: number | null;
  accepted_answer_id?: string | null;
  comment_count?: number | null;
  subtopics: { name: string } | null;
  doubt_votes?: { user_id: string; value: number }[];
  answers?: {
    author_name: string | null;
    author_credibility: number | null;
    body: string;
    helpful_count: number | null;
  }[];
}

/** Highest-voted answer on a doubt, for the feed preview. */
const pickTopAnswer = (row: DoubtRow): Doubt['topAnswer'] => {
  const best = [...(row.answers ?? [])].sort(
    (a, b) => (b.helpful_count ?? 0) - (a.helpful_count ?? 0)
  )[0];
  if (!best) return undefined;
  return {
    authorName: best.author_name ?? 'Student',
    authorCredibility: best.author_credibility !== null ? Number(best.author_credibility) : null,
    body: best.body,
  };
};

const voteOf = (
  rows: { user_id: string; value?: number }[] | undefined,
  userId: string
): VoteValue => {
  const mine = rows?.find((v) => v.user_id === userId);
  if (!mine) return 0;
  // answer_votes predates downvotes; a row with no value is a legacy upvote.
  return mine.value === -1 ? -1 : 1;
};

const mapDoubtRow = (row: DoubtRow, examSlug: string, userId: string): Doubt => ({
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
  score: row.score ?? 0,
  myVote: voteOf(row.doubt_votes, userId),
  acceptedAnswerId: row.accepted_answer_id ?? undefined,
  commentCount: row.comment_count ?? 0,
  topAnswer: pickTopAnswer(row),
});

/**
 * Selects the board columns, retrying without the newer ones if the migration
 * hasn't run. Without this the whole board 400s on a stale schema rather than
 * simply rendering without vote counts.
 */
const selectDoubts = async (examUuid: string, currentUserId: string, filter: BoardFilter) => {
  const supabase = getSupabase();
  const build = (columns: string) => {
    let q = supabase.from('doubts').select(columns).eq('exam_id', examUuid);
    if (filter === 'unanswered') q = q.eq('answer_count', 0);
    if (filter === 'mine') q = q.eq('user_id', currentUserId);
    return q;
  };

  const ANSWER_PREVIEW = 'answers(author_name, author_credibility, body, helpful_count)';
  const rich = await build(`*, subtopics(name), doubt_votes(user_id, value), ${ANSWER_PREVIEW}`);
  if (!rich.error) return rich.data as unknown as DoubtRow[];

  const plain = await build(`*, subtopics(name), ${ANSWER_PREVIEW}`);
  if (plain.error) throw new AppError('UNKNOWN', "Couldn't load the board.", plain.error);
  return plain.data as unknown as DoubtRow[];
};

const sbGetDoubts = async (
  examSlug: string,
  filter: BoardFilter,
  currentUserId: string
): Promise<Doubt[]> => {
  const examUuid = await getExamUuid(examSlug);
  const rows = await selectDoubts(examUuid, currentUserId, filter);
  return sortByFilter(
    rows.map((row) => mapDoubtRow(row, examSlug, currentUserId)),
    filter
  );
};

const sbGetDoubtThread = async (
  doubtId: string,
  currentUserId: string
): Promise<{ doubt: Doubt; answers: DoubtAnswer[]; comments: DoubtComment[] }> => {
  const supabase = getSupabase();
  const { data: doubtRow, error: doubtError } = await supabase
    .from('doubts')
    .select('*, subtopics(name), doubt_votes(user_id, value)')
    .eq('id', doubtId)
    .single();
  if (doubtError || !doubtRow) {
    throw new AppError('NOT_FOUND', "This doubt doesn't exist or was removed.", doubtError);
  }

  const doubt = mapDoubtRow(doubtRow as unknown as DoubtRow, 'cat', currentUserId);

  const { data: answerRows, error: answersError } = await supabase
    .from('answers')
    .select('*, answer_votes(user_id, value)')
    .eq('doubt_id', doubtId);
  if (answersError) throw new AppError('UNKNOWN', "Couldn't load answers.", answersError);

  const answers: DoubtAnswer[] = (answerRows ?? [])
    .map((row) => ({
      id: row.id,
      doubtId: row.doubt_id,
      authorId: row.user_id,
      authorName: row.author_name ?? 'Student',
      authorCredibility: row.author_credibility !== null ? Number(row.author_credibility) : null,
      authorSolved: row.author_solved ?? null,
      body: row.body,
      helpfulCount: row.helpful_count ?? 0,
      myVote: voteOf(row.answer_votes, currentUserId),
      isAccepted: doubt.acceptedAnswerId === row.id,
      createdAt: row.created_at,
    }))
    .sort(rankAnswers);

  // Comments are optional infrastructure — a board without the migration
  // still shows its answers.
  let comments: DoubtComment[] = [];
  const { data: commentRows } = await supabase
    .from('doubt_comments')
    .select('*, comment_votes(user_id, value)')
    .eq('doubt_id', doubtId);
  if (commentRows) {
    comments = commentRows.map((row) => ({
      id: row.id,
      doubtId: row.doubt_id,
      parentId: row.parent_id ?? null,
      authorId: row.user_id,
      authorName: row.author_name ?? 'Student',
      authorCredibility: row.author_credibility !== null ? Number(row.author_credibility) : null,
      body: row.body,
      score: row.score ?? 0,
      myVote: voteOf(row.comment_votes, currentUserId),
      createdAt: row.created_at,
    }));
  }

  return { doubt, answers, comments };
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
  return mapDoubtRow(data as unknown as DoubtRow, input.examId, input.authorId);
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
    author_solved: getOwnSolved(input.conceptId),
    body: input.body.trim(),
  });
  if (error) throw new AppError('UNKNOWN', "Couldn't post your answer.", error);

  // SECURITY DEFINER function from master_setup — keeps answer_count in sync.
  await supabase.rpc('increment_answer_count', { doubt_id: input.doubtId });
};

/** Upsert-or-delete against a votes table. Shared by all three vote targets. */
const sbSetVote = async (
  table: 'doubt_votes' | 'answer_votes' | 'comment_votes',
  column: 'doubt_id' | 'answer_id' | 'comment_id',
  targetId: string,
  userId: string,
  value: VoteValue
): Promise<void> => {
  const supabase = getSupabase();

  if (value === 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(column, targetId)
      .eq('user_id', userId);
    if (error) throw new AppError('UNKNOWN', "Couldn't remove your vote.", error);
    return;
  }

  const { error } = await supabase
    .from(table)
    .upsert({ [column]: targetId, user_id: userId, value }, { onConflict: `${column},user_id` });
  if (error) throw new AppError('UNKNOWN', "Couldn't record your vote.", error);
};

const sbMarkResolved = async (doubtId: string, userId: string): Promise<void> => {
  const { error } = await getSupabase()
    .from('doubts')
    .update({ is_resolved: true })
    .eq('id', doubtId)
    .eq('user_id', userId); // RLS enforces this too
  if (error) throw new AppError('UNKNOWN', "Couldn't mark as resolved.", error);
};

const sbAcceptAnswer = async (
  doubtId: string,
  answerId: string | null,
  userId: string
): Promise<void> => {
  const { error } = await getSupabase()
    .from('doubts')
    // Accepting an answer resolves the doubt: the asker saying "this one" and
    // the doubt being settled are the same event.
    .update({ accepted_answer_id: answerId, is_resolved: answerId !== null })
    .eq('id', doubtId)
    .eq('user_id', userId);
  if (error) throw new AppError('UNKNOWN', "Couldn't accept that answer.", error);
};

const sbPostComment = async (input: {
  doubtId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  conceptId?: string;
}): Promise<void> => {
  const { error } = await getSupabase().from('doubt_comments').insert({
    doubt_id: input.doubtId,
    parent_id: input.parentId,
    user_id: input.authorId,
    author_name: input.authorName,
    author_credibility: getOwnCredibility(input.conceptId),
    body: input.body.trim(),
  });
  if (error) throw new AppError('UNKNOWN', "Couldn't post your comment.", error);
};

// ============================================================
// DEMO / LOCALSTORAGE PATH (seeded mock)
// ============================================================

const DOUBTS_KEY = 'refyn-doubts';
const ANSWERS_KEY = 'refyn-doubt-answers';
const COMMENTS_KEY = 'refyn-doubt-comments';
/** userId → vote, per entity id. Kept apart so seeds stay immutable. */
const VOTES_KEY = 'refyn-board-votes';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

type StoredDoubt = Omit<Doubt, 'myVote'>;
type StoredAnswer = Omit<DoubtAnswer, 'myVote' | 'isAccepted'>;
type StoredComment = Omit<DoubtComment, 'myVote'>;

const SEED_DOUBTS: StoredDoubt[] = [
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
    score: 24,
    acceptedAnswerId: 'seed-a1',
    commentCount: 3,
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
    score: 41,
    commentCount: 0,
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
    score: 6,
    commentCount: 0,
  },
];

const SEED_ANSWERS: StoredAnswer[] = [
  {
    id: 'seed-a1',
    doubtId: 'seed-d1',
    authorId: 'peer-arjun',
    authorName: 'Arjun S',
    authorCredibility: 92,
    authorSolved: 210,
    body: "Sit in one train and imagine you're stationary. If the other train comes toward you, its speed relative to you is its speed PLUS yours (you're rushing at each other). Same direction: it only gains on you by the difference. The relative-speed frame is the whole trick — distances stay real, speeds become relative.",
    helpfulCount: 31,
    createdAt: daysAgo(1.8),
  },
  {
    id: 'seed-a2',
    doubtId: 'seed-d1',
    authorId: 'peer-rahul',
    authorName: 'Rahul M',
    authorCredibility: 58,
    authorSolved: 47,
    body: 'Shortcut I use: opposite = "closing in fast" = add. Same direction = "slowly catching up" = subtract. Two cars on a highway vs head-on feels obvious once you picture it.',
    helpfulCount: 7,
    createdAt: daysAgo(1.5),
  },
  {
    id: 'seed-a3',
    doubtId: 'seed-d2',
    authorId: 'peer-arjun',
    authorName: 'Arjun S',
    authorCredibility: 88,
    authorSolved: 164,
    body: "It's valid because a ratio only fixes the proportion, not the scale — k carries the scale AND the sign. If the roots are negative, k is negative; p:q stays positive. The assumption breaks only if one root is 0 or the ratio itself is negative (opposite-sign roots), which the question would have to say.",
    helpfulCount: 9,
    createdAt: daysAgo(0.8),
  },
];

const SEED_COMMENTS: StoredComment[] = [
  {
    id: 'seed-c1',
    doubtId: 'seed-d1',
    parentId: null,
    authorId: 'peer-priya',
    authorName: 'Priya K',
    authorCredibility: null,
    body: 'Ohh the "sit in one train" bit is exactly what I kept missing. Thank you 🙏',
    score: 8,
    createdAt: daysAgo(1.6),
  },
  {
    id: 'seed-c2',
    doubtId: 'seed-d1',
    parentId: 'seed-c1',
    authorId: 'peer-arjun',
    authorName: 'Arjun S',
    authorCredibility: 92,
    body: "Anytime! Quick tip: whenever the question says \"towards each other\", reach straight for the sum and you'll never mis-frame it again.",
    score: 5,
    createdAt: daysAgo(1.5),
  },
  {
    id: 'seed-c3',
    doubtId: 'seed-d1',
    parentId: null,
    authorId: 'peer-karan',
    authorName: 'Karan D',
    authorCredibility: null,
    body: 'Saving this. Does the same framing hold when both trains are accelerating?',
    score: 2,
    createdAt: daysAgo(1.2),
  },
];

const load = <T>(key: string, seed: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  try {
    localStorage.setItem(key, JSON.stringify(seed));
  } catch {
    /* storage unavailable — serve the seed in memory */
  }
  return [...seed];
};

const loadDoubts = (): StoredDoubt[] => load(DOUBTS_KEY, SEED_DOUBTS);
const loadAnswers = (): StoredAnswer[] => load(ANSWERS_KEY, SEED_ANSWERS);
const loadComments = (): StoredComment[] => load(COMMENTS_KEY, SEED_COMMENTS);

const saveDoubts = (d: StoredDoubt[]) => localStorage.setItem(DOUBTS_KEY, JSON.stringify(d));
const saveAnswers = (a: StoredAnswer[]) => localStorage.setItem(ANSWERS_KEY, JSON.stringify(a));
const saveComments = (c: StoredComment[]) => localStorage.setItem(COMMENTS_KEY, JSON.stringify(c));

type VoteMap = Record<string, VoteValue>;

const loadVotes = (): VoteMap => {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveVotes = (v: VoteMap) => {
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  } catch {
    /* a lost vote is not worth an error */
  }
};

const myVoteFor = (votes: VoteMap, id: string): VoteValue => votes[id] ?? 0;

/**
 * Applies a vote locally and returns the score delta.
 *
 * The delta is the difference between the old and new vote, not a plain ±1 —
 * flipping an upvote to a downvote moves the score by two.
 */
const applyLocalVote = (id: string, value: VoteValue): number => {
  const votes = loadVotes();
  const previous = myVoteFor(votes, id);
  if (previous === value) return 0;
  if (value === 0) delete votes[id];
  else votes[id] = value;
  saveVotes(votes);
  return value - previous;
};

// ============================================================
// SHARED
// ============================================================

/**
 * Accepted first, then by helpful votes, then oldest.
 *
 * The accepted answer is pinned regardless of score: the asker is the one
 * person who knows whether it actually resolved their confusion, and burying
 * it under a wittier answer with more votes defeats the point of accepting.
 */
const rankAnswers = (a: DoubtAnswer, b: DoubtAnswer): number => {
  if (a.isAccepted !== b.isAccepted) return a.isAccepted ? -1 : 1;
  return b.helpfulCount - a.helpfulCount || a.createdAt.localeCompare(b.createdAt);
};

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
  const votes = loadVotes();
  const answers = loadAnswers();
  const bestFor = (doubtId: string) =>
    answers
      .filter((a) => a.doubtId === doubtId)
      .sort((a, b) => b.helpfulCount - a.helpfulCount)[0];

  let doubts = loadDoubts()
    .filter((d) => d.examId === examId)
    .map((d) => {
      const best = bestFor(d.id);
      return {
        ...d,
        myVote: myVoteFor(votes, d.id),
        topAnswer: best
          ? {
              authorName: best.authorName,
              authorCredibility: best.authorCredibility,
              body: best.body,
            }
          : undefined,
      };
    });

  if (filter === 'unanswered') doubts = doubts.filter((d) => d.answerCount === 0);
  if (filter === 'mine') doubts = doubts.filter((d) => d.authorId === currentUserId);
  if (filter === 'discuss') doubts = doubts.filter((d) => d.commentCount > 0);
  return sortByFilter(doubts, filter);
};

export const getDoubtThread = async (
  doubtId: string,
  currentUserId: string
): Promise<{ doubt: Doubt; answers: DoubtAnswer[]; comments: DoubtComment[] }> => {
  if (isRealSession()) return sbGetDoubtThread(doubtId, currentUserId);

  await delay(250);
  const votes = loadVotes();
  const stored = loadDoubts().find((d) => d.id === doubtId);
  if (!stored) throw new AppError('NOT_FOUND', "This doubt doesn't exist or was removed.");
  const doubt: Doubt = { ...stored, myVote: myVoteFor(votes, stored.id) };

  const answers = loadAnswers()
    .filter((a) => a.doubtId === doubtId)
    .map((a) => ({
      ...a,
      myVote: myVoteFor(votes, a.id),
      isAccepted: doubt.acceptedAnswerId === a.id,
    }))
    .sort(rankAnswers);

  const comments = loadComments()
    .filter((c) => c.doubtId === doubtId)
    .map((c) => ({ ...c, myVote: myVoteFor(votes, c.id) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { doubt, answers, comments };
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
  const doubt: StoredDoubt = {
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
    score: 0,
    commentCount: 0,
  };
  const doubts = loadDoubts();
  doubts.push(doubt);
  saveDoubts(doubts);
  return { ...doubt, myVote: 0 };
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

  const answer: StoredAnswer = {
    id: uid(),
    doubtId: input.doubtId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorCredibility: getOwnCredibility(doubt.conceptId),
    authorSolved: getOwnSolved(doubt.conceptId),
    body: input.body.trim(),
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };
  const answers = loadAnswers();
  answers.push(answer);
  saveAnswers(answers);

  doubt.answerCount += 1;
  saveDoubts(doubts);
};

export const postComment = async (input: {
  doubtId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  conceptId?: string;
}): Promise<void> => {
  if (!input.body.trim()) throw new AppError('VALIDATION_ERROR', 'Write something first.');
  if (isRealSession()) return sbPostComment(input);

  await delay(200);
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === input.doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', "This doubt doesn't exist anymore.");

  const comment: StoredComment = {
    id: uid(),
    doubtId: input.doubtId,
    parentId: input.parentId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorCredibility: getOwnCredibility(doubt.conceptId),
    body: input.body.trim(),
    score: 0,
    createdAt: new Date().toISOString(),
  };
  const comments = loadComments();
  comments.push(comment);
  saveComments(comments);

  doubt.commentCount += 1;
  saveDoubts(doubts);
};

export const voteDoubt = async (
  doubtId: string,
  userId: string,
  value: VoteValue
): Promise<void> => {
  if (isRealSession()) return sbSetVote('doubt_votes', 'doubt_id', doubtId, userId, value);

  await delay(120);
  const delta = applyLocalVote(doubtId, value);
  if (delta === 0) return;
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === doubtId);
  if (doubt) {
    doubt.score += delta;
    saveDoubts(doubts);
  }
};

export const voteAnswer = async (
  answerId: string,
  userId: string,
  value: VoteValue
): Promise<void> => {
  if (isRealSession()) return sbSetVote('answer_votes', 'answer_id', answerId, userId, value);

  await delay(120);
  const delta = applyLocalVote(answerId, value);
  if (delta === 0) return;
  const answers = loadAnswers();
  const answer = answers.find((a) => a.id === answerId);
  if (answer) {
    answer.helpfulCount += delta;
    saveAnswers(answers);
  }
};

export const voteComment = async (
  commentId: string,
  userId: string,
  value: VoteValue
): Promise<void> => {
  if (isRealSession()) return sbSetVote('comment_votes', 'comment_id', commentId, userId, value);

  await delay(120);
  const delta = applyLocalVote(commentId, value);
  if (delta === 0) return;
  const comments = loadComments();
  const comment = comments.find((c) => c.id === commentId);
  if (comment) {
    comment.score += delta;
    saveComments(comments);
  }
};

/** Pass null to un-accept. Asker only. */
export const acceptAnswer = async (
  doubtId: string,
  answerId: string | null,
  userId: string
): Promise<void> => {
  if (isRealSession()) return sbAcceptAnswer(doubtId, answerId, userId);

  await delay(150);
  const doubts = loadDoubts();
  const doubt = doubts.find((d) => d.id === doubtId);
  if (!doubt) throw new AppError('NOT_FOUND', 'Doubt not found.');
  if (doubt.authorId !== userId)
    throw new AppError('PERMISSION_DENIED', 'Only the asker can accept an answer.');
  doubt.acceptedAnswerId = answerId ?? undefined;
  doubt.isResolved = answerId !== null;
  saveDoubts(doubts);
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

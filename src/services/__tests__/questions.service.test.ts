import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockQuestion } from '@/lib/mockQuestions';

// The pool is the only dependency worth faking here — these tests are about
// how getQuestionsForSubtopic resolves a concept against it.
const pool = vi.hoisted(() => ({ current: [] as MockQuestion[] }));
vi.mock('@/services/questionPool', () => ({
  getPool: () => pool.current,
}));

import { getQuestionsForSubtopic } from '@/services/questions.service';

const question = (subtopicId: string, subtopicName: string, id: string): MockQuestion =>
  ({
    id,
    externalId: id,
    questionText: 'q',
    questionType: 'mcq',
    options: { a: '1', b: '2', c: '3', d: '4' },
    correctAnswer: 'a',
    solution: '',
    difficulty: 5,
    expectedTimeSeconds: 60,
    subtopicId,
    subtopicName,
    topicName: 'Arithmetic',
  }) as unknown as MockQuestion;

describe('getQuestionsForSubtopic', () => {
  beforeEach(() => {
    pool.current = [];
  });

  it('returns questions matching the subtopic id', async () => {
    pool.current = [question('uuid-pl', 'Profit & Loss', 'q1')];
    const got = await getQuestionsForSubtopic('cat', 'uuid-pl', 5);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('q1');
  });

  // The regression this file exists for. getPool() starts as the mock bank
  // (subtopic ids like 'sub-pl') and only becomes Supabase UUIDs once the
  // signed-in pool loads. Anything attempted before that leaves the AWE
  // engine holding a mock id, so drilling that concept found nothing and the
  // dashboard surfaced "No questions available for this topic yet" against a
  // bank that was full of them.
  it('recovers by name when the id is stale', async () => {
    pool.current = [question('uuid-pl', 'Profit & Loss', 'q1')];
    const got = await getQuestionsForSubtopic('cat', 'sub-pl', 5, 'Profit & Loss');
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('q1');
  });

  it('prefers an id match over the name fallback', async () => {
    pool.current = [
      question('uuid-pl', 'Profit & Loss', 'by-id'),
      question('uuid-other', 'Profit & Loss', 'by-name'),
    ];
    const got = await getQuestionsForSubtopic('cat', 'uuid-pl', 5, 'Profit & Loss');
    expect(got.map((q) => q.id)).toEqual(['by-id']);
  });

  it('still throws when neither id nor name matches', async () => {
    pool.current = [question('uuid-pl', 'Profit & Loss', 'q1')];
    await expect(
      getQuestionsForSubtopic('cat', 'sub-xyz', 5, 'Nonexistent Concept')
    ).rejects.toThrow(/No questions available/);
  });

  it('throws when the id is stale and no name is supplied', async () => {
    pool.current = [question('uuid-pl', 'Profit & Loss', 'q1')];
    await expect(getQuestionsForSubtopic('cat', 'sub-pl', 5)).rejects.toThrow(
      /No questions available/
    );
  });
});

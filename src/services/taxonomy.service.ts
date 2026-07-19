import { AppError } from '@/lib/errors';
import { getSupabase } from './supabase/client';
import { MOCK_QUESTIONS } from '@/lib/mockQuestions';

// Exam + subtopic lookups against the live schema. Reference data is
// immutable per session, so simple in-memory caches are safe.

const examIdCache = new Map<string, string>();

/** Resolve an exam slug ('cat') to its DB uuid. */
export const getExamUuid = async (slug: string): Promise<string> => {
  const cached = examIdCache.get(slug);
  if (cached) return cached;

  const { data, error } = await getSupabase()
    .from('exams')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error || !data) {
    throw new AppError('UNKNOWN', "Couldn't load exam info. Please try again.", error);
  }
  examIdCache.set(slug, data.id);
  return data.id;
};

export interface SubtopicOption {
  id: string;
  name: string;
}

let subtopicsCache: SubtopicOption[] | null = null;

/**
 * All subtopics for concept tagging, from the seeded taxonomy when signed in;
 * demo sessions fall back to the mock bank's concepts.
 */
export const getSubtopicOptions = async (isAuthenticated: boolean): Promise<SubtopicOption[]> => {
  if (!isAuthenticated) {
    const seen = new Map<string, string>();
    MOCK_QUESTIONS.forEach((q) => seen.set(q.subtopicId, q.subtopicName));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }

  if (subtopicsCache) return subtopicsCache;

  const { data, error } = await getSupabase()
    .from('subtopics')
    .select('id, name')
    .order('display_order', { ascending: true });
  if (error) {
    throw new AppError('UNKNOWN', "Couldn't load the concept list.", error);
  }
  subtopicsCache = data ?? [];
  return subtopicsCache;
};

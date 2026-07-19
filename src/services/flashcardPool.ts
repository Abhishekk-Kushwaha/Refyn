import { MOCK_FLASHCARDS, MockFlashcard } from '@/lib/mockFlashcards';
import { getSupabase } from './supabase/client';

// The servable flashcard pool for the current session — the exact mirror of
// questionPool.ts, and for the same reason.
//
// The engine materializes SM-2 state by matching a card's conceptId against the
// attempted question's subtopicId. Signed-in users answer Supabase questions,
// whose subtopicId is a UUID, while MOCK_FLASHCARDS are keyed by slugs
// ('sub-pl'). Reading cards straight from the mock bank therefore matched
// nothing for real users and no card was ever queued — the Flashcards tab sat
// on "No flashcards yet" no matter how many quizzes they gave.
//
//   · demo/explore → the mock cards (slug concept ids)
//   · signed-in    → the flashcards table (UUID concept ids), fetched once
//
// Card materialization runs inside the synchronous engine, so the pool must be
// resolved up front: configure* is awaited during auth-ready, getFlashcardPool()
// is the sync accessor.

let pool: MockFlashcard[] = MOCK_FLASHCARDS;
// Which bank is loaded — not a plain boolean, so that the demo pool the login
// screen configures doesn't suppress the real fetch on the following sign-in.
let configuredFor: 'demo' | 'supabase' | null = null;

interface FlashcardRow {
  id: string;
  subtopic_id: string;
  front: string;
  back_formula: string | null;
  back_explanation: string | null;
}

const mapFlashcardRow = (row: FlashcardRow): MockFlashcard => ({
  id: row.id,
  conceptId: row.subtopic_id,
  front: row.front,
  backFormula: row.back_formula ?? undefined,
  backExplanation: row.back_explanation ?? '',
});

/**
 * Load and cache the real card bank for a signed-in user.
 *
 * Not filtered by exam: cards are only ever pulled by conceptId for a subtopic
 * the user actually attempted, so out-of-exam rows are inert, and skipping the
 * subtopics→topics→sections join keeps this a single flat read.
 */
export const configureFlashcardPoolSupabase = async (): Promise<void> => {
  if (configuredFor === 'supabase') return;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('flashcards')
    .select('id, subtopic_id, front, back_formula, back_explanation');

  const rows = (data as FlashcardRow[] | null) ?? [];
  // Keep the mock cards if the seed hasn't been applied — better a deck keyed to
  // the wrong concepts than a tab that can never show anything.
  pool = rows.length > 0 ? rows.map(mapFlashcardRow) : MOCK_FLASHCARDS;
  configuredFor = 'supabase';
};

/** Demo/explore mode — serve the mock cards. */
export const configureFlashcardPoolDemo = (): void => {
  pool = MOCK_FLASHCARDS;
  configuredFor = 'demo';
};

/** Synchronous accessor for the current pool. */
export const getFlashcardPool = (): MockFlashcard[] => pool;

export const resetFlashcardPool = (): void => {
  pool = MOCK_FLASHCARDS;
  configuredFor = null;
};

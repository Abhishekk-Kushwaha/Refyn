import { AweConfig, AWE_CONFIG } from './aweConfig';
import { FlashcardState, ReviewGrade } from './types';

// ============================================================
// SM-2 spaced repetition (Doc 5 §8, rules R010/R011).
//
// Three things this must get right that a naive reading of the spec does not:
//
//  1. Intervals only ever grow on success. The "fast-track ladder" is applied as
//     a FLOOR (Math.max), never as an assignment — assigning it made the third
//     consecutive success shorten the interval from 8 days back to 3, i.e. the
//     student was punished for remembering.
//  2. The ease factor is a real SM-2 ease factor: it moves in BOTH directions
//     and it governs every review, not just the first two. A grade of 'again'
//     shrinks it, 'easy' grows it.
//  3. Scheduling is day-aligned. "See it tomorrow" has to mean tomorrow, not
//     "in exactly 24 hours" — otherwise an evening study session pushes every
//     card a day further out, every time.
// ============================================================

/** Sub-day steps a new or lapsed card walks before it graduates. */
const LEARNING_STEPS_MINUTES = [10];

/** Once a card sticks 3× running, intervals may not fall below this ladder. */
const FAST_TRACK_LADDER = [3, 7, 14, 30, 60];

const MINUTE_MS = 1000 * 60;
const DAY_MS = 1000 * 60 * 60 * 24;

const round2 = (n: number) => Math.round(n * 100) / 100;

const addMinutes = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * MINUTE_MS).toISOString();

/**
 * Midnight at the start of the day `days` from `iso`, in the student's local
 * timezone — the review-day boundary, so an interval of 1 is "tomorrow".
 */
export const startOfDayAfter = (iso: string, days: number): string => {
  const d = new Date(iso);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
  return local.toISOString();
};

export const initFlashcardState = (
  cardId: string,
  conceptId: string,
  now: string,
  config: AweConfig = AWE_CONFIG
): FlashcardState => ({
  cardId,
  conceptId,
  easeFactor: config.flashcard_ease_start,
  intervalDays: 0,
  consecutiveCorrect: 0,
  reviewCount: 0,
  lapses: 0,
  learningStep: 0, // starts in the learning ladder
  mastery: 'new',
  nextReviewAt: now, // due immediately when first queued
  lastReviewedAt: null,
});

const clampEase = (ef: number, config: AweConfig): number =>
  round2(Math.min(config.flashcard_ease_max, Math.max(config.flashcard_ease_min, ef)));

const masteryFor = (s: FlashcardState, config: AweConfig): FlashcardState['mastery'] => {
  if (s.learningStep >= 0) return s.reviewCount === 0 ? 'new' : 'learning';
  return s.intervalDays >= config.flashcard_mastered_interval_days ? 'mastered' : 'reviewing';
};

/**
 * The next interval for a graduated card, in days. Never returns less than the
 * current interval + 1 on a success, and never less than the fast-track floor
 * once the card has stuck three times running.
 */
const nextReviewingInterval = (
  s: FlashcardState,
  grade: Exclude<ReviewGrade, 'again'>,
  consecutiveCorrect: number,
  config: AweConfig
): number => {
  const prev = Math.max(1, s.intervalDays);
  const multiplier = grade === 'easy' ? s.easeFactor * 1.3 : s.easeFactor;
  let next = Math.max(prev + 1, Math.round(prev * multiplier));

  if (consecutiveCorrect >= 3) {
    const step = Math.min(consecutiveCorrect - 3, FAST_TRACK_LADDER.length - 1);
    next = Math.max(next, FAST_TRACK_LADDER[step]); // a floor, never an assignment
  }

  return Math.min(config.flashcard_max_interval_days, next);
};

/**
 * Apply one review. `grade` is a real SM-2 quality signal:
 *   again — couldn't recall it        (lapse: ease down, back to learning)
 *   good  — recalled it               (ease unchanged, interval × ease)
 *   easy  — recalled it effortlessly  (ease up, interval × ease × 1.3)
 */
export const reviewCard = (
  input: FlashcardState,
  grade: ReviewGrade,
  now: string,
  config: AweConfig = AWE_CONFIG
): FlashcardState => {
  const s: FlashcardState = { ...input };
  s.reviewCount += 1;
  s.lastReviewedAt = now;

  if (grade === 'again') {
    // R010 — the card is hard. Shrink ease and re-enter the learning ladder,
    // but keep a fraction of the earned interval so a long-matured card does
    // not restart from zero over one slip.
    s.consecutiveCorrect = 0;
    s.easeFactor = clampEase(s.easeFactor - 0.2, config);
    if (s.learningStep < 0) s.lapses += 1;
    s.intervalDays = s.intervalDays > 0 ? Math.max(1, Math.round(s.intervalDays * 0.3)) : 0;
    s.learningStep = 0;
    s.nextReviewAt = addMinutes(now, LEARNING_STEPS_MINUTES[0]);
    s.mastery = masteryFor(s, config);
    return s;
  }

  // R011 — a success.
  s.consecutiveCorrect += 1;
  if (grade === 'easy') s.easeFactor = clampEase(s.easeFactor + 0.1, config);

  if (s.learningStep >= 0) {
    const nextStep = grade === 'easy' ? LEARNING_STEPS_MINUTES.length : s.learningStep + 1;
    if (nextStep < LEARNING_STEPS_MINUTES.length) {
      // still learning — come back in minutes, inside this same session
      s.learningStep = nextStep;
      s.nextReviewAt = addMinutes(now, LEARNING_STEPS_MINUTES[nextStep]);
      s.mastery = masteryFor(s, config);
      return s;
    }
    // graduating: 1 day for 'good', 4 for 'easy', or whatever survived a lapse
    s.learningStep = -1;
    const graduating = grade === 'easy' ? 4 : 1;
    s.intervalDays = Math.max(graduating, s.intervalDays);
  } else {
    s.intervalDays = nextReviewingInterval(s, grade, s.consecutiveCorrect, config);
  }

  s.nextReviewAt = startOfDayAfter(now, s.intervalDays);
  s.mastery = masteryFor(s, config);
  return s;
};

/**
 * What each button will do, so the UI can label them without re-deriving the
 * formula (a duplicated formula is a formula that will drift).
 */
export const previewIntervals = (
  s: FlashcardState,
  config: AweConfig = AWE_CONFIG
): Record<ReviewGrade, number> => ({
  again: 0, // minutes, shown as "in a few minutes"
  good: reviewCard(s, 'good', new Date().toISOString(), config).intervalDays,
  easy: reviewCard(s, 'easy', new Date().toISOString(), config).intervalDays,
});

export const isDue = (s: FlashcardState, now: string): boolean =>
  new Date(s.nextReviewAt).getTime() <= new Date(now).getTime();

/** True while the card is inside its sub-day learning ladder. */
export const isLearning = (s: FlashcardState): boolean => s.learningStep >= 0;

/**
 * Pull a card back into today's deck without destroying its history — used when
 * a concept regresses and its cards must resurface (Doc 5 §8). Creating state
 * only when absent made the re-queue a permanent no-op after the first time.
 */
export const resurface = (s: FlashcardState, now: string): FlashcardState =>
  isDue(s, now) ? s : { ...s, nextReviewAt: now };

/** Days until this card is next due — negative means overdue. */
export const daysUntilDue = (s: FlashcardState, now: string): number =>
  Math.round((new Date(s.nextReviewAt).getTime() - new Date(now).getTime()) / DAY_MS);

import { FlashcardState } from './types';

// SM-2 spaced repetition (Doc 5 §8, rules R010/R011) — the Anki algorithm,
// with the fast-track ladder once a card sticks 3× in a row.

const FAST_TRACK_LADDER = [3, 7, 14, 30, 60];
const DAY_MS = 1000 * 60 * 60 * 24;

const addDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();

export const initFlashcardState = (cardId: string, conceptId: string, now: string): FlashcardState => ({
  cardId,
  conceptId,
  easeFactor: 2.5,
  intervalDays: 1,
  consecutiveCorrect: 0,
  reviewCount: 0,
  mastery: 'new',
  nextReviewAt: now, // due immediately when first queued
  lastReviewedAt: null,
});

/** R011 — "Got it": grow the interval; fast-track once it sticks 3+ times. */
export const reviewGotIt = (input: FlashcardState, now: string): FlashcardState => {
  const s = { ...input };
  s.consecutiveCorrect += 1;
  s.reviewCount += 1;

  if (s.consecutiveCorrect >= 3) {
    const step = Math.min(s.consecutiveCorrect - 3, FAST_TRACK_LADDER.length - 1);
    s.intervalDays = FAST_TRACK_LADDER[step];
  } else {
    s.intervalDays = Math.max(1, Math.round(s.intervalDays * s.easeFactor));
  }

  s.mastery = s.intervalDays >= 30 ? 'mastered' : 'reviewing';
  s.nextReviewAt = addDays(now, s.intervalDays);
  s.lastReviewedAt = now;
  return s;
};

/** R010 — "Not sure": card is hard → shrink ease, see it again tomorrow. */
export const reviewNotSure = (input: FlashcardState, now: string): FlashcardState => {
  const s = { ...input };
  s.consecutiveCorrect = 0;
  s.reviewCount += 1;
  s.easeFactor = Math.max(1.3, Math.round((s.easeFactor - 0.2) * 100) / 100);
  s.intervalDays = 1;
  s.mastery = 'learning';
  s.nextReviewAt = addDays(now, 1);
  s.lastReviewedAt = now;
  return s;
};

export const isDue = (s: FlashcardState, now: string): boolean =>
  new Date(s.nextReviewAt).getTime() <= new Date(now).getTime();

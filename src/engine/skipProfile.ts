import { ConceptMastery, SKIP_EASY_MAX, SKIP_HARD_MIN } from './types';

// Skip analysis. Pure AWE — deterministic, offline, no model involved.
//
// A raw skip count says nothing on its own. Skipping a difficulty-9 question
// after five seconds is good exam technique; skipping a difficulty-2 one
// after ninety seconds is a gap the learner is walking around. These read the
// same in `skips` and completely differently to a student, so the engine
// classifies them here and the AI, when it runs at all, consumes the verdict
// rather than re-deriving it.

export type SkipBehaviour =
  /** Not enough skips to say anything. */
  | 'none'
  /** Skipping questions at their level — the gap is being avoided, not closed. */
  | 'avoiding'
  /** Real time spent, then abandoned. The marks and the minutes both go. */
  | 'stalling'
  /** Mostly hard questions, dropped quickly. Sound triage, not a problem. */
  | 'triaging';

export interface SkipProfile {
  behaviour: SkipBehaviour;
  skips: number;
  /** Share of encounters that ended in a skip, 0–1. */
  skipRate: number;
  /** Mean seconds before giving up. Null when no skip was timed. */
  avgSkipSeconds: number | null;
  /** Mean difficulty of skipped questions, 1–10. Null when none recorded. */
  avgSkipDifficulty: number | null;
  skipsEasy: number;
  skipsHard: number;
  /** One line, ready to render. */
  summary: string;
}

/** Below this, a skip pattern is noise rather than behaviour. */
const MIN_SKIPS_TO_JUDGE = 3;
/** Skipping this share of encounters is heavy regardless of difficulty. */
const HIGH_SKIP_RATE = 0.3;
/** Longer than this before abandoning is time that could have been banked. */
const STALL_SECONDS = 45;

const round1 = (n: number) => Math.round(n * 10) / 10;

export const skipProfileOf = (m: ConceptMastery): SkipProfile => {
  const encounters = m.attempts + m.skips;
  const skipRate = encounters > 0 ? m.skips / encounters : 0;
  const avgSkipSeconds = m.skipTimeCount > 0 ? Math.round(m.skipTimeTotal / m.skipTimeCount) : null;
  const avgSkipDifficulty =
    m.skipDifficultyCount > 0 ? round1(m.skipDifficultyTotal / m.skipDifficultyCount) : null;

  const base = {
    skips: m.skips,
    skipRate: round1(skipRate * 100) / 100,
    avgSkipSeconds,
    avgSkipDifficulty,
    skipsEasy: m.skipsEasy,
    skipsHard: m.skipsHard,
  };

  if (m.skips < MIN_SKIPS_TO_JUDGE) {
    return { ...base, behaviour: 'none', summary: 'Not enough skips to read a pattern.' };
  }

  // Order matters: these overlap, and the most actionable wins.
  //
  // Avoidance first — skipping questions at or below their level is the only
  // one of these that means the concept is not being confronted at all.
  if (m.skipsEasy >= 2 && m.skipsEasy >= m.skipsHard) {
    return {
      ...base,
      behaviour: 'avoiding',
      summary: `Skipping ${m.skipsEasy} question${m.skipsEasy === 1 ? '' : 's'} at difficulty ${SKIP_EASY_MAX} or below — these are within reach, so the gap is not closing on its own.`,
    };
  }

  // Then stalling: the skip itself is defensible, the time spent is not.
  if (avgSkipSeconds !== null && avgSkipSeconds >= STALL_SECONDS) {
    return {
      ...base,
      behaviour: 'stalling',
      summary: `Averaging ${avgSkipSeconds}s before skipping — that time is gone from the paper with no marks to show. Deciding sooner is worth more than deciding better here.`,
    };
  }

  // Healthy triage: hard questions, dropped without ceremony.
  if (avgSkipDifficulty !== null && avgSkipDifficulty >= SKIP_HARD_MIN) {
    return {
      ...base,
      behaviour: 'triaging',
      summary: `Mostly skipping hard questions (avg difficulty ${avgSkipDifficulty}) and moving on quickly. That is sound exam technique.`,
    };
  }

  // A high skip rate is only damning once we know what was being skipped.
  // Without any difficulty recorded — every pre-v4 concept — avoidance and
  // sound triage are indistinguishable, and calling it avoidance would accuse
  // a learner who was in fact managing the clock well.
  if (skipRate >= HIGH_SKIP_RATE && m.skipDifficultyCount > 0) {
    return {
      ...base,
      behaviour: 'avoiding',
      summary: `Skipping ${Math.round(skipRate * 100)}% of what you see here — a high share whatever the difficulty.`,
    };
  }

  return { ...base, behaviour: 'none', summary: 'Skip pattern looks unremarkable.' };
};

/** Concepts worth showing on the skip panel, most concerning first. */
export const rankSkipConcerns = (masteries: ConceptMastery[]): (SkipProfile & {
  conceptId: string;
  conceptName: string;
  topicName: string;
})[] => {
  const severity: Record<SkipBehaviour, number> = {
    avoiding: 3,
    stalling: 2,
    triaging: 1,
    none: 0,
  };

  return masteries
    .map((m) => ({
      ...skipProfileOf(m),
      conceptId: m.conceptId,
      conceptName: m.conceptName,
      topicName: m.topicName,
    }))
    .filter((p) => p.behaviour !== 'none')
    .sort((a, b) => severity[b.behaviour] - severity[a.behaviour] || b.skips - a.skips);
};

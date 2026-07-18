import { AweConfig } from './aweConfig';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const last10Accuracy = (last10: boolean[]): number => {
  if (last10.length === 0) return 0;
  return (last10.filter(Boolean).length / last10.length) * 100;
};

/**
 * Mastery rises slow, falls fast (Doc 5 §5) — so "mastered" is earned, not luck.
 * - correct: ease 30% of the way toward recent form (last-10 accuracy)
 * - wrong:   sharp 30% cut, immediately visible
 */
export const updateMasteryScore = (
  current: number,
  isCorrect: boolean,
  recentAccuracy: number,
  config: AweConfig
): number => {
  if (isCorrect) {
    return clamp(current + (recentAccuracy - current) * config.mastery_gain_rate);
  }
  return clamp(current * config.mastery_loss_multiplier);
};

const DAY_MS = 1000 * 60 * 60 * 24;

/** Recency multiplier: today = 1.0, decays toward 0.5 over ~60 days. */
export const recencyWeight = (lastAttemptAt: string | null, now: string): number => {
  if (!lastAttemptAt) return 1;
  const days = (new Date(now).getTime() - new Date(lastAttemptAt).getTime()) / DAY_MS;
  return Math.max(0.5, 1 - days / 60);
};

/** Recompute both derived scores on a mastery record (mutates the copy passed in). */
export const recomputeScores = (m: {
  accuracy: number;
  frequencyWeight: number;
  topicWeight: number;
  masteryScore: number;
  lastAttemptAt: string | null;
  weaknessScore: number;
  priorityWeight: number;
}, now: string): void => {
  m.weaknessScore =
    Math.round(
      (1 - m.accuracy / 100) *
        m.frequencyWeight *
        m.topicWeight *
        recencyWeight(m.lastAttemptAt, now) *
        100 *
        10
    ) / 10;
  m.priorityWeight =
    Math.round(m.topicWeight * m.frequencyWeight * (1 - m.masteryScore / 100) * 1000) / 1000;
};

import { AweConfig } from './aweConfig';
import { AttemptSignal, ConceptMastery } from './types';

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Accuracy over a rolling window of answered results, 0–100. */
export const windowAccuracy = (window: boolean[]): number => {
  if (window.length === 0) return 0;
  return (window.filter(Boolean).length / window.length) * 100;
};

/** Back-compat alias — the rolling window is 10 wide by default. */
export const last10Accuracy = windowAccuracy;

/**
 * How much a single answer should move the score.
 * A hard question earns more and forgives more; an easy one does the reverse.
 */
const difficultyFactor = (difficulty: number | undefined, config: AweConfig): number => {
  if (difficulty === undefined || !Number.isFinite(difficulty)) return 1;
  const pivot = config.mastery_difficulty_pivot;
  const raw = 1 + ((difficulty - pivot) / pivot) * config.mastery_difficulty_span;
  return clamp(raw, 1 - config.mastery_difficulty_span, 1 + config.mastery_difficulty_span);
};

/** Correct-but-slow is worth less than correct-and-quick on a speed exam. */
const speedFactor = (ratio: number | null, config: AweConfig): number =>
  ratio !== null && ratio > config.mastery_slow_answer_ratio
    ? config.mastery_slow_answer_factor
    : 1;

/** timeTaken / expectedTime for one answer, or null when untimed. */
export const timeRatioOf = (signal: AttemptSignal): number | null => {
  const { timeTakenSeconds, expectedTimeSeconds } = signal;
  if (!timeTakenSeconds || !expectedTimeSeconds || expectedTimeSeconds <= 0) return null;
  return timeTakenSeconds / expectedTimeSeconds;
};

/** Exponentially-weighted pacing average, so one slow answer doesn't define a concept. */
export const updateTimeRatio = (current: number | null, sample: number | null): number | null => {
  if (sample === null) return current;
  if (current === null) return round3(sample);
  return round3(current * 0.7 + sample * 0.3);
};

/**
 * Mastery rises slow, falls fast (Doc 5 §5) — so "mastered" is earned, not luck.
 * - correct: ease toward recent form, scaled by difficulty and pace
 * - wrong:   sharp cut, softened slightly on genuinely hard questions
 */
export const updateMasteryScore = (
  current: number,
  signal: AttemptSignal,
  recentAccuracy: number,
  config: AweConfig
): number => {
  const diff = difficultyFactor(signal.difficulty, config);

  if (signal.isCorrect) {
    const speed = speedFactor(timeRatioOf(signal), config);
    const rate = config.mastery_gain_rate * diff * speed;
    return clamp(current + (recentAccuracy - current) * rate);
  }

  // Failing an easy question is more damning than failing a hard one.
  const loss = clamp(
    config.mastery_loss_multiplier + (diff - 1) * 0.2,
    config.mastery_loss_multiplier,
    0.9
  );
  return clamp(current * loss);
};

/** Recency multiplier: today = 1.0, decaying to a floor over the decay window. */
export const recencyWeight = (
  lastAttemptAt: string | null,
  now: string,
  config: AweConfig
): number => {
  if (!lastAttemptAt) return 1;
  const days =
    (new Date(now).getTime() - new Date(lastAttemptAt).getTime()) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days)) return 1;
  return Math.max(config.recency_floor, 1 - days / config.recency_decay_days);
};

/**
 * Recompute both derived scores (mutates the copy passed in).
 *
 * weaknessScore is an *expected* error rate — shrunk toward a neutral prior and
 * then scaled by how much evidence backs it. Without that confidence term a
 * single wrong first attempt scores the theoretical maximum and outranks a
 * concept the student has demonstrably failed twenty times.
 */
export const recomputeScores = (m: ConceptMastery, now: string, config: AweConfig): void => {
  const effAttempts = m.attempts + m.skips;
  const effWrong = m.incorrect + m.skips * config.skip_weakness_weight;
  const k = config.weakness_confidence_attempts;

  const smoothedError =
    effAttempts > 0
      ? (effWrong + config.weakness_prior_error * k) / (effAttempts + k)
      : config.weakness_prior_error;
  const confidence = effAttempts / (effAttempts + k);

  m.weaknessScore = round1(
    smoothedError *
      m.frequencyWeight *
      m.topicWeight *
      recencyWeight(m.lastAttemptAt, now, config) *
      confidence *
      100
  );

  m.priorityWeight = round3(m.topicWeight * m.frequencyWeight * (1 - m.masteryScore / 100));
};

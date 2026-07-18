import { getAttempts, AttemptRecord } from './sessions.service';
import { SUBTOPIC_META } from '@/lib/mockQuestions';

export type WeaknessBand = 'critical' | 'weak' | 'improving' | 'strong' | 'untested';

// Per-subtopic weakness, computed from attempt history. Mirrors the shape the
// dashboard reads from `concept_mastery` once the AWE Edge Function populates it
// (Database doc §4) — same fields the radar + ranked list consume.
export interface SubtopicWeakness {
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0–100
  weaknessScore: number; // higher = weaker & more exam-relevant
  band: WeaknessBand;
  lastAttemptedAt: string | null;
}

export interface TopicWeakness {
  topicName: string;
  accuracy: number; // 0–100, weighted average across the topic's tested subtopics
  attempts: number;
  weaknessScore: number; // mean of subtopic scores — drives the radar axis value
}

export interface WeaknessSnapshot {
  subtopics: SubtopicWeakness[]; // ranked weakest-first
  topics: TopicWeakness[]; // one per topic that has any attempts, for the radar
  totalAttempts: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

// Recency multiplier: a weakness you saw today matters more than one from weeks
// ago. Decays from 1.0 (today) toward ~0.5 over ~30 days, never below 0.5.
const recencyWeight = (lastAttemptedAt: string | null): number => {
  if (!lastAttemptedAt) return 1;
  const days = (Date.now() - new Date(lastAttemptedAt).getTime()) / DAY_MS;
  return Math.max(0.5, 1 - days / 60);
};

const bandFor = (accuracy: number, attempts: number): WeaknessBand => {
  if (attempts === 0) return 'untested';
  if (accuracy < 40) return 'critical';
  if (accuracy < 60) return 'weak';
  if (accuracy < 80) return 'improving';
  return 'strong';
};

const computeSubtopic = (attempts: AttemptRecord[]): SubtopicWeakness => {
  const first = attempts[0];
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  const meta = SUBTOPIC_META[first.subtopicId] ?? { frequencyWeight: 1, topicWeight: 1 };
  const lastAttemptedAt =
    attempts.reduce((latest, a) => (a.attemptedAt > latest ? a.attemptedAt : latest), attempts[0].attemptedAt) ??
    null;

  // weakness = (1 − accuracy) × frequency × topic importance × recency
  // Scaled to 0–100 for a readable score. All four factors come straight from
  // the design's weakness formula (Architecture doc §5, Database doc §4).
  const weaknessScore =
    (1 - accuracy / 100) *
    meta.frequencyWeight *
    meta.topicWeight *
    recencyWeight(lastAttemptedAt) *
    100;

  return {
    subtopicId: first.subtopicId,
    subtopicName: first.subtopicName,
    topicName: first.topicName,
    attempts: total,
    correct,
    accuracy: Math.round(accuracy),
    weaknessScore: Math.round(weaknessScore * 10) / 10,
    band: bandFor(accuracy, total),
    lastAttemptedAt,
  };
};

/**
 * Compute the weakness snapshot from all persisted attempts for an exam.
 * `examId` is required (Architecture doc Rule 4) — Phase 1 will use it to scope
 * the Supabase query; today all mock attempts belong to the one seeded exam.
 */
export const getWeaknessSnapshot = async (examId: string): Promise<WeaknessSnapshot> => {
  void examId;
  await new Promise((resolve) => setTimeout(resolve, 300));

  const all = getAttempts();

  const bySubtopic = new Map<string, AttemptRecord[]>();
  all.forEach((a) => {
    const list = bySubtopic.get(a.subtopicId) ?? [];
    list.push(a);
    bySubtopic.set(a.subtopicId, list);
  });

  const subtopics = Array.from(bySubtopic.values())
    .map(computeSubtopic)
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  // Aggregate to topic level for the radar — one axis per topic that has data.
  const byTopic = new Map<string, SubtopicWeakness[]>();
  subtopics.forEach((s) => {
    const list = byTopic.get(s.topicName) ?? [];
    list.push(s);
    byTopic.set(s.topicName, list);
  });

  const topics: TopicWeakness[] = Array.from(byTopic.entries()).map(([topicName, subs]) => {
    const attempts = subs.reduce((sum, s) => sum + s.attempts, 0);
    const correct = subs.reduce((sum, s) => sum + s.correct, 0);
    const weaknessScore = subs.reduce((sum, s) => sum + s.weaknessScore, 0) / subs.length;
    return {
      topicName,
      attempts,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
      weaknessScore: Math.round(weaknessScore * 10) / 10,
    };
  });

  return {
    subtopics,
    topics,
    totalAttempts: all.length,
  };
};

import { aweEngine } from '@/engine/engine';
import { ConceptStatus } from '@/engine/types';

export type WeaknessBand = 'critical' | 'weak' | 'learning' | 'improving' | 'strong' | 'untested';

// Dashboard read model. Since the AWE landed, this service is a thin projection
// of the engine's ConceptMastery state — same signature the Phase 1 Supabase
// `concept_mastery` read will keep.
export interface SubtopicWeakness {
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0–100
  weaknessScore: number;
  band: WeaknessBand;
  status: ConceptStatus;
  lastAttemptedAt: string | null;
}

export interface TopicWeakness {
  topicName: string;
  accuracy: number;
  attempts: number;
  weaknessScore: number;
}

export interface WeaknessSnapshot {
  subtopics: SubtopicWeakness[]; // ranked weakest-first
  topics: TopicWeakness[];
  totalAttempts: number;
}

const bandForStatus: Record<ConceptStatus, WeaknessBand> = {
  very_weak: 'critical',
  weak: 'weak',
  learning: 'learning',
  improving: 'improving',
  mastered: 'strong',
  unattempted: 'untested',
};

export const getWeaknessSnapshot = async (examId: string): Promise<WeaknessSnapshot> => {
  void examId; // required per Architecture doc Rule 4; scopes the query in Phase 1
  await new Promise((resolve) => setTimeout(resolve, 200));

  const masteries = aweEngine.getMasteries().filter((m) => m.attempts > 0);

  const subtopics: SubtopicWeakness[] = masteries
    .map((m) => ({
      subtopicId: m.conceptId,
      subtopicName: m.conceptName,
      topicName: m.topicName,
      attempts: m.attempts,
      correct: m.correct,
      accuracy: Math.round(m.accuracy),
      weaknessScore: m.weaknessScore,
      band: bandForStatus[m.status],
      status: m.status,
      lastAttemptedAt: m.lastAttemptAt,
    }))
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

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
    totalAttempts: masteries.reduce((sum, m) => sum + m.attempts, 0),
  };
};

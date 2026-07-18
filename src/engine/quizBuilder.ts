import { AweConfig } from './aweConfig';
import { ConceptMastery, QueueItem, QueueReason } from './types';
import { MockQuestion, SUBTOPIC_META } from '@/lib/mockQuestions';

// ============================================================
// THE DAILY BLENDED QUIZ (Doc 5 §6, Rule R007)
// 70% weak (Arithmetic/Algebra first) · 20% revision · 10% mixed.
// Mixed slice becomes old-weakness revival inside the pre-CAT window (R009).
// Pure: (state, pool, config) → slots. The engine facade handles persistence.
// ============================================================

export interface QuizSlot {
  question: MockQuestion;
  conceptId: string;
  reason: QueueReason;
}

export interface BuiltQuiz {
  slots: QuizSlot[];
  consumedQueueIds: string[];
}

interface ConceptCandidate {
  conceptId: string;
  priorityWeight: number;
  preferReplicas: boolean;
}

// Round-robin questions across concepts (weakest concept first) so a 7-question
// weak slice covers several concepts instead of exhausting one.
const pickAcrossConcepts = (
  concepts: ConceptCandidate[],
  count: number,
  pool: MockQuestion[],
  used: Set<string>,
  reasonFor: (c: ConceptCandidate) => QueueReason
): QuizSlot[] => {
  const slots: QuizSlot[] = [];
  const perConcept = concepts.map((c) => {
    let qs = pool.filter((q) => q.subtopicId === c.conceptId && !used.has(q.id));
    if (c.preferReplicas) {
      qs = [...qs.filter((q) => q.isReplica), ...qs.filter((q) => !q.isReplica)];
    }
    return { c, qs, i: 0 };
  });

  while (slots.length < count) {
    let progressed = false;
    for (const entry of perConcept) {
      if (slots.length >= count) break;
      while (entry.i < entry.qs.length && used.has(entry.qs[entry.i].id)) entry.i += 1;
      if (entry.i < entry.qs.length) {
        const q = entry.qs[entry.i];
        entry.i += 1;
        used.add(q.id);
        slots.push({ question: q, conceptId: entry.c.conceptId, reason: reasonFor(entry.c) });
        progressed = true;
      }
    }
    if (!progressed) break; // pools exhausted
  }
  return slots;
};

export const buildQuiz = (
  masteries: ConceptMastery[],
  pool: MockQuestion[],
  queue: QueueItem[],
  total: number,
  config: AweConfig,
  daysToExam: number | null,
  reviewsDue: Record<string, string>,
  now: string
): BuiltQuiz => {
  const used = new Set<string>();
  const byId = new Map(masteries.map((m) => [m.conceptId, m]));
  const openQueue = queue.filter((i) => !i.consumed);
  const replicaPreferred = new Set(
    openQueue.filter((i) => i.preferReplicas).map((i) => i.conceptId)
  );

  const weakCount = Math.round((total * config.daily_quiz_weak_topic_pct) / 100);
  const revisionCount = Math.round((total * config.daily_quiz_revision_pct) / 100);

  // --- 70% weak: weak/very_weak, highest priority first (topicWeight bakes in
  // the Arithmetic/Algebra extreme priority) ---
  const weakConcepts: ConceptCandidate[] = masteries
    .filter((m) => m.status === 'weak' || m.status === 'very_weak')
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .map((m) => ({
      conceptId: m.conceptId,
      priorityWeight: m.priorityWeight,
      preferReplicas: replicaPreferred.has(m.conceptId) || m.status === 'very_weak',
    }));

  const weakSlots = pickAcrossConcepts(weakConcepts, weakCount, pool, used, (c) =>
    replicaPreferred.has(c.conceptId) ? 'replica_reinforcement' : 'weak_concept'
  );

  // --- 20% revision: improving concepts + mastered ones with a due review ---
  const revisionConcepts: ConceptCandidate[] = masteries
    .filter(
      (m) =>
        m.status === 'improving' ||
        (m.status === 'mastered' &&
          reviewsDue[m.conceptId] !== undefined &&
          new Date(reviewsDue[m.conceptId]).getTime() <= new Date(now).getTime())
    )
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .map((m) => ({ conceptId: m.conceptId, priorityWeight: m.priorityWeight, preferReplicas: false }));

  const revisionSlots = pickAcrossConcepts(revisionConcepts, revisionCount, pool, used, () => 'revision');

  // --- 10% mixed: pre-CAT window → old scars (R009); otherwise fresh coverage ---
  const mixedCount = total - weakSlots.length - revisionSlots.length;
  const inRevivalWindow = daysToExam !== null && daysToExam <= config.cat_countdown_revival_days;

  let mixedConcepts: ConceptCandidate[];
  let mixedReason: QueueReason;
  if (inRevivalWindow) {
    mixedConcepts = masteries
      .filter((m) => m.status === 'mastered' && m.everWasVeryWeak)
      .sort((a, b) => b.priorityWeight - a.priorityWeight)
      .map((m) => ({ conceptId: m.conceptId, priorityWeight: m.priorityWeight, preferReplicas: false }));
    mixedReason = 'old_weakness_revival';
  } else {
    // untouched or least-attempted concepts present in the pool
    const poolConceptIds = Array.from(new Set(pool.map((q) => q.subtopicId)));
    mixedConcepts = poolConceptIds
      .map((id) => {
        const m = byId.get(id);
        const meta = SUBTOPIC_META[id] ?? { frequencyWeight: 1, topicWeight: 1 };
        return {
          conceptId: id,
          priorityWeight: meta.topicWeight * meta.frequencyWeight,
          attempts: m?.attempts ?? 0,
          preferReplicas: false,
        };
      })
      .sort((a, b) => a.attempts - b.attempts || b.priorityWeight - a.priorityWeight);
    mixedReason = 'balanced_practice';
  }

  const mixedSlots = pickAcrossConcepts(mixedConcepts, mixedCount, pool, used, () => mixedReason);

  // --- backfill any shortfall from whatever's left, weakest concepts first ---
  const slots = [...weakSlots, ...revisionSlots, ...mixedSlots];
  if (slots.length < total) {
    const remaining = pool
      .filter((q) => !used.has(q.id))
      .sort((a, b) => {
        const pa = byId.get(a.subtopicId)?.priorityWeight ?? 0;
        const pb = byId.get(b.subtopicId)?.priorityWeight ?? 0;
        return pb - pa;
      });
    for (const q of remaining) {
      if (slots.length >= total) break;
      used.add(q.id);
      slots.push({ question: q, conceptId: q.subtopicId, reason: 'balanced_practice' });
    }
  }

  // consume queue items whose concept made it into the quiz
  const servedConcepts = new Set(slots.map((s) => s.conceptId));
  const consumedQueueIds = openQueue.filter((i) => servedConcepts.has(i.conceptId)).map((i) => i.id);

  return { slots, consumedQueueIds };
};

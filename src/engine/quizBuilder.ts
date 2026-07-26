import { AweConfig } from './aweConfig';
import { ConceptMastery, QueueItem, QueueReason } from './types';
import { MockQuestion, SUBTOPIC_META } from '@/lib/mockQuestions';

// ============================================================
// THE DAILY BLENDED QUIZ (Doc 5 §6, Rule R007)
// 70% weak (Arithmetic/Algebra first) · 20% revision · 10% mixed.
// Mixed slice becomes old-weakness revival inside the pre-CAT window (R009).
// Pure: (state, pool, config) → slots. The engine facade handles persistence.
// ============================================================

const DAY_MS = 1000 * 60 * 60 * 24;

export interface QuizSlot {
  question: MockQuestion;
  conceptId: string;
  reason: QueueReason;
}

export interface BuiltQuiz {
  slots: QuizSlot[];
  /** queueItemId → how many questions were actually served against it. */
  queueServed: Record<string, number>;
  /** Every question id served, for the cooldown ledger. */
  servedQuestionIds: string[];
}

export interface BuildQuizInput {
  masteries: ConceptMastery[];
  pool: MockQuestion[];
  queue: QueueItem[];
  total: number;
  config: AweConfig;
  daysToExam: number | null;
  reviewsDue: Record<string, string>;
  seenQuestions: Record<string, string>;
  now: string;
}

/** One concept's claim on the quiz, optionally capped by the queue item behind it. */
interface Demand {
  conceptId: string;
  priorityWeight: number;
  preferReplicas: boolean;
  limit: number; // how many questions this demand may take
  queueId?: string;
  reason: QueueReason;
}

/**
 * Split the config percentages across `total` with largest-remainder rounding,
 * so the three slices always sum to exactly `total`. Rounding each slice
 * independently silently deleted the mixed slice at small quiz sizes
 * (total=5 → 4 + 1 + 0) and never used daily_quiz_mixed_pct at all.
 */
export const allocate = (total: number, pcts: number[]): number[] => {
  const sum = pcts.reduce((a, b) => a + b, 0) || 1;
  // Integer arithmetic on purpose: comparing floating-point remainders sent the
  // spare slot to the wrong slice (0.4 > 0.3999999999999999).
  const scaled = pcts.map((p) => total * p);
  const floors = scaled.map((s) => Math.floor(s / sum));
  const remainders = scaled.map((s) => s % sum);

  let spare = total - floors.reduce((a, b) => a + b, 0);
  const order = remainders
    .map((r, i) => ({ i, r }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (spare <= 0) break;
    floors[i] += 1;
    spare -= 1;
  }

  // Every configured slice gets at least one slot once the quiz is big enough
  // to hold them all. Pure rounding silently deleted the 10% mixed slice at
  // small quiz sizes, so short sessions had no coverage — and inside the
  // pre-CAT window, no revival either.
  const configured = pcts.filter((p) => p > 0).length;
  if (total >= configured) {
    for (let i = 0; i < floors.length; i++) {
      if (pcts[i] <= 0 || floors[i] > 0) continue;
      const donor = floors.indexOf(Math.max(...floors));
      if (floors[donor] > 1) {
        floors[donor] -= 1;
        floors[i] += 1;
      }
    }
  }

  return floors;
};

/**
 * Round-robin questions across concepts (weakest first) so a 7-question weak
 * slice covers several concepts instead of exhausting one, while never
 * exceeding any single demand's limit.
 */
const pickAcrossDemands = (
  demands: Demand[],
  count: number,
  questionsFor: (d: Demand) => MockQuestion[],
  used: Set<string>
): QuizSlot[] => {
  const slots: QuizSlot[] = [];
  if (count <= 0) return slots;

  const entries = demands.map((d) => ({ d, qs: questionsFor(d), i: 0, taken: 0 }));

  while (slots.length < count) {
    let progressed = false;
    for (const entry of entries) {
      if (slots.length >= count) break;
      if (entry.taken >= entry.d.limit) continue;
      while (entry.i < entry.qs.length && used.has(entry.qs[entry.i].id)) entry.i += 1;
      if (entry.i >= entry.qs.length) continue;

      const q = entry.qs[entry.i];
      entry.i += 1;
      entry.taken += 1;
      used.add(q.id);
      slots.push({ question: q, conceptId: entry.d.conceptId, reason: entry.d.reason });
      progressed = true;
    }
    if (!progressed) break; // pools or limits exhausted
  }
  return slots;
};

export const buildQuiz = ({
  masteries,
  pool,
  queue,
  total,
  config,
  daysToExam,
  reviewsDue,
  seenQuestions,
  now,
}: BuildQuizInput): BuiltQuiz => {
  const used = new Set<string>();
  const byId = new Map(masteries.map((m) => [m.conceptId, m]));
  const nowMs = new Date(now).getTime();
  const cooldownMs = config.question_cooldown_days * DAY_MS;

  // ---- Taxonomy weights ----------------------------------------------------
  // Resolved from the mastery record first, then the question row's own joined
  // weights, and only then the mock meta table. SUBTOPIC_META is keyed by mock
  // slugs, so for a signed-in user (UUID concept ids) every lookup missed and
  // every concept silently collapsed to a neutral 1.0 — discarding the
  // Arithmetic/Algebra priority the whole engine is built around.
  const poolWeights = new Map<string, { topicWeight: number; frequencyWeight: number }>();
  for (const q of pool) {
    if (poolWeights.has(q.subtopicId)) continue;
    if (q.topicWeight !== undefined || q.frequencyWeight !== undefined) {
      poolWeights.set(q.subtopicId, {
        topicWeight: q.topicWeight ?? 1,
        frequencyWeight: q.frequencyWeight ?? 1,
      });
    }
  }
  const weightsFor = (conceptId: string) => {
    const m = byId.get(conceptId);
    if (m) return { topicWeight: m.topicWeight, frequencyWeight: m.frequencyWeight };
    return (
      poolWeights.get(conceptId) ??
      SUBTOPIC_META[conceptId] ?? { topicWeight: 1, frequencyWeight: 1 }
    );
  };
  const basePriority = (conceptId: string): number => {
    const m = byId.get(conceptId);
    if (m) return m.priorityWeight;
    const w = weightsFor(conceptId);
    return w.topicWeight * w.frequencyWeight;
  };

  // ---- Question cooldown ---------------------------------------------------
  // Serving the same three questions to a weak concept every day teaches the
  // answer key, not the concept — and then last-10 hits 100% and the engine
  // "masters" it. Fresh questions come first; recently-seen ones are only a
  // fallback, least-recently-seen first, so a thin pool still yields a quiz.
  const seenAt = (id: string): number => {
    const iso = seenQuestions[id];
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const isFresh = (q: MockQuestion): boolean => nowMs - seenAt(q.id) >= cooldownMs;

  const orderQuestions = (candidates: MockQuestion[], preferReplicas: boolean): MockQuestion[] => {
    const rank = (q: MockQuestion): number => {
      const freshRank = isFresh(q) ? 0 : 2;
      const replicaRank = preferReplicas ? (q.isReplica ? 0 : 1) : 0;
      return freshRank + replicaRank;
    };
    return [...candidates].sort((a, b) => rank(a) - rank(b) || seenAt(a.id) - seenAt(b.id));
  };

  const byConcept = new Map<string, MockQuestion[]>();
  for (const q of pool) {
    const list = byConcept.get(q.subtopicId);
    if (list) list.push(q);
    else byConcept.set(q.subtopicId, [q]);
  }
  const questionsFor = (d: Demand): MockQuestion[] =>
    orderQuestions(byConcept.get(d.conceptId) ?? [], d.preferReplicas);

  // ---- Queue demands -------------------------------------------------------
  // The queue's `count` is now honoured. Previously it was decorative: a single
  // served question marked every open item for that concept consumed, so
  // "queue 5 replicas" delivered whatever the slice happened to allocate.
  const openQueue = queue
    .filter((i) => !i.consumed && i.served < i.count)
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

  const queueServed: Record<string, number> = {};
  const demandFromQueue = (item: QueueItem): Demand => ({
    conceptId: item.conceptId,
    priorityWeight: item.priority,
    preferReplicas: item.preferReplicas,
    limit: item.count - item.served,
    queueId: item.id,
    reason: item.reason,
  });

  const [weakTarget, revisionTarget, mixedTarget] = allocate(total, [
    config.daily_quiz_weak_topic_pct,
    config.daily_quiz_revision_pct,
    config.daily_quiz_mixed_pct,
  ]);

  const runSlice = (demands: Demand[], count: number): QuizSlot[] => {
    const slots = pickAcrossDemands(demands, count, questionsFor, used);
    for (const d of demands) {
      if (!d.queueId) continue;
      const servedForDemand = slots.filter((s) => s.conceptId === d.conceptId).length;
      if (servedForDemand > 0) {
        queueServed[d.queueId] = (queueServed[d.queueId] ?? 0) + servedForDemand;
      }
    }
    return slots;
  };

  // --- 70% weak: open queue items first, then any remaining weak concepts ---
  const weakQueue = openQueue.filter(
    (i) => i.reason === 'weak_concept' || i.reason === 'replica_reinforcement'
  );
  const queuedConcepts = new Set(weakQueue.map((i) => i.conceptId));
  const weakDemands: Demand[] = [
    ...weakQueue.map(demandFromQueue),
    ...masteries
      .filter((m) => (m.status === 'weak' || m.status === 'very_weak') && !queuedConcepts.has(m.conceptId))
      .map<Demand>((m) => ({
        conceptId: m.conceptId,
        priorityWeight: m.priorityWeight,
        preferReplicas: m.status === 'very_weak',
        limit: Number.MAX_SAFE_INTEGER,
        reason: m.status === 'very_weak' ? 'replica_reinforcement' : 'weak_concept',
      })),
  ].sort((a, b) => b.priorityWeight - a.priorityWeight);

  const weakSlots = runSlice(weakDemands, weakTarget);

  // --- 20% revision: improving concepts + mastered ones with a due review ----
  const revisionDue = (m: ConceptMastery): boolean =>
    m.status === 'mastered' &&
    reviewsDue[m.conceptId] !== undefined &&
    new Date(reviewsDue[m.conceptId]).getTime() <= nowMs;

  const revisionDemands: Demand[] = masteries
    .filter((m) => m.status === 'improving' || revisionDue(m))
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .map((m) => ({
      conceptId: m.conceptId,
      priorityWeight: m.priorityWeight,
      preferReplicas: false,
      limit: Number.MAX_SAFE_INTEGER,
      reason: 'revision' as QueueReason,
    }));

  // Unused weak capacity rolls into revision rather than evaporating.
  const revisionSlots = runSlice(
    revisionDemands,
    revisionTarget + Math.max(0, weakTarget - weakSlots.length)
  );

  // --- 10% mixed: pre-CAT window → old scars (R009); otherwise fresh coverage -
  const mixedCount =
    mixedTarget + Math.max(0, weakTarget + revisionTarget - weakSlots.length - revisionSlots.length);
  const inRevivalWindow = daysToExam !== null && daysToExam <= config.cat_countdown_revival_days;

  let mixedDemands: Demand[];
  if (inRevivalWindow) {
    mixedDemands = masteries
      .filter((m) => m.everWasVeryWeak && (m.status === 'mastered' || m.status === 'improving'))
      .sort((a, b) => b.priorityWeight - a.priorityWeight)
      .map((m) => ({
        conceptId: m.conceptId,
        priorityWeight: m.priorityWeight,
        preferReplicas: false,
        limit: Number.MAX_SAFE_INTEGER,
        reason: 'old_weakness_revival' as QueueReason,
      }));
  } else {
    // Least-practised concepts first, so the coverage slice actually covers.
    mixedDemands = Array.from(byConcept.keys())
      .filter((id) => byId.get(id)?.status !== 'mastered')
      .map((id) => ({ id, attempts: byId.get(id)?.attempts ?? 0, priority: basePriority(id) }))
      .sort((a, b) => a.attempts - b.attempts || b.priority - a.priority)
      .map<Demand>(({ id, priority }) => ({
        conceptId: id,
        priorityWeight: priority,
        preferReplicas: false,
        limit: Number.MAX_SAFE_INTEGER,
        reason: 'balanced_practice',
      }));
  }

  const mixedSlots = runSlice(mixedDemands, mixedCount);

  // --- backfill any shortfall, weakest concepts first ------------------------
  // Mastered concepts are held back to the very last resort: pulling them in
  // freely broke the auto opt-out promise (Doc 5 §4) whenever a pool was thin.
  const slots = [...weakSlots, ...revisionSlots, ...mixedSlots];
  if (slots.length < total) {
    const remaining = pool.filter((q) => !used.has(q.id));
    const rank = (q: MockQuestion): number => {
      const status = byId.get(q.subtopicId)?.status;
      const masteredPenalty = status === 'mastered' ? 100 : 0;
      const stalePenalty = isFresh(q) ? 0 : 10;
      return masteredPenalty + stalePenalty;
    };
    remaining.sort(
      (a, b) => rank(a) - rank(b) || basePriority(b.subtopicId) - basePriority(a.subtopicId)
    );
    for (const q of remaining) {
      if (slots.length >= total) break;
      used.add(q.id);
      slots.push({
        question: q,
        conceptId: q.subtopicId,
        reason: byId.get(q.subtopicId)?.status === 'mastered' ? 'revision' : 'balanced_practice',
      });
    }
  }

  return { slots, queueServed, servedQuestionIds: slots.map((s) => s.question.id) };
};

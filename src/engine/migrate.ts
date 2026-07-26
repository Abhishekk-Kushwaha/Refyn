import { AWE_CONFIG } from './aweConfig';
import {
  AWE_STATE_VERSION,
  AweSnapshot,
  ConceptMastery,
  EngineMeta,
  FlashcardState,
  QueueItem,
} from './types';

// ============================================================
// Persisted-shape migration.
//
// The engine's state is stored as a JSONB blob. Casting it straight back to
// ConceptMastery meant any shape change hydrated malformed objects that failed
// silently deep inside the rules — no version, no validation, no repair. Every
// read now goes through here.
// ============================================================

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const STATUSES = new Set([
  'unattempted',
  'learning',
  'weak',
  'very_weak',
  'improving',
  'mastered',
]);

export const normalizeMastery = (raw: unknown, conceptId: string): ConceptMastery | null => {
  if (!isRecord(raw)) return null;

  const attempts = Math.max(0, Math.round(num(raw.attempts, 0)));
  const correct = Math.min(attempts, Math.max(0, Math.round(num(raw.correct, 0))));
  const incorrect = Math.max(0, attempts - correct);
  const last10 = Array.isArray(raw.last10)
    ? raw.last10.filter((x): x is boolean => typeof x === 'boolean').slice(-10)
    : [];

  const rawStatus = typeof raw.status === 'string' ? raw.status : '';
  // 'old_weakness' existed only in the SQL CHECK constraint, never in the TS union.
  const status = STATUSES.has(rawStatus)
    ? (rawStatus as ConceptMastery['status'])
    : rawStatus === 'old_weakness'
    ? 'mastered'
    : attempts > 0
    ? 'learning'
    : 'unattempted';

  return {
    conceptId: typeof raw.conceptId === 'string' ? raw.conceptId : conceptId,
    conceptName: typeof raw.conceptName === 'string' ? raw.conceptName : conceptId,
    topicName: typeof raw.topicName === 'string' ? raw.topicName : 'General',
    topicWeight: num(raw.topicWeight, 1),
    frequencyWeight: num(raw.frequencyWeight, 1),

    attempts,
    correct,
    incorrect,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : 0,
    consecutiveCorrect: Math.max(0, Math.round(num(raw.consecutiveCorrect, 0))),
    consecutiveIncorrect: Math.max(0, Math.round(num(raw.consecutiveIncorrect, 0))),
    last10,

    // v1 → v2 additions
    skips: Math.max(0, Math.round(num(raw.skips, 0))),
    consecutiveSkips: Math.max(0, Math.round(num(raw.consecutiveSkips, 0))),
    avgTimeRatio: typeof raw.avgTimeRatio === 'number' ? raw.avgTimeRatio : null,
    lastRevisionFailAt: str(raw.lastRevisionFailAt),
    improvingSessions: Math.max(0, Math.round(num(raw.improvingSessions, 0))),

    masteryScore: Math.min(100, Math.max(0, num(raw.masteryScore, 0))),
    weaknessScore: Math.max(0, num(raw.weaknessScore, 0)),
    priorityWeight: Math.max(0, num(raw.priorityWeight, 1)),

    status,
    everWasWeak: bool(raw.everWasWeak),
    everWasVeryWeak: bool(raw.everWasVeryWeak),
    firstWeakAt: str(raw.firstWeakAt),
    resolvedAt: str(raw.resolvedAt),
    timesReopened: Math.max(0, Math.round(num(raw.timesReopened, 0))),
    revisionFails: Math.max(0, Math.round(num(raw.revisionFails, 0))),

    lastAttemptAt: str(raw.lastAttemptAt),
  };
};

export const normalizeCard = (raw: unknown, cardId: string): FlashcardState | null => {
  if (!isRecord(raw)) return null;
  const nextReviewAt = str(raw.nextReviewAt);
  if (!nextReviewAt) return null;

  const mastery = ['new', 'learning', 'reviewing', 'mastered'].includes(String(raw.mastery))
    ? (raw.mastery as FlashcardState['mastery'])
    : 'new';

  return {
    cardId: typeof raw.cardId === 'string' ? raw.cardId : cardId,
    conceptId: typeof raw.conceptId === 'string' ? raw.conceptId : '',
    easeFactor: Math.min(
      AWE_CONFIG.flashcard_ease_max,
      Math.max(AWE_CONFIG.flashcard_ease_min, num(raw.easeFactor, AWE_CONFIG.flashcard_ease_start))
    ),
    intervalDays: Math.max(0, Math.round(num(raw.intervalDays, 0))),
    consecutiveCorrect: Math.max(0, Math.round(num(raw.consecutiveCorrect, 0))),
    reviewCount: Math.max(0, Math.round(num(raw.reviewCount, 0))),
    // v1 → v2 additions. A v1 card that had been reviewed is treated as
    // graduated; an untouched one starts in the learning ladder.
    lapses: Math.max(0, Math.round(num(raw.lapses, 0))),
    learningStep:
      typeof raw.learningStep === 'number'
        ? Math.round(raw.learningStep)
        : mastery === 'new'
        ? 0
        : -1,
    mastery,
    nextReviewAt,
    lastReviewedAt: str(raw.lastReviewedAt),
  };
};

export const normalizeQueueItem = (raw: unknown): QueueItem | null => {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const conceptId = str(raw.conceptId);
  if (!id || !conceptId) return null;

  const count = Math.max(1, Math.round(num(raw.count, 1)));
  // v1 had no `served`; a consumed item is treated as fully served.
  const served =
    typeof raw.served === 'number'
      ? Math.min(count, Math.max(0, Math.round(raw.served)))
      : bool(raw.consumed)
      ? count
      : 0;

  return {
    id,
    conceptId,
    reason: (typeof raw.reason === 'string' ? raw.reason : 'weak_concept') as QueueItem['reason'],
    priority: num(raw.priority, 1),
    preferReplicas: bool(raw.preferReplicas),
    count,
    served,
    consumed: served >= count,
    createdAt: str(raw.createdAt) ?? new Date(0).toISOString(),
  };
};

export const emptyMeta = (): EngineMeta => ({
  examDate: null,
  reviewsDue: {},
  lastDailyTick: null,
  seenQuestions: {},
});

export const normalizeMeta = (raw: unknown): EngineMeta => {
  if (!isRecord(raw)) return emptyMeta();
  const pickIsoMap = (v: unknown): Record<string, string> => {
    if (!isRecord(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
    return out;
  };
  return {
    examDate: str(raw.examDate),
    reviewsDue: pickIsoMap(raw.reviewsDue),
    lastDailyTick: str(raw.lastDailyTick),
    seenQuestions: pickIsoMap(raw.seenQuestions),
  };
};

export const emptySnapshot = (): AweSnapshot => ({
  version: AWE_STATE_VERSION,
  masteries: {},
  queue: [],
  flashcards: {},
  meta: emptyMeta(),
});

/** Coerce anything we read back from storage into a valid, current snapshot. */
export const migrateSnapshot = (raw: unknown): AweSnapshot => {
  if (!isRecord(raw)) return emptySnapshot();

  const masteries: Record<string, ConceptMastery> = {};
  if (isRecord(raw.masteries)) {
    for (const [id, value] of Object.entries(raw.masteries)) {
      const m = normalizeMastery(value, id);
      if (m) masteries[id] = m;
    }
  }

  const flashcards: Record<string, FlashcardState> = {};
  if (isRecord(raw.flashcards)) {
    for (const [id, value] of Object.entries(raw.flashcards)) {
      const c = normalizeCard(value, id);
      if (c) flashcards[id] = c;
    }
  }

  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(normalizeQueueItem).filter((i): i is QueueItem => i !== null)
    : [];

  return {
    version: AWE_STATE_VERSION,
    masteries,
    queue,
    flashcards,
    meta: normalizeMeta(raw.meta),
  };
};

/**
 * The stored schema version, wherever it was written.
 *
 * It lives inside the `meta` blob rather than in a dedicated column so that
 * versioning did not require a migration on a table that is already deployed —
 * a client writing a column the database does not have would have broken
 * persistence outright for every signed-in user.
 */
export const readStoredVersion = (raw: unknown): number => {
  if (!isRecord(raw)) return 0;
  if (typeof raw.version === 'number') return raw.version;
  if (isRecord(raw.meta) && typeof raw.meta.version === 'number') return raw.meta.version;
  return 1; // a blob that exists but carries no version is the original shape
};

/** True when the snapshot holds nothing worth persisting or migrating. */
export const isEmptySnapshot = (s: AweSnapshot): boolean =>
  Object.keys(s.masteries).length === 0 &&
  Object.keys(s.flashcards).length === 0 &&
  s.queue.length === 0 &&
  s.meta.examDate === null;

const laterIso = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
};

/**
 * Field-wise merge of two snapshots for the same (user, exam).
 *
 * The store used to blind-upsert the entire blob, so two tabs — or a phone and
 * a laptop — silently erased each other's whole session. On a write conflict we
 * now re-read and merge instead of clobbering: for each concept and card, keep
 * whichever side has more evidence behind it.
 */
export const mergeSnapshots = (base: AweSnapshot, incoming: AweSnapshot): AweSnapshot => {
  const masteries: Record<string, ConceptMastery> = { ...base.masteries };
  for (const [id, b] of Object.entries(incoming.masteries)) {
    const a = masteries[id];
    if (!a) {
      masteries[id] = b;
      continue;
    }
    const aWork = a.attempts + a.skips;
    const bWork = b.attempts + b.skips;
    const winner = bWork > aWork ? b : aWork > bWork ? a : laterIso(a.lastAttemptAt, b.lastAttemptAt) === b.lastAttemptAt ? b : a;
    masteries[id] = {
      ...winner,
      // Scars are permanent on either side — never merge them away.
      everWasWeak: a.everWasWeak || b.everWasWeak,
      everWasVeryWeak: a.everWasVeryWeak || b.everWasVeryWeak,
      timesReopened: Math.max(a.timesReopened, b.timesReopened),
      firstWeakAt: a.firstWeakAt && b.firstWeakAt ? (a.firstWeakAt < b.firstWeakAt ? a.firstWeakAt : b.firstWeakAt) : a.firstWeakAt ?? b.firstWeakAt,
    };
  }

  const flashcards: Record<string, FlashcardState> = { ...base.flashcards };
  for (const [id, b] of Object.entries(incoming.flashcards)) {
    const a = flashcards[id];
    if (!a) {
      flashcards[id] = b;
      continue;
    }
    flashcards[id] = b.reviewCount > a.reviewCount ? b : a;
  }

  const queueById = new Map(base.queue.map((i) => [i.id, i]));
  for (const item of incoming.queue) {
    const existing = queueById.get(item.id);
    if (!existing) queueById.set(item.id, item);
    else {
      const served = Math.max(existing.served, item.served);
      queueById.set(item.id, { ...existing, served, consumed: served >= existing.count });
    }
  }

  return {
    version: AWE_STATE_VERSION,
    masteries,
    flashcards,
    queue: Array.from(queueById.values()),
    meta: {
      examDate: incoming.meta.examDate ?? base.meta.examDate,
      lastDailyTick: laterIso(base.meta.lastDailyTick, incoming.meta.lastDailyTick),
      reviewsDue: { ...base.meta.reviewsDue, ...incoming.meta.reviewsDue },
      seenQuestions: (() => {
        const out = { ...base.meta.seenQuestions };
        for (const [qid, iso] of Object.entries(incoming.meta.seenQuestions)) {
          out[qid] = laterIso(out[qid] ?? null, iso) ?? iso;
        }
        return out;
      })(),
    },
  };
};

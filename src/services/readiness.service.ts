import { SubtopicWeakness } from './weakness.service';

/**
 * Exam readiness — the one number the Today screen is built around.
 *
 * Defined as frequency-weighted mastery: the mean of each concept's
 * masteryScore, weighted by how much that concept is actually worth in the
 * exam (frequencyWeight × topicWeight). Both weights already ride on every
 * concept, so nothing new is measured — this is a projection, not a new
 * signal.
 *
 * Why weighted rather than a flat mean: mastering Profit & Loss (very_high
 * frequency, Arithmetic) moves a CAT score materially more than mastering
 * Base Systems (low frequency, Number System). A flat mean would rate those
 * identically and tell a learner to spend time in the wrong place — which is
 * the exact failure this whole app exists to prevent.
 *
 * Scope is concepts practised, not the full 126-concept taxonomy. Dividing by
 * everything untouched would peg a new learner near zero for weeks and read as
 * broken rather than early. The consequence is honest but worth stating: this
 * measures how well you know what you have met, not how much of CAT you have
 * met. Breadth is what the section ledger is for.
 */
export const computeReadiness = (subtopics: SubtopicWeakness[]): number => {
  if (subtopics.length === 0) return 0;

  let weighted = 0;
  let totalWeight = 0;
  for (const s of subtopics) {
    // Guard against a zero/missing weight pair silently dropping a concept.
    const weight = (s.frequencyWeight || 1) * (s.topicWeight || 1);
    weighted += s.masteryScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
};

// ============================================================
// Weekly movement
// ============================================================

const LOG_KEY = 'refyn-readiness-log';
/** Enough to answer "this week" with room for gaps. */
const MAX_ENTRIES = 30;

interface Snapshot {
  /** YYYY-MM-DD, local time. */
  d: string;
  v: number;
}

const todayKey = (): string => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const readLog = (): Snapshot[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.d === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Records today's readiness, one entry per day.
 *
 * Readiness history is not stored anywhere — the engine keeps current state
 * only, and sessions carry accuracy rather than mastery. So the delta has to
 * be bootstrapped by sampling: the first day writes a baseline and reports
 * nothing, and the figure becomes real from the second day on. Showing a
 * fabricated "+6" on day one would be worse than showing nothing.
 */
export const recordReadiness = (value: number): void => {
  try {
    const log = readLog();
    const today = todayKey();
    const existing = log.find((s) => s.d === today);
    if (existing) {
      existing.v = value;
    } else {
      log.push({ d: today, v: value });
    }
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch {
    // A full or blocked localStorage costs the delta, never the screen.
  }
};

/**
 * Change in readiness over the last 7 days, or null when there is not yet
 * enough history to say. Null is a real answer here and the UI renders it as
 * absence rather than as zero.
 */
export const getWeeklyDelta = (current: number): number | null => {
  const log = readLog();
  if (log.length === 0) return null;

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const today = todayKey();

  // Oldest sample still inside the window, ignoring today's own entry — the
  // baseline is what readiness looked like *before* this week's work.
  const earlier = log
    .filter((s) => s.d !== today && new Date(`${s.d}T00:00:00`).getTime() >= cutoff)
    .sort((a, b) => a.d.localeCompare(b.d))[0];

  if (!earlier) return null;
  const delta = current - earlier.v;
  return delta === 0 ? null : delta;
};

export const resetReadinessLog = (): void => {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* nothing to clean up */
  }
};

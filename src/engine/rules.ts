import { AweConfig } from './aweConfig';
import { AttemptSignal, ConceptMastery, EngineAction, RuleResult } from './types';
import {
  recomputeScores,
  timeRatioOf,
  updateMasteryScore,
  updateTimeRatio,
  windowAccuracy,
} from './masteryScore';

// ============================================================
// AWE RULES — pure functions (Doc 5 §4, §10). No storage, no I/O:
// (state, event, config) → new state + side-effect intentions.
// This purity is what makes the Phase 1 Edge Function swap a paste.
// ============================================================

const DAY_MS = 1000 * 60 * 60 * 24;
const round1 = (n: number) => Math.round(n * 10) / 10;

const daysBetween = (from: string | null, to: string): number => {
  if (!from) return Infinity;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
  return Number.isFinite(d) ? d : Infinity;
};

export const initConceptMastery = (seed: {
  conceptId: string;
  conceptName: string;
  topicName: string;
  topicWeight: number;
  frequencyWeight: number;
}): ConceptMastery => ({
  ...seed,
  attempts: 0,
  correct: 0,
  incorrect: 0,
  accuracy: 0,
  consecutiveCorrect: 0,
  consecutiveIncorrect: 0,
  last10: [],
  skips: 0,
  consecutiveSkips: 0,
  avgTimeRatio: null,
  masteryScore: 0,
  weaknessScore: 0,
  priorityWeight: seed.topicWeight * seed.frequencyWeight,
  status: 'unattempted',
  everWasWeak: false,
  everWasVeryWeak: false,
  firstWeakAt: null,
  resolvedAt: null,
  timesReopened: 0,
  revisionFails: 0,
  lastRevisionFailAt: null,
  improvingSessions: 0,
  lastAttemptAt: null,
});

/** The full very_weak treatment: replicas, a card burst, and a follow-up check. */
const veryWeakActions = (conceptId: string): EngineAction[] => [
  { type: 'queue_questions', conceptId, count: 5, reason: 'replica_reinforcement', preferReplicas: true },
  { type: 'queue_flashcards', conceptId, count: 3 },
  { type: 'schedule_review', conceptId, daysFromNow: 3 },
];

/** The gentler nudge for a low-value topic or a first stumble. */
const gentleHelpActions = (conceptId: string, questions: number, cards: number): EngineAction[] => [
  { type: 'queue_questions', conceptId, count: questions, reason: 'weak_concept', preferReplicas: false },
  { type: 'queue_flashcards', conceptId, count: cards },
];

/**
 * onAttemptSaved — runs after EVERY answered *or skipped* question (trigger 1 of 3).
 * Handles counters + R002 (gentle first-wrong) + R001 (back-to-back → very_weak).
 */
export const applyAttempt = (
  input: ConceptMastery,
  signal: AttemptSignal,
  now: string,
  config: AweConfig
): RuleResult => {
  const m: ConceptMastery = { ...input, last10: [...input.last10] };
  const actions: EngineAction[] = [];
  const isFirstTouch = m.attempts === 0 && m.skips === 0;

  if (m.status === 'unattempted') m.status = 'learning';
  m.lastAttemptAt = now;

  // ---- A skip is evidence, not an absence of evidence -----------------------
  // It never touches `accuracy` (answered-only, per Doc 5 §3), but it is
  // recorded, it feeds the weakness ranking, and it blocks mastery. Discarding
  // it entirely let a student skip a concept forever and never look weak at it.
  if (signal.skipped) {
    m.skips += 1;
    m.consecutiveSkips += 1;
    m.consecutiveCorrect = 0; // a skip is not a success

    const eligible = m.status === 'learning' || m.status === 'weak' || m.status === 'improving';
    if (
      eligible &&
      m.consecutiveSkips === config.skip_help_threshold &&
      m.topicWeight >= config.high_value_topic_weight
    ) {
      actions.push(...gentleHelpActions(m.conceptId, 2, 1));
    }

    recomputeScores(m, now, config);
    return { mastery: m, actions };
  }

  // ---- Answered ------------------------------------------------------------
  m.consecutiveSkips = 0;
  m.attempts += 1;
  if (signal.isCorrect) {
    m.correct += 1;
    m.consecutiveCorrect += 1;
    m.consecutiveIncorrect = 0;
  } else {
    m.incorrect += 1;
    m.consecutiveIncorrect += 1;
    m.consecutiveCorrect = 0;
  }
  m.accuracy = round1((m.correct / m.attempts) * 100);
  m.last10 = [...m.last10, signal.isCorrect].slice(-10);
  m.avgTimeRatio = updateTimeRatio(m.avgTimeRatio, timeRatioOf(signal));
  m.masteryScore = round1(
    updateMasteryScore(m.masteryScore, signal, windowAccuracy(m.last10), config)
  );

  // first touch: unattempted → learning (R002 base), gentle help if they missed it
  if (isFirstTouch && !signal.isCorrect) {
    actions.push(...gentleHelpActions(m.conceptId, 2, 1));
  }

  // ---- R001 — the "back-to-back" trigger (Doc 5 §4) ------------------------
  // Measured on the ROLLING WINDOW. Gating on lifetime accuracy made the rule
  // unreachable: a student with any decent history is anchored above the
  // threshold, so eight consecutive failures on a concept flagged nothing.
  const eligible = m.status === 'learning' || m.status === 'weak' || m.status === 'improving';
  const recent = windowAccuracy(m.last10);
  const backToBack =
    !signal.isCorrect &&
    eligible &&
    m.consecutiveIncorrect >= config.consecutive_incorrect_trigger &&
    m.attempts >= config.very_weak_min_attempts &&
    m.last10.length >= config.recent_window_min_size &&
    recent < config.very_weak_accuracy_threshold;

  if (backToBack) {
    const wasImproving = m.status === 'improving';
    if (m.topicWeight >= config.high_value_topic_weight) {
      // Arithmetic / Algebra / Geometry — the full very_weak treatment.
      if (m.status !== 'very_weak') {
        m.status = 'very_weak';
        m.everWasWeak = true;
        m.everWasVeryWeak = true; // permanent — the pre-CAT scar (R009 reads this)
        m.improvingSessions = 0;
        if (wasImproving) m.timesReopened += 1;
        if (!m.firstWeakAt) m.firstWeakAt = now;
        actions.push(...veryWeakActions(m.conceptId));
      }
    } else if (m.status !== 'weak') {
      // R001b — a low-value topic still slides to `weak`, just without the full
      // replica burst. Previously it was ignored outright, so a Number System
      // concept could be failed indefinitely and never leave `learning`.
      m.status = 'weak';
      m.everWasWeak = true;
      m.improvingSessions = 0;
      if (wasImproving) m.timesReopened += 1;
      if (!m.firstWeakAt) m.firstWeakAt = now;
      actions.push(...gentleHelpActions(m.conceptId, 3, 1));
    }
  }

  recomputeScores(m, now, config);
  return { mastery: m, actions };
};

/**
 * onSessionCompleted — runs once per concept that appeared in a finished
 * session/quiz (trigger 2 of 3). Handles R003/R004/R005/R006 transitions.
 *
 * `sampleSize` is how many questions on THIS concept the session actually
 * contained. Without it, a blended 10-question quiz spread over five concepts
 * drives every lifecycle decision off n=1 — one lucky guess promoted a
 * very_weak concept out of the weak pool.
 */
export const applyConceptQuizResult = (
  input: ConceptMastery,
  quizAccuracy: number, // this session's accuracy on THIS concept, 0–100
  sampleSize: number,
  now: string,
  config: AweConfig
): RuleResult => {
  const m: ConceptMastery = { ...input, last10: [...input.last10] };
  const actions: EngineAction[] = [];

  const canDemote = sampleSize >= config.min_quiz_sample_demote;
  const canPromote = sampleSize >= config.min_quiz_sample_promote;
  const failed = quizAccuracy < config.weak_quiz_accuracy_threshold;
  const strong = quizAccuracy >= config.improving_quiz_accuracy_threshold;

  const reopen = (cards: number, questions: number) => {
    m.status = 'weak';
    m.everWasWeak = true;
    m.timesReopened += 1;
    m.resolvedAt = null;
    m.revisionFails = 0;
    m.lastRevisionFailAt = null;
    m.improvingSessions = 0;
    if (!m.firstWeakAt) m.firstWeakAt = now;
    actions.push({ type: 'queue_flashcards', conceptId: m.conceptId, count: cards });
    actions.push({
      type: 'queue_questions',
      conceptId: m.conceptId,
      count: questions,
      reason: 'weak_concept',
      preferReplicas: true,
    });
  };

  // ---- R006 — a mastered concept failing its revision ----------------------
  if (m.status === 'mastered') {
    if (canDemote && failed) {
      // "Twice in a row" has to be bounded in time — a fail in January and a
      // fail in June are not a relapse.
      if (daysBetween(m.lastRevisionFailAt, now) > config.revision_fail_window_days) {
        m.revisionFails = 0;
      }
      m.revisionFails += 1;
      m.lastRevisionFailAt = now;
      if (m.revisionFails >= config.revision_fail_reopen_count) reopen(2, 3);
    } else if (strong) {
      m.revisionFails = 0; // clean revision — scar stays quiet
      m.lastRevisionFailAt = null;
    } else if (quizAccuracy >= config.weak_quiz_accuracy_threshold) {
      // The 60–80% band used to neither count nor clear, so a stale fail could
      // sit on the record indefinitely. A passing revision now decays it.
      m.revisionFails = Math.max(0, m.revisionFails - 1);
      if (m.revisionFails === 0) m.lastRevisionFailAt = null;
    }
    recomputeScores(m, now, config);
    return { mastery: m, actions };
  }

  // ---- R003 — learning → weak on a poor concept quiz -----------------------
  if (m.status === 'learning' && canDemote && failed) {
    m.status = 'weak';
    m.everWasWeak = true;
    m.improvingSessions = 0;
    if (!m.firstWeakAt) m.firstWeakAt = now;
    actions.push(...gentleHelpActions(m.conceptId, 3, 1));
    recomputeScores(m, now, config);
    return { mastery: m, actions };
  }

  // ---- R003b — improving → weak. The missing downward edge ------------------
  // Without this, a concept that regressed after being promoted was stuck in
  // `improving` forever: excluded from the 70% weak slice, shown on the
  // dashboard with a positive label, while the student kept failing it.
  if (m.status === 'improving' && canDemote && failed) {
    reopen(1, 3);
    recomputeScores(m, now, config);
    return { mastery: m, actions };
  }

  // ---- R004 — weak/very_weak → improving on a strong concept quiz ----------
  if ((m.status === 'weak' || m.status === 'very_weak') && canPromote && strong) {
    m.status = 'improving';
    m.improvingSessions = 1; // this session is the first of the confirmations
    actions.push({ type: 'schedule_review', conceptId: m.conceptId, daysFromNow: 3 });
    // Deliberately NOT chaining into R005 in the same call: mastery has to
    // survive a second, separate session (Doc 5 §5 — "earned, not luck").
    recomputeScores(m, now, config);
    return { mastery: m, actions };
  }

  // ---- Track sustained form for the mastery bar ----------------------------
  if (m.status === 'improving' || m.status === 'learning') {
    if (canPromote && strong) m.improvingSessions += 1;
    else if (canDemote && failed) m.improvingSessions = 0;
  }

  // ---- R005 — → mastered once the evidence is genuinely there --------------
  // Reachable from `learning` too: a concept the student was always good at
  // could previously never be mastered, because the only route into `improving`
  // was via `weak`. You had to be bad at something first to be recorded as
  // good at it.
  const masteryBar =
    (m.status === 'improving' || m.status === 'learning') &&
    m.attempts >= config.mastered_lookback_attempts &&
    m.last10.length >= config.recent_window_min_size &&
    windowAccuracy(m.last10) >= config.mastered_accuracy_threshold &&
    m.masteryScore >= config.mastered_min_mastery_score &&
    m.improvingSessions >= config.mastery_confirm_sessions &&
    m.consecutiveSkips === 0 &&
    (m.avgTimeRatio === null || m.avgTimeRatio <= config.mastered_max_time_ratio);

  if (masteryBar) {
    m.status = 'mastered'; // auto opt-out: quizBuilder excludes mastered from the weak slice
    m.resolvedAt = now;
    m.revisionFails = 0;
    m.lastRevisionFailAt = null;
    m.improvingSessions = 0;
    // R005b: everWasVeryWeak persists — nothing to do, the flag never clears.
    actions.push({ type: 'schedule_review', conceptId: m.conceptId, daysFromNow: 7 });
  }

  recomputeScores(m, now, config);
  return { mastery: m, actions };
};

/**
 * The flashcard → mastery nudge (Doc 5 §8). Absolute in both directions: an
 * additive bonus paired with a multiplicative penalty is *smaller* than the
 * bonus at low scores, so alternating success/failure on a weak concept
 * inflated its mastery and pushed it down the practice queue.
 *
 * This only moves `masteryScore`, which R005 reads as a *gate* — so revision
 * genuinely contributes to opting a concept out, but can never satisfy the
 * mastery bar on its own.
 */
export const applyFlashcardSignal = (
  input: ConceptMastery,
  recalled: boolean,
  now: string,
  config: AweConfig
): ConceptMastery => {
  const m: ConceptMastery = { ...input, last10: [...input.last10] };
  const delta = recalled ? config.flashcard_mastery_gain : -config.flashcard_mastery_loss;
  m.masteryScore = round1(Math.min(100, Math.max(0, m.masteryScore + delta)));
  recomputeScores(m, now, config);
  return m;
};

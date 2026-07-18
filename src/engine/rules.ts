import { AweConfig } from './aweConfig';
import { ConceptMastery, EngineAction, RuleResult } from './types';
import { last10Accuracy, recomputeScores, updateMasteryScore } from './masteryScore';

// ============================================================
// AWE RULES — pure functions (Doc 5 §4, §10). No storage, no I/O:
// (state, event, config) → new state + side-effect intentions.
// This purity is what makes the Phase 1 Edge Function swap a paste.
// ============================================================

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
  lastAttemptAt: null,
});

/**
 * onAttemptSaved — runs after EVERY answered question (trigger 1 of 3).
 * Handles counters + R002 (gentle first-wrong) + R001 (back-to-back → very_weak).
 */
export const applyAttempt = (
  input: ConceptMastery,
  isCorrect: boolean,
  now: string,
  config: AweConfig
): RuleResult => {
  const m: ConceptMastery = { ...input, last10: [...input.last10] };
  const actions: EngineAction[] = [];
  const isFirstAttempt = m.attempts === 0;

  // raw counters
  m.attempts += 1;
  if (isCorrect) {
    m.correct += 1;
    m.consecutiveCorrect += 1;
    m.consecutiveIncorrect = 0;
  } else {
    m.incorrect += 1;
    m.consecutiveIncorrect += 1;
    m.consecutiveCorrect = 0;
  }
  m.accuracy = Math.round((m.correct / m.attempts) * 1000) / 10;
  m.last10 = [...m.last10, isCorrect].slice(-10);
  m.masteryScore =
    Math.round(updateMasteryScore(m.masteryScore, isCorrect, last10Accuracy(m.last10), config) * 10) / 10;
  m.lastAttemptAt = now;

  // first touch: unattempted → learning (R002 base), gentle help if they missed it
  if (isFirstAttempt) {
    m.status = 'learning';
    if (!isCorrect) {
      actions.push({ type: 'queue_flashcards', conceptId: m.conceptId, count: 1 });
      actions.push({
        type: 'queue_questions',
        conceptId: m.conceptId,
        count: 2,
        reason: 'weak_concept',
        preferReplicas: false,
      });
    }
  }

  // R001 — the "back-to-back" trigger. Only from learning/weak, only on
  // high-value topics (Arithmetic/Algebra/Geometry) — Doc 5 §4.
  const eligible = m.status === 'learning' || m.status === 'weak';
  if (
    !isCorrect &&
    eligible &&
    m.consecutiveIncorrect >= config.consecutive_incorrect_trigger &&
    m.attempts >= config.very_weak_min_attempts &&
    m.accuracy < config.very_weak_accuracy_threshold &&
    m.topicWeight >= config.high_value_topic_weight
  ) {
    m.status = 'very_weak';
    m.everWasWeak = true;
    m.everWasVeryWeak = true; // permanent — the pre-CAT scar (R009 reads this)
    if (!m.firstWeakAt) m.firstWeakAt = now;
    actions.push({
      type: 'queue_questions',
      conceptId: m.conceptId,
      count: 5,
      reason: 'replica_reinforcement',
      preferReplicas: true,
    });
    actions.push({ type: 'queue_flashcards', conceptId: m.conceptId, count: 3 });
    actions.push({ type: 'schedule_review', conceptId: m.conceptId, daysFromNow: 3 });
  }

  recomputeScores(m, now);
  return { mastery: m, actions };
};

/**
 * onSessionCompleted — runs once per concept that appeared in a finished
 * session/quiz (trigger 2 of 3). Handles R003/R004/R005/R006 transitions
 * driven by that session's accuracy on the concept.
 */
export const applyConceptQuizResult = (
  input: ConceptMastery,
  quizAccuracy: number, // this session's accuracy on THIS concept, 0–100
  now: string,
  config: AweConfig
): RuleResult => {
  const m: ConceptMastery = { ...input, last10: [...input.last10] };
  const actions: EngineAction[] = [];

  // R006 — a mastered concept failing its revision. Two consecutive fails reopen it.
  if (m.status === 'mastered') {
    if (quizAccuracy < config.weak_quiz_accuracy_threshold) {
      m.revisionFails += 1;
      if (m.revisionFails >= config.revision_fail_reopen_count) {
        m.status = 'weak';
        m.everWasWeak = true;
        m.timesReopened += 1;
        m.resolvedAt = null;
        m.revisionFails = 0;
        actions.push({ type: 'queue_flashcards', conceptId: m.conceptId, count: 2 });
        actions.push({
          type: 'queue_questions',
          conceptId: m.conceptId,
          count: 3,
          reason: 'weak_concept',
          preferReplicas: true,
        });
      }
    } else if (quizAccuracy >= config.improving_quiz_accuracy_threshold) {
      m.revisionFails = 0; // clean revision — scar stays quiet
    }
    recomputeScores(m, now);
    return { mastery: m, actions };
  }

  // R003 — learning → weak on a poor concept quiz
  if (m.status === 'learning' && quizAccuracy < config.weak_quiz_accuracy_threshold) {
    m.status = 'weak';
    m.everWasWeak = true;
    if (!m.firstWeakAt) m.firstWeakAt = now;
    actions.push({ type: 'queue_flashcards', conceptId: m.conceptId, count: 1 });
    actions.push({
      type: 'queue_questions',
      conceptId: m.conceptId,
      count: 3,
      reason: 'weak_concept',
      preferReplicas: true,
    });
  }

  // R004 — weak/very_weak → improving on a strong concept quiz
  if (
    (m.status === 'weak' || m.status === 'very_weak') &&
    quizAccuracy >= config.improving_quiz_accuracy_threshold
  ) {
    m.status = 'improving';
    actions.push({ type: 'schedule_review', conceptId: m.conceptId, daysFromNow: 3 });
  }

  // R005 — improving → mastered when the last-10 window proves it's real.
  // May chain with R004 in the same session (weak → improving → mastered) when
  // the rolling window already clears the bar — that's genuine, sustained form.
  if (
    m.status === 'improving' &&
    m.attempts >= config.mastered_lookback_attempts &&
    last10Accuracy(m.last10) >= config.mastered_accuracy_threshold
  ) {
    m.status = 'mastered'; // auto opt-out: quizBuilder excludes mastered from the weak slice
    m.resolvedAt = now;
    m.revisionFails = 0;
    // R005b: everWasVeryWeak persists — nothing to do, the flag never clears.
    actions.push({ type: 'schedule_review', conceptId: m.conceptId, daysFromNow: 7 });
  }

  recomputeScores(m, now);
  return { mastery: m, actions };
};

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Button, Icon, Panel } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { useSessionStore } from '@/stores/sessionStore';
import { aweEngine } from '@/engine/engine';
import { Timer, TimerHandle } from './components/Timer';
import { QuestionCard } from './components/QuestionCard';

/** 2m 04s — the outcome badge reads as a duration, not a count. */
const formatElapsed = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
};

export const PracticeSessionView = () => {
  const navigate = useNavigate();
  const timerRef = useRef<TimerHandle>(null);

  const {
    questions,
    currentIndex,
    answers,
    isTimed,
    submitAnswer,
    skipCurrent,
    toggleMark,
    goNext,
    endSession,
  } = useSessionStore();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [titaValue, setTitaValue] = useState('');
  /**
   * The teaching moment. Submitting no longer jumps straight to the next
   * question: the answer surfaces first, and only then does Next advance. A
   * miss you never see explained is a miss you make again.
   */
  const [reveal, setReveal] = useState<{
    given: string | null;
    correct: boolean;
    seconds: number;
  } | null>(null);

  const question = questions[currentIndex];
  const currentAnswer = question ? answers[question.id] : undefined;

  // Reset local input state when moving to a new question
  useEffect(() => {
    setSelectedOption(null);
    setTitaValue('');
    setReveal(null);
    timerRef.current?.reset();
  }, [currentIndex]);

  if (questions.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="No active session"
        description="Start a new practice session from the practice screen."
        action={{ label: 'Go to Practice', onClick: () => navigate('/practice') }}
        className="min-h-screen"
      />
    );
  }

  const hasAnswer = question.questionType === 'mcq' ? !!selectedOption : titaValue.trim().length > 0;
  const isLast = currentIndex + 1 === questions.length;

  const advance = () => {
    const hasNext = goNext();
    if (!hasNext) {
      endSession();
      navigate('/practice/review');
    }
  };

  // Trigger 1 of the AWE (Doc 5 §10) fires here, per question, as it happens.
  // Batching it on the results screen meant a student who closed the tab
  // mid-quiz taught the engine nothing at all, and every attempt in a session
  // landed on one identical timestamp.
  const recordAttempt = (
    recorded: {
      question: typeof question;
      answer: { isCorrect: boolean; skipped: boolean; timeTakenSeconds: number };
    } | null
  ) => {
    if (!recorded) return;
    aweEngine.onAttemptSaved(recorded.question, {
      isCorrect: recorded.answer.isCorrect,
      skipped: recorded.answer.skipped,
      timeTakenSeconds: isTimed ? recorded.answer.timeTakenSeconds : undefined,
    });
  };

  const handleSubmit = () => {
    const elapsed = timerRef.current?.getElapsedSeconds() ?? 0;
    const given = question.questionType === 'mcq' ? selectedOption! : titaValue.trim();
    const recorded = submitAnswer(given, elapsed);
    recordAttempt(recorded);
    // The attempt is already saved — the reveal is presentation only, so
    // closing the tab here still teaches the engine everything it learned.
    setReveal({ given, correct: recorded?.answer.isCorrect ?? false, seconds: elapsed });
  };

  const handleSkip = () => {
    const elapsed = timerRef.current?.getElapsedSeconds() ?? 0;
    recordAttempt(skipCurrent(elapsed));
    advance();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        {/* ---- Session bar --------------------------------------------- */}
        <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-topbar w-full max-w-content items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-12">
            <button
              onClick={() => navigate('/practice')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-body text-[0.8125rem] font-semibold text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <Icon name="arrowLeft" size={16} strokeWidth={2.4} />
              Exit
            </button>

            <span className="font-mono text-[0.8125rem] font-bold tabular-nums tracking-[0.02em]">
              <span className="text-text-primary">Q {currentIndex + 1}</span>
              <span className="text-text-faint"> / {questions.length}</span>
            </span>

            <button
              onClick={toggleMark}
              aria-pressed={!!currentAnswer?.markedForReview}
              aria-label="Mark for review"
              title="Mark for review"
              className={clsx(
                'grid h-[34px] w-[34px] place-items-center rounded-md border transition-colors',
                currentAnswer?.markedForReview
                  ? 'border-warning/30 bg-warning-subtle text-warning'
                  : 'border-border bg-surface-raised text-text-muted hover:border-border-strong hover:text-text-secondary'
              )}
            >
              <Icon name="flag" size={16} strokeWidth={2.2} />
            </button>
          </div>

          {/* Segmented progress. One segment per question, so the bar answers
              "how many left" as well as "how far in" — a continuous rail only
              answers the second. */}
          <div className="mx-auto flex w-full max-w-content gap-1 px-4 pb-3 sm:px-6 lg:px-8 xl:px-12">
            {questions.map((q, i) => {
              const answered = answers[q.id];
              const isCurrent = i === currentIndex;
              return (
                <span
                  key={q.id}
                  className={clsx(
                    'relative h-1 flex-1 overflow-hidden rounded-full',
                    isCurrent
                      ? 'bg-surface-overlay'
                      : answered?.skipped
                      ? 'bg-warning'
                      : answered
                      ? 'bg-accent'
                      : 'bg-surface-overlay'
                  )}
                >
                  {isCurrent && (
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full bg-accent"
                      initial={{ width: '30%' }}
                      animate={{ width: reveal ? '100%' : '60%' }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </header>

        {/* ---- Body ---------------------------------------------------- */}
        <div className="mx-auto flex w-full max-w-content flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:gap-8 xl:px-12">
          <main className="flex min-w-0 flex-1 flex-col">
            <Panel elevation="md" className="flex flex-1 flex-col p-5 lg:p-8">
              {/* Deliberately NOT wrapped in <AnimatePresence mode="wait">.
                  That variant holds the outgoing question mounted until its
                  exit animation reports completion — and when it doesn't, the
                  card silently freezes on the previous question while the
                  store advances behind it. The result was a session that
                  stopped accepting answers a few questions in: the visible
                  card still showed an old MCQ while `question` had already
                  moved on to a TITA item, so Submit stayed disabled forever
                  with no way to recover.

                  A keyed motion.div remounts on every index change, so the
                  rendered question can never disagree with the store. Only the
                  outgoing slide is lost. */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-1 flex-col"
              >
                <QuestionCard
                  question={question}
                  selectedAnswer={selectedOption}
                  onSelectOption={setSelectedOption}
                  titaValue={titaValue}
                  onTitaChange={setTitaValue}
                  reveal={reveal ?? undefined}
                  meta={
                    reveal ? (
                      <span
                        className={clsx(
                          'shrink-0 font-body text-[0.6875rem] font-bold uppercase tracking-[0.08em]',
                          reveal.correct ? 'text-success' : 'text-danger'
                        )}
                      >
                        {reveal.correct ? 'Correct' : 'Missed'}
                        {isTimed && ` · ${formatElapsed(reveal.seconds)}`}
                      </span>
                    ) : isTimed ? (
                      <Timer ref={timerRef} warnAtSeconds={question.expectedTimeSeconds} />
                    ) : null
                  }
                />
              </motion.div>
            </Panel>
          </main>

          {/* ---- Desktop question navigator -------------------------- */}
          <aside className="hidden w-56 shrink-0 xl:block">
            <Panel className="sticky top-24">
              <p className="mb-3.5 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Questions
              </p>

              <ol className="grid grid-cols-5 gap-1.5">
                {questions.map((q, i) => {
                  const answered = answers[q.id];
                  const isCurrent = i === currentIndex;
                  return (
                    <li key={q.id}>
                      <span
                        aria-current={isCurrent ? 'step' : undefined}
                        title={`Question ${i + 1}${
                          answered?.skipped
                            ? ' — skipped'
                            : answered
                            ? ' — answered'
                            : ' — not reached'
                        }`}
                        className={clsx(
                          'grid h-8 w-full place-items-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors',
                          isCurrent
                            ? 'border-accent bg-accent text-accent-text'
                            : answered?.skipped
                            ? 'border-warning/30 bg-warning-subtle text-warning'
                            : answered
                            ? 'border-border-strong bg-surface-raised text-text-secondary'
                            : 'border-border text-text-faint'
                        )}
                      >
                        {i + 1}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <dl className="mt-5 space-y-2 border-t border-border pt-4">
                <NavStat label="Answered" value={Object.values(answers).filter((a) => a && !a.skipped).length} />
                <NavStat label="Skipped" value={Object.values(answers).filter((a) => a?.skipped).length} />
                <NavStat label="Remaining" value={questions.length - currentIndex - 1} />
              </dl>
            </Panel>
          </aside>
        </div>

        {/* ---- Action bar ----------------------------------------------
            Sticks to the bottom of the viewport rather than sitting at the
            end of the card: on a long question the controls were below the
            fold, which is the one place they must never be. */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-surface-glass backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-content gap-2.5 px-4 py-3.5 sm:px-6 lg:px-8 xl:px-12">
            {reveal ? (
              <Button
                size="lg"
                onClick={advance}
                trailingIcon={isLast ? undefined : 'arrowRight'}
                className="flex-1"
              >
                {isLast ? 'Finish session' : 'Next question'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="lg" onClick={handleSkip}>
                  Skip
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!hasAnswer}
                  trailingIcon="arrowRight"
                  className="flex-1"
                >
                  Submit
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NavStat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-baseline justify-between">
    <dt className="font-body text-xs text-text-muted">{label}</dt>
    <dd className="font-mono text-xs font-semibold tabular-nums text-text-secondary">{value}</dd>
  </div>
);

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

  const question = questions[currentIndex];
  const currentAnswer = question ? answers[question.id] : undefined;

  // Reset local input state when moving to a new question
  useEffect(() => {
    setSelectedOption(null);
    setTitaValue('');
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
  const progress = ((currentIndex + 1) / questions.length) * 100;

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
    const answer = question.questionType === 'mcq' ? selectedOption! : titaValue.trim();
    recordAttempt(submitAnswer(answer, elapsed));
    advance();
  };

  const handleSkip = () => {
    const elapsed = timerRef.current?.getElapsedSeconds() ?? 0;
    recordAttempt(skipCurrent(elapsed));
    advance();
  };

  return (
    <div className="relative min-h-screen bg-bg">
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* ---- Session bar --------------------------------------------- */}
        <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-topbar w-full max-w-content items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-12">
            <button
              onClick={() => navigate('/practice')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-body text-[0.8125rem] font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <Icon name="arrowLeft" size={16} />
              Exit
            </button>

            <span className="font-mono text-[0.8125rem] font-semibold tabular-nums text-text-secondary">
              <span className="text-text-primary">{currentIndex + 1}</span>
              <span className="text-text-faint"> / {questions.length}</span>
            </span>

            <div className="flex items-center gap-2">
              {isTimed && <Timer ref={timerRef} warnAtSeconds={question.expectedTimeSeconds} />}

              <button
                onClick={toggleMark}
                aria-pressed={!!currentAnswer?.markedForReview}
                aria-label="Mark for review"
                title="Mark for review"
                className={clsx(
                  'grid h-9 w-9 place-items-center rounded-lg border transition-colors',
                  currentAnswer?.markedForReview
                    ? 'border-warning/30 bg-warning-subtle text-warning'
                    : 'border-border text-text-faint hover:border-border-strong hover:text-text-secondary'
                )}
              >
                <Icon name="flag" size={16} />
              </button>
            </div>
          </div>

          {/* Progress rail sits on the bar's bottom edge — always visible,
              costs no vertical space of its own. */}
          <div className="h-0.5 w-full bg-border">
            <motion.div
              className="h-full bg-gradient-accent"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
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
                />
              </motion.div>

              {/* Actions */}
              <div className="mt-8 flex gap-2.5 border-t border-border pt-5">
                <Button variant="ghost" size="lg" onClick={handleSkip}>
                  Skip
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!hasAnswer}
                  trailingIcon={isLast ? undefined : 'arrowRight'}
                  className="flex-1"
                >
                  {isLast ? 'Finish session' : 'Submit & next'}
                </Button>
              </div>
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

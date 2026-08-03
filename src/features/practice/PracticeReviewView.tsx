import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Button, Panel, PanelHeader, StatCard } from '@/components/ui';
import { Page, PageGrid, Section } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { useSessionStore } from '@/stores/sessionStore';
import { persistSession, AttemptRecord } from '@/services/sessions.service';
import { aweEngine } from '@/engine/engine';
import { SolutionCard } from './components/SolutionCard';

interface TopicBreakdown {
  topicName: string;
  correct: number;
  total: number;
}

export const PracticeReviewView = () => {
  const navigate = useNavigate();
  const { questions, answers, mode, resetSession } = useSessionStore();
  // A ref (not state) so StrictMode's synchronous double-invoke of this effect in dev
  // sees the guard immediately — a state-based guard updates only after the async
  // saveSession() resolves, so both invocations would race past it and double-save.
  const hasSavedRef = useRef(false);
  const [solutionFilter, setSolutionFilter] = useState<'all' | 'mistakes'>('all');

  const stats = useMemo(() => {
    const total = questions.length;
    const answerList = questions.map((q) => answers[q.id]);
    const correctCount = answerList.filter((a) => a?.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const totalTime = answerList.reduce((sum, a) => sum + (a?.timeTakenSeconds ?? 0), 0);
    const avgTime = total > 0 ? Math.round(totalTime / total) : 0;

    const byTopic = new Map<string, TopicBreakdown>();
    questions.forEach((q) => {
      const entry = byTopic.get(q.subtopicName) ?? { topicName: q.subtopicName, correct: 0, total: 0 };
      entry.total += 1;
      if (answers[q.id]?.isCorrect) entry.correct += 1;
      byTopic.set(q.subtopicName, entry);
    });

    return {
      total,
      correctCount,
      accuracy,
      avgTime,
      topics: Array.from(byTopic.values()),
    };
  }, [questions, answers]);

  // Keep the original question order (index = the number shown during the quiz)
  // so filtering to mistakes doesn't renumber the cards.
  const solutionRows = useMemo(
    () => questions.map((question, index) => ({ question, index })),
    [questions]
  );
  const mistakeCount = useMemo(
    () => questions.filter((q) => !answers[q.id]?.isCorrect).length,
    [questions, answers]
  );
  const visibleSolutions =
    solutionFilter === 'all'
      ? solutionRows
      : solutionRows.filter(({ question }) => !answers[question.id]?.isCorrect);

  useEffect(() => {
    if (stats.total === 0 || hasSavedRef.current) return;
    hasSavedRef.current = true;

    // Persist per-question attempts (answered only — skips carry no concept signal)
    // so history has real data. Session + attempts are written together (linked).
    const now = new Date().toISOString();
    const answered = questions
      .map((q) => ({ q, answer: answers[q.id] }))
      .filter(({ answer }) => answer && !answer.skipped && answer.selectedAnswer !== null);

    const attempts: AttemptRecord[] = answered.map(({ q, answer }) => ({
      questionId: q.id,
      subtopicId: q.subtopicId,
      subtopicName: q.subtopicName,
      topicName: q.topicName,
      isCorrect: answer!.isCorrect,
      timeTakenSeconds: answer!.timeTakenSeconds,
      attemptedAt: now,
      // replicas attribute their DB attempt to the parent question row
      dbQuestionId: q.isReplica ? q.parentQuestionId : q.id,
    }));

    persistSession(
      {
        mode,
        totalQuestions: stats.total,
        correctCount: stats.correctCount,
        accuracy: stats.accuracy,
        avgTimeSeconds: stats.avgTime,
      },
      attempts
    );

    // AWE trigger 2 (Doc 5 §10). Trigger 1 (R001/R002) already fired per
    // question inside the session, so only the session-level transitions
    // (R003–R006) run here — replaying attempts would double-count them.
    // Skips are passed through: the engine records them as evidence, and they
    // never count toward the per-concept sample size.
    aweEngine.onSessionCompleted(
      questions
        .map((q) => ({ q, answer: answers[q.id] }))
        .filter(({ answer }) => answer)
        .map(({ q, answer }) => ({
          question: q,
          isCorrect: answer!.isCorrect,
          skipped: answer!.skipped,
        })),
      now
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.total]);

  if (stats.total === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No session to review"
        description="Complete a practice session to see your results here."
        action={{ label: 'Start Practicing', onClick: () => navigate('/practice') }}
        className="min-h-screen"
      />
    );
  }

  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference - (stats.accuracy / 100) * circumference;

  const handleDone = (destination: '/dashboard' | '/practice') => {
    resetSession();
    navigate(destination);
  };

  const verdict =
    stats.accuracy >= 85
      ? 'Sharp session'
      : stats.accuracy >= 70
      ? 'Well done'
      : stats.accuracy >= 45
      ? 'Solid effort'
      : 'Plenty to hunt';

  return (
    <div className="relative min-h-screen bg-bg">
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      <div className="relative z-10">
        <Page width="wide">
          {/* ---- Hero: ring + headline + numbers ---------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <Panel elevation="lg" tone="accent" className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-accent-soft"
                aria-hidden="true"
              />

              <div className="relative flex flex-col items-center gap-7 lg:flex-row lg:gap-10">
                {/* Accuracy ring */}
                <div className="relative h-36 w-36 shrink-0 lg:h-40 lg:w-40">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <defs>
                      {/* Indigo→cyan, not indigo→violet: this ring is a
                          reading of the session, and cyan is the data hue. */}
                      <linearGradient id="ring-fill" x1="0" y1="0" x2="120" y2="120">
                        <stop stopColor="var(--indigo-500)" />
                        <stop offset="1" stopColor="var(--cyan-400)" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="9"
                    />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="url(#ring-fill)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: strokeOffset }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                      style={{ filter: 'drop-shadow(0 0 8px var(--radar-glow))' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-[2.5rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
                      {stats.accuracy}
                      <span className="text-lg text-text-muted">%</span>
                    </span>
                    <span className="mt-0.5 font-body text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                      Accuracy
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-center lg:text-left">
                  <p className="mb-2 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-accent">
                    Session complete
                  </p>
                  <h1 className="font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-text-primary lg:text-[2.5rem]">
                    {verdict}
                  </h1>
                  <p className="mt-3 font-body text-[0.9375rem] text-text-secondary">
                    {stats.correctCount} of {stats.total} correct across {stats.topics.length}{' '}
                    {stats.topics.length === 1 ? 'concept' : 'concepts'}. Every attempt has been fed
                    back into your weakness profile.
                  </p>

                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center lg:justify-start">
                    <Button size="lg" icon="practice" onClick={() => handleDone('/practice')}>
                      Practice again
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      icon="dashboard"
                      onClick={() => handleDone('/dashboard')}
                    >
                      Back to dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          </motion.div>

          {/* ---- Numbers ---------------------------------------------- */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            <StatCard
              label="Correct"
              value={`${stats.correctCount}/${stats.total}`}
              icon="check"
              tone={stats.accuracy >= 70 ? 'success' : 'default'}
            />
            <StatCard
              label="Mistakes"
              value={mistakeCount}
              icon="alert"
              tone={mistakeCount > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Avg / question"
              value={`${Math.floor(stats.avgTime / 60)}m ${stats.avgTime % 60}s`}
              icon="clock"
            />
            <StatCard label="Concepts" value={stats.topics.length} icon="layers" />
          </div>

          {/* ---- Breakdown + solutions --------------------------------- */}
          <PageGrid className="items-start">
            <div className="lg:col-span-4">
              <Panel className="lg:sticky lg:top-8">
                <PanelHeader icon="trend" title="By concept" />
                {/* One bordered row per concept, banded on the left edge. A
                    session covers a handful of concepts, so the ranking reads
                    off the edge colour and the figure — a bar chart here was
                    three bars pretending to be a distribution. */}
                <div className="flex flex-col gap-2">
                  {stats.topics.map((topic, i) => {
                    const pct = Math.round((topic.correct / topic.total) * 100);
                    const edge =
                      pct >= 70
                        ? 'border-l-success'
                        : pct >= 40
                        ? 'border-l-accent'
                        : 'border-l-danger';
                    const text =
                      pct >= 70 ? 'text-success' : pct >= 40 ? 'text-accent' : 'text-danger';

                    return (
                      <motion.div
                        key={topic.topicName}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded-xl border border-l-[3px] border-border bg-surface-raised px-3.5 py-3',
                          edge
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-heading text-[0.84375rem] font-semibold text-text-primary">
                            {topic.topicName}
                          </div>
                          <div className="mt-0.5 font-mono text-[0.6875rem] tabular-nums text-text-muted">
                            {topic.correct}/{topic.total} correct
                          </div>
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 font-mono text-[0.9375rem] font-bold tabular-nums',
                            text
                          )}
                        >
                          {pct}%
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* Solutions — per-question review of what was right, wrong or skipped */}
            <div className="lg:col-span-8">
              <Section
                title="Solutions"
                aside={
                  <span className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                    {(['all', 'mistakes'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSolutionFilter(filter)}
                        className={clsx(
                          'rounded-md px-3 py-1.5 font-body text-[0.6875rem] font-semibold uppercase tracking-[0.08em] transition-colors',
                          solutionFilter === filter
                            ? 'bg-accent text-accent-text'
                            : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        {filter === 'all' ? `All ${stats.total}` : `Mistakes ${mistakeCount}`}
                      </button>
                    ))}
                  </span>
                }
              >
                {visibleSolutions.length === 0 ? (
                  <Panel className="text-center">
                    <p className="font-body text-sm text-text-muted">
                      No mistakes in this session — clean sweep.
                    </p>
                  </Panel>
                ) : (
                  <div className="space-y-2.5">
                    {visibleSolutions.map(({ question, index }) => (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <SolutionCard
                          question={question}
                          answer={answers[question.id]}
                          index={index}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </PageGrid>
        </Page>
      </div>
    </div>
  );
};

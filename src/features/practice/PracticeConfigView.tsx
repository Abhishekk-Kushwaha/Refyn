import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Button, Icon, Panel, PanelHeader } from '@/components/ui';
import { Page, PageHeader, PageGrid, Section } from '@/components/layout';
import { ErrorState, useToast } from '@/components/feedback';
import { getQuestionsForPractice, PracticeConfig } from '@/services/questions.service';
import { getPool } from '@/services/questionPool';
import { useSessionStore } from '@/stores/sessionStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import { aweEngine } from '@/engine/engine';
import type { IconName } from '@/components/ui';

type Mode = 'daily' | 'mock' | 'topic';

const modeOptions: {
  id: Mode;
  label: string;
  description: string;
  meta: string[];
  icon: IconName;
}[] = [
  {
    id: 'daily',
    label: 'Smart Quiz',
    description: 'Adaptive blend of weak concepts, revision, and fresh material.',
    meta: ['Adaptive', '70/20/10'],
    icon: 'spark',
  },
  {
    id: 'mock',
    label: 'Mixed Practice',
    description: 'Random questions sampled evenly across all topics.',
    meta: ['Balanced', 'Random'],
    icon: 'layers',
  },
  {
    id: 'topic',
    label: 'Topic Drill',
    description: 'Focus deeply on one specific topic until confident.',
    meta: ['Focused', 'Custom'],
    icon: 'practice',
  },
];

const questionCounts = [5, 10, 15, 20];

export const PracticeConfigView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const startSession = useSessionStore((state) => state.startSession);
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';

  // Topics available in the live pool (real DB topics when signed in, mocks in demo).
  const topicNames = useMemo(
    () => Array.from(new Set(getPool().map((q) => q.topicName))).sort(),
    []
  );

  const [mode, setMode] = useState<Mode>('daily');
  const [questionCount, setQuestionCount] = useState(10);
  const [isTimed, setIsTimed] = useState(true);
  const [topicFilter, setTopicFilter] = useState<string>(topicNames[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = modeOptions.find((m) => m.id === mode)!;

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'daily') {
        // AWE-composed blend (70/20/10). Falls back to balanced coverage when
        // the engine has no weak data yet — always returns a runnable quiz.
        const questions = aweEngine.buildDailyQuiz(getPool(), questionCount);
        if (questions.length === 0) {
          throw new Error('No questions available yet. Try again.');
        }
        startSession(questions, 'weakness', isTimed);
      } else {
        const config: PracticeConfig = {
          mode,
          questionCount,
          isTimed,
          topicFilter: mode === 'topic' ? topicFilter : undefined,
        };
        const questions = await getQuestionsForPractice(examId, config);
        startSession(questions, mode, isTimed);
      }
      navigate('/practice/session');
    } catch (e) {
      setError(getErrorMessage(e));
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={() => setError(null)} className="min-h-screen" />;
  }

  // Rough pacing estimate, so the summary says something the mode cards don't.
  const estimatedMinutes = Math.max(1, Math.round((questionCount * 90) / 60));

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Configure"
        title="Start practice"
        description="Pick a mode, set the length, and the engine composes the set."
      />

      <PageGrid className="items-start">
        {/* ---- Configuration column ------------------------------------ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-8 lg:col-span-7 xl:col-span-8"
        >
          <Section title="Practice mode">
            {/* Modes were a vertical stack of full-width cards. On desktop
                they read as three peers side by side. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {modeOptions.map((opt) => {
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    aria-pressed={active}
                    className={clsx(
                      'group relative flex flex-col overflow-hidden rounded-xl border p-4 text-left lg:p-5',
                      'transition-[border-color,background,transform,box-shadow] duration-200 ease-out-expo',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      active
                        ? 'border-accent bg-accent-subtle shadow-glow-soft'
                        : 'border-border bg-surface hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md'
                    )}
                  >
                    <span
                      className={clsx(
                        'mb-3.5 grid h-9 w-9 place-items-center rounded-lg transition-colors',
                        active
                          ? 'bg-gradient-accent text-accent-text'
                          : 'bg-surface-raised text-text-muted group-hover:text-text-secondary'
                      )}
                    >
                      <Icon name={opt.icon} size={17} strokeWidth={2.25} />
                    </span>

                    <span className="font-heading text-base font-semibold tracking-[-0.015em] text-text-primary">
                      {opt.label}
                    </span>

                    <span className="mt-1.5 flex-1 font-body text-[0.8125rem] leading-relaxed text-text-secondary">
                      {opt.description}
                    </span>

                    <span className="mt-3.5 flex flex-wrap gap-1.5">
                      {opt.meta.map((m) => (
                        <span
                          key={m}
                          className={clsx(
                            'rounded-md px-2 py-1 font-body text-[0.625rem] font-bold uppercase tracking-[0.1em]',
                            active
                              ? 'bg-accent-muted text-accent'
                              : 'bg-surface-raised text-text-faint'
                          )}
                        >
                          {m}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Topic picker (only in topic mode) */}
          {mode === 'topic' && (
            <Section title="Select topic">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {topicNames.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setTopicFilter(topic)}
                    aria-pressed={topicFilter === topic}
                    className={clsx(
                      'rounded-lg border px-3 py-2.5 text-center font-body text-[0.8125rem] font-medium transition-colors',
                      topicFilter === topic
                        ? 'border-accent bg-accent text-accent-text'
                        : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Number of questions">
            <div className="grid grid-cols-4 gap-2 sm:max-w-md">
              {questionCounts.map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  aria-pressed={questionCount === count}
                  className={clsx(
                    'rounded-lg border py-3 font-body text-sm font-bold tabular-nums transition-colors',
                    questionCount === count
                      ? 'border-accent bg-accent text-accent-text'
                      : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Options">
            <button
              onClick={() => setIsTimed(!isTimed)}
              role="switch"
              aria-checked={isTimed}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong sm:max-w-md"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-raised text-text-muted">
                  <Icon name="clock" size={17} />
                </span>
                <span>
                  <span className="block font-body text-sm font-semibold text-text-primary">
                    Timed session
                  </span>
                  <span className="block font-body text-xs text-text-muted">
                    Track time per question
                  </span>
                </span>
              </span>

              <span
                className={clsx(
                  'flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors',
                  isTimed ? 'justify-end bg-accent' : 'justify-start bg-border-strong'
                )}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  className="h-5 w-5 rounded-full bg-white shadow-sm"
                />
              </span>
            </button>
          </Section>
        </motion.div>

        {/* ---- Sticky launch panel ------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06 }}
          className="lg:sticky lg:top-8 lg:col-span-5 xl:col-span-4"
        >
          <Panel glass elevation="lg" tone="accent">
            <PanelHeader icon="bolt" title="Session summary" />

            <dl className="space-y-3.5">
              <SummaryRow label="Mode" value={selectedMode.label} />
              {mode === 'topic' && <SummaryRow label="Topic" value={topicFilter || '—'} />}
              <SummaryRow label="Questions" value={String(questionCount)} />
              <SummaryRow label="Timing" value={isTimed ? 'Timed' : 'Untimed'} />
              <SummaryRow label="Est. length" value={`~${estimatedMinutes} min`} />
            </dl>

            <p className="mt-5 border-t border-border pt-4 font-body text-xs leading-relaxed text-text-faint">
              {selectedMode.description}
            </p>

            <Button
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleStart}
              trailingIcon={loading ? undefined : 'arrowRight'}
              className="mt-5"
            >
              {loading ? 'Starting…' : 'Start session'}
            </Button>
          </Panel>
        </motion.div>
      </PageGrid>
    </Page>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="font-body text-[0.8125rem] text-text-muted">{label}</dt>
    <dd className="truncate font-body text-[0.8125rem] font-semibold text-text-primary">{value}</dd>
  </div>
);

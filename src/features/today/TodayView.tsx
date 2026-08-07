import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Icon, SkeletonCard } from '@/components/ui';
import { Page } from '@/components/layout';
import { ErrorState, EmptyState, useToast } from '@/components/feedback';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { useExamStore } from '@/stores/examStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { getQuestionsForSubtopic } from '@/services/questions.service';
import { computeReadiness, getWeeklyDelta, recordReadiness } from '@/services/readiness.service';
import { getStreak } from '@/services/streak.service';
import { aweEngine } from '@/engine/engine';

const RADIUS = 112;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Today — design 1b, "Readiness".
 *
 * The quiet-luxury direction from the explorations doc: one number that
 * matters, vast calm space, a single tactile action. It is deliberately the
 * opposite of the dashboard, which is an instrument panel — this screen
 * answers "should I be worried, and what do I do in the next ten minutes",
 * and nothing else. Everything that ranks, drills down or compares lives one
 * tab away.
 */
export const TodayView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWeaknessScores();

  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';
  const startSession = useSessionStore((state) => state.startSession);
  const [starting, setStarting] = useState(false);

  const readiness = useMemo(
    () => (data ? computeReadiness(data.subtopics) : 0),
    [data]
  );

  // Sampled on view, once a day. The delta is read *before* recording, so
  // today's own value can never become its own baseline.
  const delta = useMemo(() => {
    if (!data || data.totalAttempts === 0) return null;
    const measured = getWeeklyDelta(readiness);
    recordReadiness(readiness);
    return measured;
  }, [data, readiness]);

  const streak = useMemo(() => getStreak(), []);
  // The engine already owns the exam date — it drives the pre-CAT revival
  // window in quizBuilder, and Profile already edits it. Reading it here keeps
  // one source of truth rather than a second copy that can drift.
  const rawDaysOut = aweEngine.daysToExam();
  const daysOut = rawDaysOut !== null && rawDaysOut >= 0 ? rawDaysOut : null;
  const weakest = data?.subtopics[0];

  const overallAccuracy = useMemo(() => {
    if (!data) return 0;
    const attempted = data.subtopics.reduce((sum, s) => sum + s.attempts, 0);
    if (attempted === 0) return 0;
    return Math.round(
      data.subtopics.reduce((sum, s) => sum + s.accuracy * s.attempts, 0) / attempted
    );
  }, [data]);

  const handleStart = async () => {
    if (!weakest) return;
    setStarting(true);
    try {
      const questions = await getQuestionsForSubtopic(
        examId,
        weakest.subtopicId,
        5,
        weakest.subtopicName
      );
      startSession(questions, 'weakness', true);
      navigate('/practice/session');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return (
      <Page width="reading">
        <SkeletonCard />
      </Page>
    );
  }

  if (error) {
    return (
      <Page width="reading">
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </Page>
    );
  }

  if (!data || data.totalAttempts === 0) {
    return (
      <Page width="reading">
        <EmptyState
          icon="🎯"
          title="No readiness yet"
          description="Readiness is measured from what you've actually answered. Finish one session and this screen starts tracking it."
          action={{ label: 'Start practising', onClick: () => navigate('/practice') }}
        />
      </Page>
    );
  }

  return (
    <Page width="reading" className="flex flex-col">
      {/* Exam context. The only chrome on the screen. */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <span className="font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-text-primary">
          Refyn
        </span>
        <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {examId.toUpperCase()}
          {daysOut !== null
            ? ` · ${daysOut} day${daysOut === 1 ? '' : 's'} out`
            : ''}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <p className="mb-6 font-body text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-text-muted">
            Exam readiness
          </p>

          <div className="relative mx-auto aspect-square w-full max-w-[250px]">
            <svg viewBox="0 0 250 250" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="readiness-ring" x1="0" y1="0" x2="250" y2="250" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent)" />
                  <stop offset="1" stopColor="var(--accent-2)" />
                </linearGradient>
              </defs>
              <circle
                cx="125"
                cy="125"
                r={RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth="6"
              />
              <motion.circle
                cx="125"
                cy="125"
                r={RADIUS}
                fill="none"
                stroke="url(#readiness-ring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - readiness / 100) }}
                transition={{ duration: 1.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ filter: 'drop-shadow(0 0 10px var(--radar-glow))' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-[3.5rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-text-primary sm:text-[4.25rem]">
                {readiness}
                <span className="text-[1.625rem] text-text-muted">%</span>
              </span>

              {/* Only rendered once a week of history exists. A "+0" or a
                  fabricated figure on day one would be worse than silence. */}
              {delta !== null && (
                <span
                  className={`mt-2 flex items-center gap-1.5 font-body text-xs font-semibold ${
                    delta > 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  <Icon
                    name="trend"
                    size={14}
                    strokeWidth={2.6}
                    className={delta > 0 ? '' : 'rotate-180'}
                  />
                  {delta > 0 ? '+' : ''}
                  {delta} this week
                </span>
              )}
            </div>
          </div>

          {weakest && (
            <p className="mx-auto mt-7 max-w-[280px] font-body text-sm leading-relaxed text-text-secondary">
              Your weakest link is{' '}
              <b className="font-semibold text-text-primary">{weakest.subtopicName}</b>. Clear it
              and readiness jumps most.
            </p>
          )}

          <Button
            size="lg"
            fullWidth
            trailingIcon="arrowRight"
            loading={starting}
            onClick={handleStart}
            disabled={!weakest}
            className="mt-6 h-[3.375rem]"
          >
            Start today&rsquo;s hunt
          </Button>
        </motion.div>

        {/* The supporting figures, set as a quiet list rather than tiles —
            they are context for the ring, not competitors to it. */}
        <dl className="mt-8 border-t border-border">
          <StatRow label="Day streak" value={streak === 0 ? '—' : String(streak)} />
          <StatRow label="Questions attempted" value={data.totalAttempts.toLocaleString()} />
          <StatRow label="Overall accuracy" value={`${overallAccuracy}%`} last />
        </dl>

        {/* Shown only until a date exists, then it stops nagging. */}
        {daysOut === null && (
          <button
            onClick={() => navigate('/profile')}
            className="mt-5 self-center font-body text-xs text-text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text-primary"
          >
            Set your exam date to see the countdown
          </button>
        )}
      </div>
    </Page>
  );
};

const StatRow = ({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) => (
  <div
    className={`flex items-center justify-between py-4 ${last ? '' : 'border-b border-border'}`}
  >
    <dt className="font-body text-[0.8125rem] text-text-secondary">{label}</dt>
    <dd className="font-mono text-[0.9375rem] font-semibold tabular-nums text-text-primary">
      {value}
    </dd>
  </div>
);

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Display, Eyebrow, ModeCard } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useToast } from '@/components/feedback';
import { getQuestionsForPractice, PracticeConfig } from '@/services/questions.service';
import { getPool } from '@/services/questionPool';
import { useSessionStore } from '@/stores/sessionStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import { aweEngine } from '@/engine/engine';
import clsx from 'clsx';

type Mode = 'daily' | 'mock' | 'topic';

const modeOptions: { id: Mode; label: string; description: string; meta: string[] }[] = [
  {
    id: 'daily',
    label: 'Smart Quiz',
    description: 'Adaptive blend of weak concepts, revision, and fresh material.',
    meta: ['Adaptive', '70/20/10'],
  },
  {
    id: 'mock',
    label: 'Mixed Practice',
    description: 'Random questions sampled evenly across all topics.',
    meta: ['Balanced', 'Random'],
  },
  {
    id: 'topic',
    label: 'Topic Drill',
    description: 'Focus deeply on one specific topic until confident.',
    meta: ['Focused', 'Custom'],
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

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <Eyebrow className="mb-2 text-accent">Configure</Eyebrow>
          <Display size="lg">Start practice</Display>
          <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">
            Pick a mode, set your preferences, and dive in.
          </p>
        </div>

        {/* Mode selection using ModeCard */}
        <section className="mb-8">
          <Eyebrow className="mb-3 text-text-muted">Practice mode</Eyebrow>
          <div className="space-y-3">
            {modeOptions.map((opt) => (
              <ModeCard
                key={opt.id}
                title={opt.label}
                description={opt.description}
                meta={opt.meta}
                tone={mode === opt.id ? 'accent' : undefined}
                onClick={() => setMode(opt.id)}
              />
            ))}
          </div>
        </section>

        {/* Topic picker (only in topic mode) */}
        {mode === 'topic' && (
          <section className="mb-8">
            <Eyebrow className="mb-3 text-text-muted">Select topic</Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              {topicNames.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setTopicFilter(topic)}
                  className={clsx(
                    'rounded-lg border transition-all py-2.5 px-3 text-center font-body text-sm font-medium',
                    topicFilter === topic
                      ? 'border-accent bg-accent text-accent-text'
                      : 'border-border text-text-secondary hover:border-border-strong'
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Question count */}
        <section className="mb-8">
          <Eyebrow className="mb-3 text-text-muted">Number of questions</Eyebrow>
          <div className="flex gap-2">
            {questionCounts.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={clsx(
                  'flex-1 py-2.5 rounded-lg border font-body font-semibold text-sm transition-all',
                  questionCount === count
                    ? 'border-accent bg-accent text-accent-text'
                    : 'border-border text-text-secondary hover:border-border-strong'
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </section>

        {/* Timed toggle */}
        <section className="mb-10">
          <button
            onClick={() => setIsTimed(!isTimed)}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
          >
            <div className="text-left">
              <div className="font-body font-semibold text-text-primary">Timed Session</div>
              <div className="font-body text-xs text-text-muted">Track time per question</div>
            </div>
            <div
              className={clsx(
                'flex h-7 w-12 items-center rounded-full px-1 transition-colors',
                isTimed ? 'justify-end bg-accent' : 'justify-start bg-border'
              )}
            >
              <motion.div layout className="h-5 w-5 rounded-full bg-white shadow-md" />
            </div>
          </button>
        </section>

        {/* Start button */}
        <Button size="lg" fullWidth loading={loading} onClick={handleStart}>
          {loading ? 'Starting…' : `Start · ${questionCount} questions`}
        </Button>
      </motion.div>
    </div>
  );
};

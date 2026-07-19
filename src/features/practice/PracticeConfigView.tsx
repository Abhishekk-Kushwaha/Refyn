import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
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

const modeOptions: { id: Mode; label: string; description: string; icon: string }[] = [
  {
    id: 'daily',
    label: 'Daily Smart Quiz',
    description: 'AWE blend: 70% your weak concepts · 20% revision · 10% mixed',
    icon: '🧠',
  },
  { id: 'mock', label: 'Mixed Practice', description: 'Random questions across all topics', icon: '🎲' },
  { id: 'topic', label: 'Pick a Topic', description: 'Focus on one specific topic', icon: '📂' },
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
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-text-primary mb-1">Start Practice</h1>
        <p className="text-text-muted mb-8">Configure your session and dive in</p>

        {/* Mode selection */}
        <div className="mb-8">
          <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
            Practice Mode
          </h4>
          <div className="space-y-3">
            {modeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={clsx(
                  'w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3',
                  mode === opt.id
                    ? 'bg-accent-subtle border-accent'
                    : 'border-border hover:border-border-strong'
                )}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <div
                    className={clsx(
                      'font-semibold',
                      mode === opt.id ? 'text-accent' : 'text-text-primary'
                    )}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-text-muted">{opt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic picker (only in topic mode) */}
        {mode === 'topic' && (
          <div className="mb-8">
            <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
              Topic
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {topicNames.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setTopicFilter(topic)}
                  className={clsx(
                    'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                    topicFilter === topic
                      ? 'bg-accent-subtle border-accent text-accent'
                      : 'border-border text-text-secondary hover:border-border-strong'
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question count */}
        <div className="mb-8">
          <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
            Number of Questions
          </h4>
          <div className="flex gap-2">
            {questionCounts.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={clsx(
                  'flex-1 py-3 rounded-lg border-2 font-semibold transition-all',
                  questionCount === count
                    ? 'bg-accent-subtle border-accent text-accent'
                    : 'border-border text-text-secondary hover:border-border-strong'
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Timed toggle */}
        <div className="mb-10">
          <button
            onClick={() => setIsTimed(!isTimed)}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-surface border border-border"
          >
            <div className="text-left">
              <div className="font-semibold text-text-primary">Timed Session</div>
              <div className="text-xs text-text-muted">Track time per question</div>
            </div>
            <div
              className={clsx(
                'w-12 h-7 rounded-full flex items-center px-1 transition-colors',
                isTimed ? 'bg-accent justify-end' : 'bg-border justify-start'
              )}
            >
              <motion.div layout className="w-5 h-5 rounded-full bg-white shadow-md" />
            </div>
          </button>
        </div>

        {/* Start button */}
        <Button size="lg" fullWidth loading={loading} onClick={handleStart}>
          {loading ? 'Loading questions…' : `Start Practice · ${questionCount} Questions`}
        </Button>
      </motion.div>
    </div>
  );
};

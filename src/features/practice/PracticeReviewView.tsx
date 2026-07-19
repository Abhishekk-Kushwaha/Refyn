import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { useSessionStore } from '@/stores/sessionStore';
import { persistSession, AttemptRecord } from '@/services/sessions.service';
import { aweEngine } from '@/engine/engine';

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

    // Fire the AWE triggers (Doc 5 §10): per-attempt rules (R001/R002), then
    // the session-level transitions (R003–R006) on this quiz's per-concept accuracy.
    answered.forEach(({ q, answer }) => aweEngine.onAttemptSaved(q, answer!.isCorrect, now));
    aweEngine.onSessionCompleted(
      answered.map(({ q, answer }) => ({ question: q, isCorrect: answer!.isCorrect })),
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

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Celebration */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="text-5xl mb-2">{stats.accuracy >= 70 ? '🎉' : '💪'}</div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {stats.accuracy >= 70 ? 'Well done!' : 'Good effort!'}
          </h1>
        </motion.div>

        {/* Accuracy ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="relative w-40 h-40">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="10" />
              <motion.circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-text-primary">{stats.accuracy}%</span>
              <span className="text-xs text-text-muted">accuracy</span>
            </div>
          </div>
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3 mb-8"
        >
          <div className="bg-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">
              {stats.correctCount}/{stats.total}
            </div>
            <div className="text-xs text-text-muted mt-1">Correct</div>
          </div>
          <div className="bg-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-text-primary font-mono">
              {Math.floor(stats.avgTime / 60)}m {stats.avgTime % 60}s
            </div>
            <div className="text-xs text-text-muted mt-1">Avg time/Q</div>
          </div>
        </motion.div>

        {/* Topic breakdown */}
        <div className="mb-8">
          <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
            By Topic
          </h4>
          <div className="space-y-2">
            {stats.topics.map((topic, i) => {
              const pct = Math.round((topic.correct / topic.total) * 100);
              const borderColor = pct >= 70 ? 'success' : pct >= 40 ? undefined : 'danger';
              return (
                <motion.div
                  key={topic.topicName}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className={`bg-surface rounded-lg p-4 flex items-center justify-between border-l-4 ${
                    borderColor === 'success'
                      ? 'border-l-success'
                      : borderColor === 'danger'
                      ? 'border-l-danger'
                      : 'border-l-accent'
                  }`}
                >
                  <div>
                    <div className="font-medium text-text-primary">{topic.topicName}</div>
                    <div className="text-xs text-text-muted">
                      {topic.correct}/{topic.total} correct
                    </div>
                  </div>
                  <div
                    className={`font-bold ${
                      pct >= 70 ? 'text-success' : pct >= 40 ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {pct}%
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-2"
        >
          <Button size="lg" fullWidth onClick={() => handleDone('/practice')}>
            Practice Again
          </Button>
          <Button size="lg" variant="secondary" fullWidth onClick={() => handleDone('/dashboard')}>
            Back to Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, SkeletonCard } from '@/components/ui';
import { ErrorState, EmptyState, useToast } from '@/components/feedback';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { getQuestionsForSubtopic } from '@/services/questions.service';
import { SubtopicWeakness } from '@/services/weakness.service';
import { WeaknessRadar } from './components/WeaknessRadar';
import { WeakTopicCard } from './components/WeakTopicCard';

export const DashboardView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWeaknessScores();

  const displayName = useAuthStore((state) => state.session?.user.displayName) ?? 'there';
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';
  const startSession = useSessionStore((state) => state.startSession);

  const [drillingId, setDrillingId] = useState<string | null>(null);

  const handleDrill = async (subtopic: SubtopicWeakness) => {
    setDrillingId(subtopic.subtopicId);
    try {
      const questions = await getQuestionsForSubtopic(examId, subtopic.subtopicId, 5);
      startSession(questions, 'topic', true);
      navigate('/practice/session');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDrillingId(null);
    }
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          Hey, {displayName} 👋
        </h1>
        <p className="text-text-muted">Let's hunt down your weak spots.</p>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {/* Empty — no attempts yet */}
      {!isLoading && !error && data && data.totalAttempts === 0 && (
        <EmptyState
          icon="🎯"
          title="No data yet"
          description="Complete a practice session and your weakness profile will appear here — ranked, so you always know what to fix next."
          action={{ label: 'Start Practicing', onClick: () => navigate('/practice') }}
        />
      )}

      {/* Success */}
      {!isLoading && !error && data && data.totalAttempts > 0 && (
        <div className="space-y-8">
          {/* Radar */}
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-lg p-4"
          >
            <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-2">
              Weakness Map
            </h4>
            <WeaknessRadar topics={data.topics} />
          </motion.section>

          {/* Ranked weak topics */}
          <section>
            <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
              Ranked by weakness
            </h4>
            <div className="space-y-3">
              {data.subtopics.map((subtopic, i) => (
                <WeakTopicCard
                  key={subtopic.subtopicId}
                  subtopic={subtopic}
                  index={i}
                  onDrill={handleDrill}
                  drilling={drillingId === subtopic.subtopicId}
                />
              ))}
            </div>
          </section>

          {/* CTA */}
          <Button size="lg" fullWidth onClick={() => navigate('/practice')}>
            Start a Practice Session
          </Button>
        </div>
      )}
    </div>
  );
};

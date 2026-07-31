import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SkeletonCard, Display, Eyebrow, StatBar, StatPill, ModeCard } from '@/components/ui';
import { ErrorState, EmptyState, useToast } from '@/components/feedback';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { useDailyFocus } from '@/hooks/useDailyFocus';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { getQuestionsForSubtopic } from '@/services/questions.service';
import { SubtopicWeakness } from '@/services/weakness.service';
import { WeaknessRadar } from './components/WeaknessRadar';
import { WeakTopicCard } from './components/WeakTopicCard';
import { FocusCard } from './components/FocusCard';

export const DashboardView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWeaknessScores();

  const displayName = useAuthStore((state) => state.session?.user.displayName) ?? 'there';
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';
  const startSession = useSessionStore((state) => state.startSession);

  const [drillingId, setDrillingId] = useState<string | null>(null);

  // The engine's own ranking decides today's focus — subtopics arrive sorted
  // weakest-first. The AI only writes the prose explaining that choice.
  const focusSubtopic = data?.subtopics[0];
  const attempted = data?.subtopics.reduce((sum, s) => sum + s.attempts, 0) ?? 0;
  const focus = useDailyFocus(focusSubtopic, focusSubtopic?.frequencyWeight, {
    overallAccuracy: attempted
      ? Math.round(
          data!.subtopics.reduce((sum, s) => sum + s.accuracy * s.attempts, 0) / attempted
        )
      : 0,
    totalAttempts: data?.totalAttempts ?? 0,
  });

  const handleDrill = async (subtopic: SubtopicWeakness) => {
    setDrillingId(subtopic.subtopicId);
    try {
      // Name is passed as a fallback: engine state can hold a mock subtopic id
      // from before the live pool loaded. See getQuestionsForSubtopic.
      const questions = await getQuestionsForSubtopic(
        examId,
        subtopic.subtopicId,
        5,
        subtopic.subtopicName
      );
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
      {/* Stat bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <StatBar>
          <StatPill
            icon="practice"
            value={data?.totalAttempts ?? 0}
            unit="attempted"
            label="Questions attempted"
          />
          {data && data.totalAttempts > 0 && (
            <StatPill
              icon="trend"
              value={Math.round(
                (data.subtopics.reduce((sum, s) => sum + (s.accuracy * s.attempts), 0) /
                  (data.subtopics.reduce((sum, s) => sum + s.attempts, 0) || 1))
              )}
              unit="%"
              label="Overall accuracy"
              tone="accent"
            />
          )}
        </StatBar>
      </motion.div>

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Eyebrow className="mb-2 text-accent">Hey {displayName}</Eyebrow>
        <Display size="lg">Hunt your weakness</Display>
        <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">
          Complete a practice session to see ranked insights into your weak spots. We'll always show you what needs fixing next.
        </p>
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
          title="Ready to begin?"
          description="Your weakness profile appears after your first practice session. We'll rank your weak spots so you always know what to fix next."
          action={{ label: 'Start Practicing', onClick: () => navigate('/practice') }}
        />
      )}

      {/* Success */}
      {!isLoading && !error && data && data.totalAttempts > 0 && (
        <div className="space-y-8">
          {/* Today's focus — engine picks the concept, AI explains why */}
          {focusSubtopic && (
            <FocusCard
              subtopic={focusSubtopic}
              message={focus.data?.message ?? ''}
              loading={focus.isLoading}
              onDrill={handleDrill}
              drilling={drillingId === focusSubtopic.subtopicId}
            />
          )}

          {/* Quick start cards */}
          <section className="space-y-2">
            <Eyebrow className="text-text-muted">Practice</Eyebrow>
            <ModeCard
              title="Weakness Hunt"
              description="Pulls from your weakest subtopics and adapts as you go."
              meta={['Adaptive', 'Ranked']}
              tone="accent"
              onClick={() => navigate('/practice')}
            />
          </section>

          {/* Radar */}
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-xl border border-border p-5"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <Eyebrow className="text-text-muted">Weakness Map</Eyebrow>
              <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wider text-text-secondary">
                {data.topics.length >= 3
                  ? `${data.topics.length} sections`
                  : `${data.subtopics.length} concepts`}
              </span>
            </div>
            <WeaknessRadar topics={data.topics} subtopics={data.subtopics} />
          </motion.section>

          {/* Ranked weak topics */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <Eyebrow className="text-text-muted">Ranked by weakness</Eyebrow>
              <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wider text-text-secondary">
                {data.subtopics.length} subtopics
              </span>
            </div>
            <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
};

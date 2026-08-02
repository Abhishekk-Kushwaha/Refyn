import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Panel, PanelHeader, SkeletonCard, StatCard } from '@/components/ui';
import { Page, PageHeader, PageGrid, Section } from '@/components/layout';
import { ErrorState, EmptyState, useToast } from '@/components/feedback';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { useDailyFocus } from '@/hooks/useDailyFocus';
import { useSkipInsights } from '@/hooks/useSkipInsights';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { getQuestionsForSubtopic } from '@/services/questions.service';
import { SubtopicWeakness } from '@/services/weakness.service';
import { WeaknessRadar } from './components/WeaknessRadar';
import { WeakTopicCard } from './components/WeakTopicCard';
import { FocusCard } from './components/FocusCard';
import { SkipPanel } from './components/SkipPanel';
import { TopicTimePanel } from './components/TopicTimePanel';

export const DashboardView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWeaknessScores();
  // Pure AWE — no network, no model. Renders as soon as the dashboard mounts.
  const skips = useSkipInsights();

  const displayName = useAuthStore((state) => state.session?.user.displayName) ?? 'there';
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';
  const startSession = useSessionStore((state) => state.startSession);

  const [drillingId, setDrillingId] = useState<string | null>(null);

  // The engine's top-ranked concept is the starting point and the fallback.
  // The model may pick a different one — it weighs CAT frequency, pacing,
  // avoidance and how well-evidenced each weakness is, which weaknessScore
  // alone does not capture.
  const enginePick = data?.subtopics[0];
  const attempted = data?.subtopics.reduce((sum, s) => sum + s.attempts, 0) ?? 0;
  const overallAccuracy = attempted
    ? Math.round(
        data!.subtopics.reduce((sum, s) => sum + s.accuracy * s.attempts, 0) / attempted
      )
    : 0;

  const focus = useDailyFocus(enginePick, enginePick?.frequencyWeight, {
    overallAccuracy,
    totalAttempts: data?.totalAttempts ?? 0,
    profile: data?.subtopics ?? [],
    topics: data?.topics ?? [],
  });

  // Resolve the model's choice back to a real subtopic. If it chose one we
  // cannot find — or hasn't answered yet — the engine's pick stands, so the
  // card and its Drill button always point at something drillable.
  const focusSubtopic =
    (focus.data?.conceptKey
      ? data?.subtopics.find((s) => s.subtopicId === focus.data!.conceptKey)
      : undefined) ?? enginePick;

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

  const hasData = !isLoading && !error && data && data.totalAttempts > 0;

  // Concepts the engine currently rates as weak — the headline number that
  // tells you whether the profile is improving.
  const weakCount =
    data?.subtopics.filter((s) => s.band === 'critical' || s.band === 'weak').length ?? 0;

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={`Hey ${displayName}`}
        title="Hunt your weakness"
        description="Every session sharpens the ranking below. The engine picks what to fix next — you just show up and drill."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon="flashcards"
              onClick={() => navigate('/flashcards')}
            >
              Review cards
            </Button>
            <Button size="md" icon="practice" onClick={() => navigate('/practice')}>
              Start practice
            </Button>
          </>
        }
      />

      {/* Loading */}
      {isLoading && (
        <PageGrid>
          <div className="lg:col-span-8">
            <SkeletonCard />
          </div>
          <div className="lg:col-span-4">
            <SkeletonCard />
          </div>
        </PageGrid>
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

      {hasData && (
        <div className="space-y-5 xl:space-y-6">
          {/* ---- Row 1: the numbers ------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5 xl:gap-6"
          >
            <StatCard
              label="Attempted"
              value={data.totalAttempts}
              icon="practice"
              hint="Questions answered all time"
            />
            <StatCard
              label="Accuracy"
              value={overallAccuracy}
              unit="%"
              icon="trend"
              tone={overallAccuracy >= 70 ? 'success' : overallAccuracy >= 45 ? 'accent' : 'danger'}
              hint="Weighted across every concept"
            />
            <StatCard
              label="Weak spots"
              value={weakCount}
              icon="alert"
              tone={weakCount > 0 ? 'warning' : 'success'}
              hint={weakCount === 0 ? 'Nothing critical right now' : 'Concepts rated weak or worse'}
            />
            <StatCard
              label="Concepts"
              value={data.subtopics.length}
              icon="layers"
              hint={`Across ${data.topics.length} section${data.topics.length === 1 ? '' : 's'}`}
            />
          </motion.div>

          {/* ---- Row 2: focus hero + quick start ------------------------ */}
          <PageGrid>
            {focusSubtopic && (
              <div className="lg:col-span-8">
                <FocusCard
                  subtopic={focusSubtopic}
                  message={focus.data?.message ?? ''}
                  loading={focus.isLoading}
                  onDrill={handleDrill}
                  drilling={drillingId === focusSubtopic.subtopicId}
                />
              </div>
            )}

            <div className="lg:col-span-4">
              <Panel className="flex h-full flex-col">
                <PanelHeader icon="bolt" title="Jump in" />

                <div className="flex flex-1 flex-col gap-2.5">
                  <QuickStart
                    title="Weakness Hunt"
                    body="Pulls from your weakest subtopics and adapts as you go."
                    onClick={() => navigate('/practice')}
                  />
                  <QuickStart
                    title="Smart Quiz"
                    body="A 70/20/10 blend of weak spots, revision and fresh material."
                    onClick={() => navigate('/practice')}
                  />
                  <QuickStart
                    title="Flashcards"
                    body="Spaced repetition on the concepts you keep dropping."
                    onClick={() => navigate('/flashcards')}
                  />
                </div>
              </Panel>
            </div>
          </PageGrid>

          {/* ---- Row 3: map + pace -------------------------------------- */}
          <PageGrid>
            <div className="lg:col-span-7">
              <Panel className="h-full">
                <PanelHeader
                  icon="spark"
                  title="Weakness map"
                  aside={
                    <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-faint">
                      {data.topics.length >= 3
                        ? `${data.topics.length} sections`
                        : `${data.subtopics.length} concepts`}
                    </span>
                  }
                />
                <WeaknessRadar topics={data.topics} subtopics={data.subtopics} />
              </Panel>
            </div>

            {/* Pace per topic — engine-computed, hides itself until something
                has been timed. */}
            <div className="lg:col-span-5">
              <TopicTimePanel topics={data.topics} />
            </div>
          </PageGrid>

          {/* Skip behaviour — engine-computed, renders itself away when there
              is no pattern worth showing. */}
          {skips.data && <SkipPanel data={skips.data} />}

          {/* ---- Ranked weak topics ------------------------------------- */}
          <Section
            title="Ranked by weakness"
            aside={`${data.subtopics.length} subtopics`}
          >
            {/* The list was a single 672px column. On desktop it now fans out
                to three, so the whole ranking is visible without scrolling. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
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
          </Section>
        </div>
      )}
    </Page>
  );
};

/** Compact launcher row inside the "Jump in" panel. */
const QuickStart = ({
  title,
  body,
  onClick,
}: {
  title: string;
  body: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex-1 rounded-lg border border-border bg-surface-raised p-3.5 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="font-heading text-[0.9375rem] font-semibold tracking-[-0.01em] text-text-primary">
        {title}
      </span>
      <span className="text-text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent">
        →
      </span>
    </div>
    <p className="mt-1 font-body text-xs leading-relaxed text-text-muted">{body}</p>
  </button>
);

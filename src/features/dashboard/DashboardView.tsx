import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Panel, PanelHeader, SkeletonCard } from '@/components/ui';
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
import { TierRow } from './components/TierRow';
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

  /** Drills the top three weak concepts in one session, per the ledger's CTA. */
  const handleHuntTopThree = async () => {
    if (!data) return;
    const targets = data.subtopics.slice(0, 3);
    if (targets.length === 0) return;
    setDrillingId('__top3');
    try {
      const batches = await Promise.all(
        targets.map((s) =>
          getQuestionsForSubtopic(examId, s.subtopicId, 4, s.subtopicName)
        )
      );
      const questions = batches.flat();
      if (questions.length === 0) {
        toast.error('No questions available for those concepts yet.');
        return;
      }
      startSession(questions, 'topic', true);
      navigate('/practice/session');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDrillingId(null);
    }
  };

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={`Hey ${displayName}`}
        title="Hunt your weakness"
        description={
          // Only claim a mapped profile once there is one. On the empty state
          // this sat above "Ready to begin?" announcing "0 concepts ranked
          // below", with nothing below it.
          hasData
            ? `${data.topics.length} section${data.topics.length === 1 ? '' : 's'} mapped · ${data.subtopics.length} concept${data.subtopics.length === 1 ? '' : 's'} ranked below. The engine picks what to fix next — you just show up and drill.`
            : 'Every session sharpens the ranking below. The engine picks what to fix next — you just show up and drill.'
        }
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
          <div className="lg:col-span-7">
            <SkeletonCard />
          </div>
          <div className="lg:col-span-5">
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
          {/* ---- The two figures, editorial scale ----------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-end justify-between gap-6"
          >
            <div className="min-w-0">
              <div className="mb-1 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Overall accuracy
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[3.25rem] font-bold leading-[0.9] tracking-[-0.04em] tabular-nums text-text-primary lg:text-[4rem]">
                  {overallAccuracy}
                  <span className="text-[1.625rem] text-text-muted">%</span>
                </span>
                <span className="font-body text-[0.8125rem] font-semibold text-text-muted">
                  {weakCount === 0
                    ? 'nothing critical'
                    : `${weakCount} weak spot${weakCount === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="font-mono text-2xl font-bold tabular-nums text-text-primary">
                {data.totalAttempts.toLocaleString()}
              </div>
              <div className="font-body text-[0.65625rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                attempted
              </div>
            </div>
          </motion.div>

          {/* ---- Row 1: the instrument + today's move -------------------- */}
          <PageGrid>
            <div className="lg:col-span-7">
              <Panel glass elevation="lg" className="h-full">
                <PanelHeader
                  title="Weakness map"
                  aside={
                    <span className="font-mono text-[0.6875rem] font-bold text-text-secondary">
                      {data.topics.length >= 3
                        ? `${data.topics.length} sections`
                        : `${data.subtopics.length} concepts`}
                    </span>
                  }
                />
                <WeaknessRadar topics={data.topics} subtopics={data.subtopics} />
              </Panel>
            </div>

            {focusSubtopic && (
              <div className="lg:col-span-5">
                <FocusCard
                  subtopic={focusSubtopic}
                  message={focus.data?.message ?? ''}
                  overallAccuracy={overallAccuracy}
                  loading={focus.isLoading}
                  onDrill={handleDrill}
                  drilling={drillingId === focusSubtopic.subtopicId}
                />
              </div>
            )}
          </PageGrid>

          {/* ---- The ledger ---------------------------------------------
              Sections, not concepts. A real profile spans 126 concepts, and
              listing them flat produced a wall nobody reads — the ranking
              only means something if you can see the whole of it. Each row
              opens its topics, and those open their concepts. */}
          <Section
            title="Ranked by weakness"
            aside={`${data.sections.length} section${data.sections.length === 1 ? '' : 's'} · ${data.subtopics.length} concepts`}
          >
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:gap-x-5">
              {data.sections.map((section, i) => (
                <TierRow
                  key={section.slug}
                  index={i}
                  name={section.name}
                  accuracy={section.accuracy}
                  attempts={section.attempts}
                  conceptCount={section.conceptCount}
                  weakCount={section.weakCount}
                  to={`/weakness/${section.slug}`}
                />
              ))}
            </div>

            {data.subtopics.length >= 3 && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                trailingIcon="arrowRight"
                className="mt-4 xl:mx-auto xl:w-auto xl:px-10"
                loading={drillingId === '__top3'}
                onClick={handleHuntTopThree}
              >
                Hunt the top 3
              </Button>
            )}
          </Section>

          {/* ---- Pace + skip behaviour ----------------------------------
              Engine-computed panels that predate the redesign. Both hide
              themselves when there is no pattern worth showing, so they cost
              nothing on a thin profile. */}
          <PageGrid>
            {/* TopicTimePanel renders null when nothing has been timed, so the
                grid cell is gated on the same condition — an empty wrapper
                still claims a column. */}
            {data.topics.some((t) => t.timedAttempts > 0 && t.avgSeconds !== null) && (
              <div className="lg:col-span-6">
                <TopicTimePanel topics={data.topics} />
              </div>
            )}
            {skips.data && (
              <div className="lg:col-span-6">
                <SkipPanel data={skips.data} />
              </div>
            )}
          </PageGrid>
        </div>
      )}
    </Page>
  );
};

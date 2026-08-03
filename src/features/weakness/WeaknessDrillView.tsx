import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Icon, SkeletonCard } from '@/components/ui';
import { Page, Section } from '@/components/layout';
import { ErrorState, EmptyState, useToast } from '@/components/feedback';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { useExamStore } from '@/stores/examStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { getQuestionsForSubtopic } from '@/services/questions.service';
import { SubtopicWeakness } from '@/services/weakness.service';
import { LedgerRow } from '@/features/dashboard/components/LedgerRow';
import { TierRow } from '@/features/dashboard/components/TierRow';

/**
 * One screen for both navigable tiers.
 *
 * `/weakness/:section` lists that section's concept groups; adding `/:group`
 * lists that group's concepts. The two levels share a header, a stat row and a
 * list — splitting them into separate components would have duplicated all
 * three to vary only what a row does when clicked.
 */
export const WeaknessDrillView = () => {
  const { section: sectionParam, group: groupParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWeaknessScores();

  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';
  const startSession = useSessionStore((state) => state.startSession);
  const [drillingId, setDrillingId] = useState<string | null>(null);

  const section = data?.sections.find((s) => s.slug === sectionParam);
  const group = groupParam ? section?.groups.find((g) => g.slug === groupParam) : undefined;

  const handleDrill = async (subtopic: SubtopicWeakness) => {
    setDrillingId(subtopic.subtopicId);
    try {
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

  /** Practises across everything on this screen, weakest concepts first. */
  const handleDrillAll = async () => {
    const targets = (group ? group.subtopics : section?.groups.flatMap((g) => g.subtopics)) ?? [];
    const top = targets.slice(0, 3);
    if (top.length === 0) return;

    setDrillingId('__all');
    try {
      const batches = await Promise.all(
        top.map((s) => getQuestionsForSubtopic(examId, s.subtopicId, 4, s.subtopicName))
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

  if (isLoading) {
    return (
      <Page width="default">
        <SkeletonCard />
      </Page>
    );
  }

  if (error) {
    return (
      <Page width="default">
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </Page>
    );
  }

  // A slug that matches nothing — a stale bookmark, or a section that has been
  // practised away since the link was made.
  if (!section || (groupParam && !group)) {
    return (
      <Page width="default">
        <EmptyState
          icon="🧭"
          title="Nothing here yet"
          description={
            groupParam
              ? "You haven't practised any concepts in this group yet, so there's nothing to rank."
              : "You haven't practised anything in this section yet, so there's nothing to rank."
          }
          action={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
        />
      </Page>
    );
  }

  const showingConcepts = !!group;
  const title = group ? group.name : section.name;
  const accuracy = group ? group.accuracy : section.accuracy;
  const attempts = group ? group.attempts : section.attempts;
  const weakCount = group ? group.weakCount : section.weakCount;
  const conceptCount = group ? group.subtopics.length : section.conceptCount;

  return (
    <Page width="default">
      {/* Breadcrumb. The trail is short enough to render in full, which beats a
          bare back arrow that never says where back goes. */}
      <nav className="mb-5 flex items-center gap-1.5 font-body text-[0.8125rem] text-text-muted">
        <Link to="/dashboard" className="transition-colors hover:text-text-primary">
          Dashboard
        </Link>
        <Icon name="chevronRight" size={13} strokeWidth={2.4} className="text-text-faint" />
        {group ? (
          <>
            <Link
              to={`/weakness/${section.slug}`}
              className="transition-colors hover:text-text-primary"
            >
              {section.name}
            </Link>
            <Icon name="chevronRight" size={13} strokeWidth={2.4} className="text-text-faint" />
            <span className="text-text-primary">{group.name}</span>
          </>
        ) : (
          <span className="text-text-primary">{section.name}</span>
        )}
      </nav>

      <header className="mb-7">
        <p className="mb-2 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-accent">
          {showingConcepts ? section.name : 'Section'}
        </p>
        <h1 className="text-balance font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-text-primary lg:text-[2.5rem]">
          {title}
        </h1>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <Figure value={`${accuracy}%`} label="Accuracy" />
          <Figure value={String(attempts)} label="Attempted" />
          <Figure
            value={String(conceptCount)}
            label={showingConcepts ? 'Concepts' : 'Concepts ranked'}
          />
          <Figure value={String(weakCount)} label="Rated weak" tone={weakCount > 0} />
        </div>
      </header>

      {showingConcepts ? (
        <Section
          title="Ranked by weakness"
          aside={`${group.subtopics.length} concept${group.subtopics.length === 1 ? '' : 's'}`}
        >
          <div className="grid grid-cols-1 gap-2">
            {group.subtopics.map((subtopic, i) => (
              <LedgerRow
                key={subtopic.subtopicId}
                subtopic={subtopic}
                index={i}
                onDrill={handleDrill}
                drilling={drillingId === subtopic.subtopicId}
              />
            ))}
          </div>
        </Section>
      ) : (
        <Section
          title="Topics, ranked by weakness"
          aside={`${section.groups.length} topic${section.groups.length === 1 ? '' : 's'}`}
        >
          <div className="grid grid-cols-1 gap-2">
            {section.groups.map((g, i) => (
              <TierRow
                key={g.slug}
                index={i}
                name={g.name}
                accuracy={g.accuracy}
                attempts={g.attempts}
                conceptCount={g.subtopics.length}
                weakCount={g.weakCount}
                to={`/weakness/${section.slug}/${g.slug}`}
              />
            ))}
          </div>
        </Section>
      )}

      <Button
        size="lg"
        fullWidth
        trailingIcon="arrowRight"
        className="mt-5 sm:mx-auto sm:w-auto sm:px-10"
        loading={drillingId === '__all'}
        onClick={handleDrillAll}
      >
        {showingConcepts ? `Drill ${title}` : `Hunt the worst of ${title}`}
      </Button>
    </Page>
  );
};

const Figure = ({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: boolean;
}) => (
  <div>
    <div
      className={`font-mono text-2xl font-bold leading-none tabular-nums ${
        tone ? 'text-danger' : 'text-text-primary'
      }`}
    >
      {value}
    </div>
    <div className="mt-1.5 font-body text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
      {label}
    </div>
  </div>
);

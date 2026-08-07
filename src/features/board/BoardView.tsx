import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Icon, SkeletonCard, type IconName } from '@/components/ui';
import { Page } from '@/components/layout';
import { EmptyState, ErrorState, useToast } from '@/components/feedback';
import {
  getDoubts,
  voteDoubt,
  type BoardFilter,
  type Doubt,
  type VoteValue,
} from '@/services/doubts.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { VoteRail } from './components/VoteRail';

const filters: { id: BoardFilter; label: string; icon?: IconName }[] = [
  { id: 'hot', label: 'Hot', icon: 'hot' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'mine', label: 'Mine' },
  { id: 'discuss', label: 'Discuss', icon: 'board' },
];

/**
 * The Doubt Board — design 6a.
 *
 * Reddit's muscle memory (vote rail, sort tabs, concept pills) with the one
 * thing a general forum cannot offer: every answer carries the answerer's
 * measured accuracy in that exact concept, taken from their own practice
 * rather than self-reported.
 */
export const BoardView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BoardFilter>('hot');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const userId = useAuthStore((s) => s.session?.user.id) ?? 'anonymous';
  const examId = useExamStore((s) => s.selectedExamId) ?? 'cat';

  const queryKey = ['doubts', examId, filter, userId];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getDoubts(examId, filter, userId),
    staleTime: 0,
  });

  const vote = useMutation({
    mutationFn: ({ id, value }: { id: string; value: VoteValue }) =>
      voteDoubt(id, userId, value),
    // Optimistic: a vote that waits on a round-trip feels broken, and the
    // rail is the most-tapped control on the screen.
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Doubt[]>(queryKey);
      queryClient.setQueryData<Doubt[]>(queryKey, (old) =>
        old?.map((d) =>
          d.id === id ? { ...d, score: d.score + (value - d.myVote), myVote: value } : d
        )
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(getErrorMessage(err));
    },
  });

  const visible = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.body.toLowerCase().includes(q) ||
        (d.conceptName ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <Page width="default" className="relative">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] font-bold leading-[1.02] tracking-[-0.035em] text-text-primary lg:text-[2.25rem]">
              Doubt Board
            </h1>
            <p className="mt-1 font-body text-[0.8125rem] leading-relaxed text-text-secondary">
              Ranked by people who actually score it
            </p>
          </div>

          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch('');
            }}
            aria-label={searchOpen ? 'Close search' : 'Search doubts'}
            aria-expanded={searchOpen}
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-border bg-surface-raised text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name={searchOpen ? 'close' : 'search'} size={18} strokeWidth={2.2} />
          </button>
        </div>

        {searchOpen && (
          <motion.input
            autoFocus
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doubts, bodies, concepts…"
            className="mt-3 w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 font-body text-sm text-text-primary placeholder:text-text-faint focus-visible:border-accent focus-visible:outline-none"
          />
        )}

        {/* Sort tabs. Full-width strip on mobile, content-width on desktop —
            a four-tab control stretched across 1100px reads as a stretched
            phone UI. */}
        <div className="mt-3.5 flex gap-0.5 rounded-xl border border-border bg-surface-raised p-1 lg:inline-flex">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={clsx(
                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-body text-[0.6875rem] font-semibold tracking-[-0.01em] transition-colors lg:flex-none lg:px-5',
                filter === f.id
                  ? 'bg-gradient-accent text-accent-text shadow-glow-soft'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {f.icon && <Icon name={f.icon} size={11} strokeWidth={2.4} />}
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading && (
        <div className="grid gap-3 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {error && !isLoading && (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {!isLoading && !error && visible.length === 0 && (
        <EmptyState
          icon="💬"
          title={
            search
              ? 'Nothing matches that'
              : filter === 'mine'
                ? "You haven't asked anything yet"
                : filter === 'discuss'
                  ? 'No discussions yet'
                  : 'No doubts here'
          }
          description={
            search
              ? 'Try a different word, or clear the search to see the whole board.'
              : filter === 'unanswered'
                ? 'Every doubt has at least one answer — nice community.'
                : 'Be the first to ask. Someone strong in that concept will pick it up.'
          }
          action={{ label: 'Ask a question', onClick: () => navigate('/board/new') }}
        />
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3 pb-24 lg:grid-cols-2 lg:gap-4">
          {visible.map((doubt, i) => (
            <DoubtCard
              key={doubt.id}
              doubt={doubt}
              index={i}
              onOpen={() => navigate(`/board/${doubt.id}`)}
              onVote={(value) => vote.mutate({ id: doubt.id, value })}
            />
          ))}
        </div>
      )}

      {/* Floating compose. Sits above the mobile tab bar, and above the
          desktop viewport edge where the thumb never reaches anyway. */}
      <button
        onClick={() => navigate('/board/new')}
        className="fixed bottom-24 right-5 z-30 flex h-[50px] items-center gap-2 rounded-2xl bg-gradient-accent pl-[18px] pr-5 font-body text-sm font-semibold tracking-[-0.01em] text-accent-text shadow-glow transition-[filter,transform] duration-150 hover:brightness-[1.07] active:translate-y-px lg:bottom-8 lg:right-8"
      >
        <Icon name="plus" size={18} strokeWidth={2.6} />
        Ask
      </button>
    </Page>
  );
};

const DoubtCard = ({
  doubt,
  index,
  onOpen,
  onVote,
}: {
  doubt: Doubt;
  index: number;
  onOpen: () => void;
  onVote: (value: VoteValue) => void;
}) => {
  const unanswered = doubt.answerCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        'group flex cursor-pointer gap-3 rounded-2xl border p-3.5 text-left',
        'transition-[transform,border-color,box-shadow] duration-200 ease-out-expo',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        // An unanswered doubt is the one thing on this board that needs a
        // person, so it is the only card that asks for attention.
        unanswered
          ? 'border-warning/25 bg-gradient-to-b from-warning-subtle to-transparent'
          : 'panel-sheen border-border bg-surface-glass shadow-md backdrop-blur-xl backdrop-saturate-150'
      )}
    >
      <VoteRail
        score={doubt.score}
        myVote={doubt.myVote}
        onVote={onVote}
        label={doubt.title}
      />

      <div className="relative min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {doubt.conceptName && (
            <span className="rounded-full border border-accent-2/20 bg-accent-2-subtle px-2 py-0.5 font-body text-[0.65625rem] font-semibold text-accent-2">
              {doubt.conceptName}
            </span>
          )}
          {doubt.isResolved ? (
            <span className="inline-flex items-center gap-1 font-body text-[0.625rem] font-bold uppercase tracking-[0.04em] text-success">
              <Icon name="check" size={12} strokeWidth={3} />
              Resolved
            </span>
          ) : unanswered ? (
            <span className="inline-flex items-center gap-1.5 font-body text-[0.59375rem] font-bold uppercase tracking-[0.05em] text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              Needs an answer
            </span>
          ) : null}
        </div>

        <h3 className="mb-2 font-heading text-[0.9375rem] font-semibold leading-[1.3] tracking-[-0.01em] text-text-primary">
          {doubt.title}
        </h3>

        {doubt.topAnswer ? (
          /* The credibility preview — who answered, and how good they
             actually are at this concept, before you open anything. */
          <div className="flex items-start gap-2.5 rounded-xl border border-success/15 bg-success-subtle p-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-success font-body text-[0.6875rem] font-bold text-white">
              {doubt.topAnswer.authorName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-body text-[0.71875rem] font-semibold text-text-secondary">
                  {doubt.topAnswer.authorName}
                </span>
                {doubt.topAnswer.authorCredibility !== null && doubt.conceptName && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[0.59375rem] font-bold text-success">
                    <Icon name="shield" size={10} strokeWidth={3} />
                    {doubt.topAnswer.authorCredibility}% in {doubt.conceptName}
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 font-body text-[0.71875rem] leading-[1.45] text-text-muted">
                {doubt.topAnswer.body}
              </p>
            </div>
          </div>
        ) : (
          doubt.body && (
            <p className="line-clamp-2 font-body text-[0.78125rem] leading-[1.5] text-text-muted">
              {doubt.body}
            </p>
          )
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[0.6875rem] font-medium text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="board" size={13} strokeWidth={2.2} />
            {unanswered ? (
              <span className="text-warning">No answers yet</span>
            ) : (
              `${doubt.answerCount} answer${doubt.answerCount === 1 ? '' : 's'}`
            )}
          </span>
          {doubt.commentCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{doubt.commentCount} in discussion</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{timeAgo(doubt.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  );
};

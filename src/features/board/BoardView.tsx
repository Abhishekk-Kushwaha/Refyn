import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, Icon, SkeletonCard } from '@/components/ui';
import { Page, PageHeader } from '@/components/layout';
import { EmptyState, ErrorState } from '@/components/feedback';
import { getDoubts, BoardFilter } from '@/services/doubts.service';
import { useAuthStore } from '@/stores/authStore';
import { useExamStore } from '@/stores/examStore';
import { getErrorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import clsx from 'clsx';

const filters: { id: BoardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'mine', label: 'Mine' },
];

export const BoardView = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<BoardFilter>('all');
  const userId = useAuthStore((s) => s.session?.user.id) ?? 'anonymous';
  const examId = useExamStore((s) => s.selectedExamId) ?? 'cat';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['doubts', examId, filter, userId],
    queryFn: () => getDoubts(examId, filter, userId),
    staleTime: 0,
  });

  return (
    <Page width="default">
      <PageHeader
        eyebrow="Community"
        title="Doubt board"
        description="Ask peers. Credibility comes from real quiz data, not upvotes."
        actions={
          <Button icon="plus" onClick={() => navigate('/board/new')}>
            Ask a question
          </Button>
        }
        meta={
          /* Segmented control, sized to its labels rather than stretched
             across the full width — a 1100px-wide three-tab strip reads as
             a stretched mobile control. */
          <div className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={clsx(
                  'rounded-md px-4 py-1.5 font-body text-[0.8125rem] font-semibold transition-colors',
                  filter === f.id
                    ? 'bg-accent text-accent-text shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading && (
        <div className="grid gap-3 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {error && !isLoading && (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <EmptyState
          icon="💬"
          title={filter === 'mine' ? "You haven't asked anything yet" : 'No doubts here'}
          description={
            filter === 'unanswered'
              ? 'Every doubt has at least one answer — nice community.'
              : 'Be the first to ask. Someone strong in that concept will pick it up.'
          }
          action={{ label: 'Ask a Question', onClick: () => navigate('/board/new') }}
        />
      )}

      {!isLoading && !error && data && data.length > 0 && (
        /* Two columns on desktop. A single 672px thread column was the most
           visible symptom of the mobile-stretched layout. */
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          {data.map((doubt, i) => (
            <motion.button
              key={doubt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => navigate(`/board/${doubt.id}`)}
              className={clsx(
                'group flex w-full flex-col rounded-xl border border-border bg-surface p-5 text-left',
                'transition-[transform,border-color,box-shadow] duration-200 ease-out-expo',
                'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
              )}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-accent font-body text-[0.6875rem] font-bold text-white">
                  {doubt.authorName.charAt(0).toUpperCase()}
                </span>
                <span className="font-body text-[0.8125rem] font-medium text-text-secondary">
                  {doubt.authorName}
                </span>
                {doubt.conceptName && (
                  <span className="rounded-full border border-accent-muted bg-accent-subtle px-2 py-0.5 font-body text-[0.625rem] font-bold uppercase tracking-[0.08em] text-accent">
                    {doubt.conceptName}
                  </span>
                )}
                {doubt.isResolved && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 font-body text-[0.625rem] font-bold uppercase tracking-[0.08em] text-success">
                    <Icon name="check" size={10} strokeWidth={3} />
                    Resolved
                  </span>
                )}
              </div>

              <h3 className="mb-1.5 font-heading text-base font-semibold leading-snug tracking-[-0.015em] text-text-primary">
                {doubt.title}
              </h3>
              <p className="mb-4 line-clamp-2 flex-1 font-body text-[0.8125rem] leading-relaxed text-text-muted">
                {doubt.body}
              </p>

              <div className="flex items-center gap-2 font-body text-[0.6875rem] text-text-faint">
                <span
                  className={clsx(
                    'font-semibold',
                    doubt.answerCount === 0 ? 'text-warning' : 'text-text-secondary'
                  )}
                >
                  {doubt.answerCount === 0
                    ? 'No answers yet'
                    : `${doubt.answerCount} answer${doubt.answerCount === 1 ? '' : 's'}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(doubt.createdAt)}</span>
                <Icon
                  name="arrowRight"
                  size={13}
                  className="ml-auto text-text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </Page>
  );
};

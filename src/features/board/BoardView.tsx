import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, SkeletonCard } from '@/components/ui';
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
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Doubt Board</h1>
          <p className="text-text-muted text-sm">Ask peers. Credibility comes from real quiz data.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/board/new')}>
          + Ask
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-surface rounded-lg p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-accent-subtle text-accent'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
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
        <div className="space-y-3">
          {data.map((doubt, i) => (
            <motion.button
              key={doubt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/board/${doubt.id}`)}
              className="w-full text-left bg-surface rounded-lg p-4 border border-border hover:border-border-strong transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {doubt.authorName.charAt(0)}
                </span>
                <span className="text-sm text-text-secondary">{doubt.authorName}</span>
                {doubt.conceptName && (
                  <span className="text-xs text-accent bg-accent-subtle px-2 py-0.5 rounded-full">
                    {doubt.conceptName}
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-text-primary mb-1">
                {doubt.isResolved && <span className="text-success mr-1">✓</span>}
                {doubt.title}
              </h3>
              <p className="text-sm text-text-muted line-clamp-2 mb-2">{doubt.body}</p>

              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>
                  {doubt.answerCount === 0
                    ? 'No answers yet'
                    : `${doubt.answerCount} answer${doubt.answerCount === 1 ? '' : 's'}`}
                </span>
                <span>·</span>
                <span>{timeAgo(doubt.createdAt)}</span>
                {doubt.isResolved && (
                  <>
                    <span>·</span>
                    <span className="text-success font-medium">Resolved</span>
                  </>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

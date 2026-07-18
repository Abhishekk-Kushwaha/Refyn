import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, Textarea, SkeletonCard } from '@/components/ui';
import { ErrorState, useToast } from '@/components/feedback';
import {
  getDoubtThread,
  postAnswer,
  toggleHelpful,
  markResolved,
  getOwnCredibility,
} from '@/services/doubts.service';
import { CredibilityBadge } from './components/CredibilityBadge';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import clsx from 'clsx';

export const DoubtThreadView = () => {
  const { doubtId } = useParams<{ doubtId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);

  const [answerBody, setAnswerBody] = useState('');
  const [posting, setPosting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['doubt-thread', doubtId],
    queryFn: () => getDoubtThread(doubtId!),
    enabled: !!doubtId,
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['doubt-thread', doubtId] });
    queryClient.invalidateQueries({ queryKey: ['doubts'] });
  };

  const handleAnswer = async () => {
    if (!user || !doubtId) return;
    setPosting(true);
    try {
      await postAnswer({
        doubtId,
        authorId: user.id,
        authorName: user.displayName ?? 'Anonymous',
        body: answerBody,
      });
      setAnswerBody('');
      toast.success('Answer posted!');
      invalidate();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (answerId: string) => {
    if (!user) return;
    try {
      await toggleHelpful(answerId, user.id);
      invalidate();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleResolve = async () => {
    if (!user || !doubtId) return;
    try {
      await markResolved(doubtId, user.id);
      toast.success('Marked as resolved ✓');
      invalidate();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={getErrorMessage(error) || 'Doubt not found.'}
        onRetry={() => refetch()}
        className="flex-1"
      />
    );
  }

  const { doubt, answers } = data;
  const isOwner = user?.id === doubt.authorId;
  const ownCredibility = getOwnCredibility(doubt.conceptId);

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      <button
        onClick={() => navigate('/board')}
        className="text-text-muted hover:text-text-primary text-sm mb-4 transition-colors"
      >
        ← Back to board
      </button>

      {/* The doubt */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-lg p-5 border border-border mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-accent-subtle text-accent text-sm font-bold flex items-center justify-center">
            {doubt.authorName.charAt(0)}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-text-primary font-medium">{doubt.authorName}</span>
            <span className="text-xs text-text-muted ml-2">{timeAgo(doubt.createdAt)}</span>
          </div>
          {doubt.conceptName && (
            <span className="text-xs text-accent bg-accent-subtle px-2 py-0.5 rounded-full">
              {doubt.conceptName}
            </span>
          )}
        </div>

        <h1 className="text-xl font-semibold text-text-primary mb-2">
          {doubt.isResolved && <span className="text-success mr-1">✓</span>}
          {doubt.title}
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
          {doubt.body}
        </p>

        {isOwner && !doubt.isResolved && answers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={handleResolve}>
              ✓ Mark resolved
            </Button>
          </div>
        )}
      </motion.div>

      {/* Answers */}
      <h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase mb-3">
        {answers.length === 0
          ? 'No answers yet'
          : `${answers.length} answer${answers.length === 1 ? '' : 's'} · most helpful first`}
      </h4>

      <div className="space-y-3 mb-8">
        {answers.map((answer, i) => {
          const hasVoted = user ? answer.votedBy.includes(user.id) : false;
          return (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface rounded-lg p-4 border border-border"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="w-7 h-7 rounded-full bg-surface-raised text-text-secondary text-xs font-bold flex items-center justify-center border border-border">
                  {answer.authorName.charAt(0)}
                </span>
                <span className="text-sm text-text-primary font-medium">{answer.authorName}</span>
                <CredibilityBadge accuracy={answer.authorCredibility} conceptName={doubt.conceptName} />
                <span className="text-xs text-text-muted ml-auto">{timeAgo(answer.createdAt)}</span>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mb-3">
                {answer.body}
              </p>

              <button
                onClick={() => handleVote(answer.id)}
                className={clsx(
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
                  hasVoted
                    ? 'bg-accent-subtle border-accent text-accent'
                    : 'border-border text-text-muted hover:border-border-strong hover:text-text-primary'
                )}
              >
                👍 Helpful · {answer.helpfulCount}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Answer composer */}
      <div className="bg-surface rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold text-text-primary text-sm">Your answer</h4>
          <CredibilityBadge accuracy={ownCredibility} conceptName={doubt.conceptName} />
        </div>
        <Textarea
          placeholder="Explain it the way you'd want it explained to you…"
          value={answerBody}
          onChange={(e) => setAnswerBody(e.target.value)}
          disabled={posting}
        />
        <div className="mt-3">
          <Button loading={posting} disabled={!answerBody.trim()} onClick={handleAnswer}>
            Post Answer
          </Button>
        </div>
      </div>
    </div>
  );
};

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Icon, SkeletonCard, Textarea } from '@/components/ui';
import { ErrorState, useToast } from '@/components/feedback';
import {
  acceptAnswer,
  getDoubtThread,
  getOwnCredibility,
  postAnswer,
  postComment,
  voteAnswer,
  voteComment,
  voteDoubt,
  type DoubtAnswer,
  type DoubtComment,
  type VoteValue,
} from '@/services/doubts.service';
import { CredibilityBadge } from './components/CredibilityBadge';
import { VoteRail } from './components/VoteRail';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';

/**
 * One doubt — design 6b.
 *
 * Answers are ranked by helpful votes with the accepted one pinned and lit,
 * each badged with the answerer's live accuracy in this concept. Discussion
 * sits below, visually distinct: chatter and answers are different things,
 * and merging them is how a board turns into a chat log.
 */
export const DoubtThreadView = () => {
  const { doubtId } = useParams<{ doubtId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const userId = user?.id ?? 'anonymous';

  const [answerBody, setAnswerBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);

  const queryKey = ['doubt-thread', doubtId, userId];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getDoubtThread(doubtId!, userId),
    enabled: !!doubtId,
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['doubt-thread', doubtId] });
    queryClient.invalidateQueries({ queryKey: ['doubts'] });
  };

  /** Votes apply locally first — a rail that waits on the network feels dead. */
  const runVote = async (
    apply: () => Promise<void>,
    optimistic: (draft: NonNullable<typeof data>) => NonNullable<typeof data>
  ) => {
    const previous = queryClient.getQueryData<NonNullable<typeof data>>(queryKey);
    if (previous) queryClient.setQueryData(queryKey, optimistic(previous));
    try {
      await apply();
      invalidate();
    } catch (e) {
      if (previous) queryClient.setQueryData(queryKey, previous);
      toast.error(getErrorMessage(e));
    }
  };

  const handlePost = async (action: () => Promise<void>, onDone: () => void, message: string) => {
    if (!user || !doubtId) return;
    setBusy(true);
    try {
      await action();
      onDone();
      toast.success(message);
      invalidate();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rootComments = useMemo(
    () => (data?.comments ?? []).filter((c) => c.parentId === null),
    [data]
  );
  const repliesOf = (id: string) => (data?.comments ?? []).filter((c) => c.parentId === id);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[820px] flex-1 space-y-3 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Nav header */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/board')}
            aria-label="Back to board"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-border bg-surface-raised text-text-primary transition-colors hover:border-border-strong"
          >
            <Icon name="chevronLeft" size={18} strokeWidth={2.4} />
          </button>

          <div className="min-w-0">
            <div className="font-heading text-sm font-bold tracking-[-0.01em] text-text-primary">
              Doubt
            </div>
            {doubt.conceptName && (
              <div className="truncate font-body text-[0.6875rem] font-medium text-text-muted">
                {doubt.conceptName}
              </div>
            )}
          </div>

          {doubt.isResolved && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-success/25 bg-success-subtle px-2.5 py-1.5 font-body text-[0.625rem] font-bold uppercase tracking-[0.04em] text-success">
              <Icon name="check" size={12} strokeWidth={3} />
              Resolved
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[820px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {/* ---- The doubt ---------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3.5"
        >
          <VoteRail
            variant="bare"
            score={doubt.score}
            myVote={doubt.myVote}
            label="this doubt"
            onVote={(value) =>
              runVote(
                () => voteDoubt(doubt.id, userId, value),
                (d) => ({
                  ...d,
                  doubt: {
                    ...d.doubt,
                    score: d.doubt.score + (value - d.doubt.myVote),
                    myVote: value,
                  },
                })
              )
            }
          />

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-overlay font-body text-[0.6875rem] font-bold text-text-secondary">
                {doubt.authorName.charAt(0).toUpperCase()}
              </span>
              <span className="font-body text-xs font-semibold text-text-secondary">
                {doubt.authorName}
              </span>
              <span className="font-body text-[0.6875rem] text-text-faint">
                · {timeAgo(doubt.createdAt)}
              </span>
            </div>

            <h1 className="mb-2.5 font-heading text-[1.1875rem] font-semibold leading-[1.28] tracking-[-0.015em] text-text-primary">
              {doubt.title}
            </h1>
            {doubt.body && (
              <p className="whitespace-pre-wrap font-body text-[0.84375rem] leading-[1.6] text-text-secondary">
                {doubt.body}
              </p>
            )}
          </div>
        </motion.div>

        {/* ---- Answers ------------------------------------------------- */}
        <div className="my-4 flex items-center gap-2">
          <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-text-muted">
            {answers.length === 0
              ? 'No answers yet'
              : `${answers.length} answer${answers.length === 1 ? '' : 's'}`}
          </span>
          <span className="h-px flex-1 bg-border" />
          {answers.length > 0 && (
            <span className="font-body text-[0.6875rem] font-semibold text-text-faint">
              Ranked by helpful
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {answers.map((answer, i) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              index={i}
              conceptName={doubt.conceptName}
              canAccept={isOwner}
              onVote={(value) =>
                runVote(
                  () => voteAnswer(answer.id, userId, value),
                  (d) => ({
                    ...d,
                    answers: d.answers.map((a) =>
                      a.id === answer.id
                        ? { ...a, helpfulCount: a.helpfulCount + (value - a.myVote), myVote: value }
                        : a
                    ),
                  })
                )
              }
              onAccept={() =>
                handlePost(
                  () =>
                    acceptAnswer(
                      doubt.id,
                      answer.isAccepted ? null : answer.id,
                      user!.id
                    ),
                  () => undefined,
                  answer.isAccepted ? 'Answer un-accepted' : 'Answer accepted ✓'
                )
              }
            />
          ))}
        </div>

        {/* ---- Discussion ---------------------------------------------
            Deliberately below the ranked answers and styled flatter: this
            is chatter, and it must never compete with a vetted answer. */}
        <div className="mb-3 mt-7 flex items-center gap-2">
          <Icon name="board" size={15} strokeWidth={2.2} className="text-text-muted" />
          <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-text-muted">
            Discussion
          </span>
          <span className="font-mono text-[0.625rem] font-bold text-text-faint">
            {data.comments.length}
          </span>
          <span className="h-px flex-1 bg-border" />
          <span className="font-body text-[0.6875rem] font-semibold text-text-faint">Newest</span>
        </div>

        <div className="flex flex-col gap-3.5">
          {rootComments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-3.5">
              <CommentRow
                comment={comment}
                isOp={comment.authorId === doubt.authorId}
                onVote={(value) =>
                  runVote(
                    () => voteComment(comment.id, userId, value),
                    (d) => ({
                      ...d,
                      comments: d.comments.map((c) =>
                        c.id === comment.id
                          ? { ...c, score: c.score + (value - c.myVote), myVote: value }
                          : c
                      ),
                    })
                  )
                }
                onReply={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id);
                  setReplyBody('');
                }}
              />

              {repliesOf(comment.id).map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  nested
                  isOp={reply.authorId === doubt.authorId}
                  onVote={(value) =>
                    runVote(
                      () => voteComment(reply.id, userId, value),
                      (d) => ({
                        ...d,
                        comments: d.comments.map((c) =>
                          c.id === reply.id
                            ? { ...c, score: c.score + (value - c.myVote), myVote: value }
                            : c
                        ),
                      })
                    )
                  }
                />
              ))}

              {replyTo === comment.id && (
                <div className="pl-[34px]">
                  <Textarea
                    autoFocus
                    rows={2}
                    placeholder={`Reply to ${comment.authorName}…`}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    disabled={busy}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={busy || !replyBody.trim()}
                      onClick={() =>
                        handlePost(
                          () =>
                            postComment({
                              doubtId: doubt.id,
                              parentId: comment.id,
                              authorId: user!.id,
                              authorName: user!.displayName ?? 'Anonymous',
                              body: replyBody,
                              conceptId: doubt.conceptId,
                            }),
                          () => {
                            setReplyBody('');
                            setReplyTo(null);
                          },
                          'Reply posted'
                        )
                      }
                      className="rounded-lg bg-gradient-accent px-3.5 py-1.5 font-body text-xs font-semibold text-accent-text disabled:opacity-45"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="rounded-lg px-3 py-1.5 font-body text-xs font-semibold text-text-muted hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add to the discussion */}
        <div className="mt-4">
          <Textarea
            rows={2}
            placeholder="Add to the discussion…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            disabled={busy}
          />
          <button
            disabled={busy || !commentBody.trim()}
            onClick={() =>
              handlePost(
                () =>
                  postComment({
                    doubtId: doubt.id,
                    parentId: null,
                    authorId: user!.id,
                    authorName: user!.displayName ?? 'Anonymous',
                    body: commentBody,
                    conceptId: doubt.conceptId,
                  }),
                () => setCommentBody(''),
                'Comment posted'
              )
            }
            className="mt-2 rounded-lg border border-border-strong bg-surface-raised px-4 py-2 font-body text-xs font-semibold text-text-secondary transition-colors hover:border-text-faint disabled:opacity-45"
          >
            Comment
          </button>
        </div>

        <div className="h-6" />
      </div>

      {/* ---- Reply bar ------------------------------------------------
          Carries your own credibility, so you can see what weight your
          answer will land with before you write it. */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface-glass backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[820px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <Textarea
                rows={1}
                placeholder="Add your answer…"
                value={answerBody}
                onChange={(e) => setAnswerBody(e.target.value)}
                disabled={busy}
              />
              {ownCredibility !== null && (
                <div className="mt-1.5">
                  <CredibilityBadge
                    accuracy={ownCredibility}
                    conceptName={doubt.conceptName}
                    size="sm"
                    self
                  />
                </div>
              )}
            </div>

            <button
              disabled={busy || !answerBody.trim()}
              onClick={() =>
                handlePost(
                  () =>
                    postAnswer({
                      doubtId: doubt.id,
                      authorId: user!.id,
                      authorName: user!.displayName ?? 'Anonymous',
                      body: answerBody,
                      conceptId: doubt.conceptId, // credibility snapshot is per-concept
                    }),
                  () => setAnswerBody(''),
                  'Answer posted'
                )
              }
              aria-label="Post answer"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-gradient-accent text-accent-text shadow-glow transition-[filter,transform] duration-150 hover:brightness-[1.07] active:translate-y-px disabled:opacity-45"
            >
              <Icon name="send" size={19} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnswerCard = ({
  answer,
  index,
  conceptName,
  canAccept,
  onVote,
  onAccept,
}: {
  answer: DoubtAnswer;
  index: number;
  conceptName?: string;
  canAccept: boolean;
  onVote: (value: VoteValue) => void;
  onAccept: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index * 0.05, 0.25) }}
    className={clsx(
      'relative flex gap-3.5 rounded-2xl border p-3.5',
      answer.isAccepted
        ? 'border-success/30 bg-gradient-to-b from-success-subtle to-transparent shadow-[0_8px_30px_-12px_rgba(34,197,94,.4)]'
        : 'panel-sheen border-border bg-surface-glass backdrop-blur-xl backdrop-saturate-150'
    )}
  >
    {answer.isAccepted && (
      <span className="absolute -top-2.5 left-3.5 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 font-body text-[0.59375rem] font-bold uppercase tracking-[0.06em] text-white">
        <Icon name="check" size={11} strokeWidth={3.2} />
        Accepted answer
      </span>
    )}

    <VoteRail
      variant="bare"
      tone={answer.isAccepted ? 'success' : 'accent'}
      score={answer.helpfulCount}
      myVote={answer.myVote}
      onVote={onVote}
      label={`answer by ${answer.authorName}`}
    />

    <div className={clsx('min-w-0 flex-1', answer.isAccepted && 'pt-1.5')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg font-body text-xs font-bold',
            answer.isAccepted
              ? 'bg-success text-white'
              : 'bg-surface-overlay text-text-secondary'
          )}
        >
          {answer.authorName.charAt(0).toUpperCase()}
        </span>
        <span className="font-body text-[0.78125rem] font-semibold text-text-primary">
          {answer.authorName}
        </span>
        <CredibilityBadge
          accuracy={answer.authorCredibility}
          conceptName={conceptName}
          solved={answer.authorSolved}
        />
      </div>

      <p className="whitespace-pre-wrap font-body text-[0.8125rem] leading-[1.62] text-text-secondary">
        {answer.body}
      </p>

      <div className="mt-2.5 flex items-center gap-3">
        {canAccept && (
          <button
            onClick={onAccept}
            className={clsx(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-body text-xs font-semibold transition-colors',
              answer.isAccepted
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-border-strong bg-surface-raised text-text-secondary hover:border-success/40 hover:text-success'
            )}
          >
            <Icon name="check" size={14} strokeWidth={2.6} />
            {answer.isAccepted ? 'Accepted' : 'Accept'}
          </button>
        )}
        <span className="font-body text-[0.6875rem] font-medium text-text-faint">
          {timeAgo(answer.createdAt)}
        </span>
      </div>
    </div>
  </motion.div>
);

const CommentRow = ({
  comment,
  nested,
  isOp,
  onVote,
  onReply,
}: {
  comment: DoubtComment;
  nested?: boolean;
  isOp?: boolean;
  onVote: (value: VoteValue) => void;
  onReply?: () => void;
}) => (
  <div className={clsx('relative flex gap-2.5', nested && 'pl-[22px]')}>
    {nested && (
      <span
        className="absolute bottom-3.5 left-3 top-[-14px] w-px bg-border"
        aria-hidden="true"
      />
    )}
    <span
      className={clsx(
        'grid shrink-0 place-items-center rounded-full bg-surface-overlay font-body font-bold text-text-secondary',
        nested ? 'h-6 w-6 text-[0.625rem]' : 'h-[26px] w-[26px] text-[0.6875rem]'
      )}
    >
      {comment.authorName.charAt(0).toUpperCase()}
    </span>

    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-body text-xs font-semibold text-text-primary">
          {comment.authorName}
        </span>
        {isOp && (
          <span className="rounded bg-accent-subtle px-1.5 py-px font-body text-[0.5625rem] font-bold uppercase tracking-[0.05em] text-accent">
            OP
          </span>
        )}
        <CredibilityBadge accuracy={comment.authorCredibility} size="sm" />
        <span className="font-body text-[0.6875rem] text-text-faint">
          · {timeAgo(comment.createdAt)}
        </span>
      </div>

      <p className="whitespace-pre-wrap font-body text-[0.78125rem] leading-[1.55] text-text-secondary">
        {comment.body}
      </p>

      <div className="mt-1.5 flex items-center gap-4 font-body text-[0.6875rem] font-semibold text-text-muted">
        <button
          onClick={() => onVote(comment.myVote === 1 ? 0 : 1)}
          aria-pressed={comment.myVote === 1}
          className={clsx(
            'inline-flex items-center gap-1 transition-colors hover:text-text-primary',
            comment.myVote === 1 && 'text-accent'
          )}
        >
          <Icon name="chevronUp" size={13} strokeWidth={2.4} />
          {comment.score}
        </button>
        {onReply && (
          <button onClick={onReply} className="transition-colors hover:text-text-primary">
            Reply
          </button>
        )}
      </div>
    </div>
  </div>
);

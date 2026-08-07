import clsx from 'clsx';
import { Icon } from '@/components/ui';
import type { VoteValue } from '@/services/doubts.service';

interface VoteRailProps {
  score: number;
  myVote: VoteValue;
  onVote: (value: VoteValue) => void;
  /** `boxed` for feed cards, `bare` inside a thread. */
  variant?: 'boxed' | 'bare';
  /** Tints the lit arrow green — used on the accepted answer. */
  tone?: 'accent' | 'success';
  disabled?: boolean;
  label: string;
}

/**
 * The vote rail.
 *
 * Pressing the arrow you already chose clears the vote rather than stacking
 * another — the same affordance every voting UI has trained people to expect,
 * and without it there is no way to take a vote back.
 */
export const VoteRail = ({
  score,
  myVote,
  onVote,
  variant = 'boxed',
  tone = 'accent',
  disabled,
  label,
}: VoteRailProps) => {
  const lit = tone === 'success' ? 'text-success' : 'text-accent-hover';
  const glow =
    tone === 'success'
      ? 'drop-shadow(0 0 5px rgba(34,197,94,.55))'
      : 'drop-shadow(0 0 5px var(--radar-glow))';

  const press = (value: VoteValue) => {
    if (disabled) return;
    // Second press on the same arrow is a retraction.
    onVote(myVote === value ? 0 : value);
  };

  return (
    <div
      className={clsx(
        'flex shrink-0 flex-col items-center gap-1',
        variant === 'boxed' && 'rounded-xl border border-border bg-surface-raised px-1.5 py-2'
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          press(1);
        }}
        disabled={disabled}
        aria-label={`Upvote ${label}`}
        aria-pressed={myVote === 1}
        className={clsx(
          'rounded transition-colors disabled:cursor-not-allowed',
          myVote === 1 ? lit : 'text-text-faint hover:text-text-secondary'
        )}
        style={myVote === 1 ? { filter: glow } : undefined}
      >
        <Icon name="chevronUp" size={20} strokeWidth={2.6} />
      </button>

      <span
        className={clsx(
          'font-mono text-[0.8125rem] font-bold tabular-nums',
          myVote === 1 ? lit : myVote === -1 ? 'text-danger' : 'text-text-secondary'
        )}
      >
        {score}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          press(-1);
        }}
        disabled={disabled}
        aria-label={`Downvote ${label}`}
        aria-pressed={myVote === -1}
        className={clsx(
          'rounded transition-colors disabled:cursor-not-allowed',
          myVote === -1 ? 'text-danger' : 'text-text-faint hover:text-text-secondary'
        )}
      >
        <Icon name="chevronDown" size={20} strokeWidth={2.6} />
      </button>
    </div>
  );
};

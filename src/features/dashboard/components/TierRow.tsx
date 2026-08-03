import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from '@/components/ui';

interface TierRowProps {
  /** Rank in the weakness ordering. 0-based; rendered 1-based. */
  index: number;
  name: string;
  /** Weighted accuracy across everything beneath this row. */
  accuracy: number;
  attempts: number;
  /** Concepts under this row, and how many are rated weak or worse. */
  conceptCount: number;
  weakCount: number;
  to: string;
}

/**
 * A section or group row — the two navigable tiers above a concept.
 *
 * Shares the concept ledger's language (rank, sparkbar, right-aligned figure)
 * so drilling feels like moving through one list rather than between three
 * different screens. What differs is the payload: a concept row ends in a
 * drill action, these end in a chevron, because the thing underneath is
 * another list.
 */
export const TierRow = ({
  index,
  name,
  accuracy,
  attempts,
  conceptCount,
  weakCount,
  to,
}: TierRowProps) => {
  // Derived from accuracy rather than a band: the engine bands individual
  // concepts, and there is no honest way to average six bands into one.
  const tone =
    accuracy >= 70
      ? { text: 'text-success', edge: 'var(--success)', bar: 'linear-gradient(90deg, var(--green-600), var(--green-400))' }
      : accuracy >= 45
      ? { text: 'text-accent', edge: 'var(--accent)', bar: 'linear-gradient(90deg, var(--indigo-600), var(--indigo-400))' }
      : { text: 'text-danger', edge: 'var(--danger)', bar: 'linear-gradient(90deg, var(--red-600), var(--red-500))' };

  return (
    <Link
      to={to}
      style={{
        borderLeftColor: tone.edge,
        animationDelay: `${Math.min(index * 50, 400)}ms`,
      }}
      className={clsx(
        'group flex w-full animate-rise items-center gap-3.5 rounded-lg border border-l-[3px] border-border bg-surface p-3.5',
        'transition-[border-color,background,box-shadow] duration-200 ease-out-expo',
        'hover:border-border-strong hover:bg-surface-raised hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      )}
    >
      <span className="w-5 shrink-0 font-mono text-[0.9375rem] font-bold tabular-nums text-text-faint">
        {index + 1}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-[0.9375rem] font-semibold text-text-primary">
          {name}
        </span>

        <span className="mt-1 block font-mono text-[0.6875rem] tabular-nums text-text-muted">
          {conceptCount} concept{conceptCount === 1 ? '' : 's'}
          {weakCount > 0 && (
            <>
              {' · '}
              <span className="text-danger">{weakCount} weak</span>
            </>
          )}
          {' · '}
          {attempts}q
        </span>

        <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-surface-overlay">
          <span
            className="block h-full animate-grow-x rounded-full"
            style={{
              width: `${Math.max(accuracy, 2)}%`,
              background: tone.bar,
              animationDelay: `${Math.min(index * 50, 400) + 150}ms`,
            }}
          />
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2.5">
        <span className="text-right">
          <span className={clsx('block font-mono text-[1.0625rem] font-bold tabular-nums', tone.text)}>
            {accuracy}%
          </span>
          <span className="mt-0.5 block font-body text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            accuracy
          </span>
        </span>
        <Icon
          name="chevronRight"
          size={17}
          strokeWidth={2.4}
          className="text-text-faint transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </span>
    </Link>
  );
};

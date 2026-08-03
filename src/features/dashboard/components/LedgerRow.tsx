import clsx from 'clsx';
import { Icon } from '@/components/ui';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

interface LedgerRowProps {
  subtopic: SubtopicWeakness;
  /** Rank in the weakness ordering. 0-based; rendered 1-based. */
  index: number;
  onDrill: (subtopic: SubtopicWeakness) => void;
  drilling: boolean;
}

/**
 * One line of the weakness ledger.
 *
 * This replaces the old card grid. A ranked list only reads as a ranking if
 * the rows share a baseline and the bars share a left edge — in a grid of
 * cards the eye compares neighbours, not the whole board.
 */
const bandConfig: Record<
  WeaknessBand,
  { label: string; text: string; edge: string; bar: string }
> = {
  critical: {
    label: 'Very weak',
    text: 'text-danger',
    edge: 'var(--danger)',
    bar: 'linear-gradient(90deg, var(--red-600), var(--red-500))',
  },
  weak: {
    label: 'Weak',
    text: 'text-danger',
    edge: 'var(--danger)',
    bar: 'linear-gradient(90deg, var(--red-600), var(--red-500))',
  },
  learning: {
    label: 'Learning',
    text: 'text-info',
    edge: 'var(--info)',
    bar: 'linear-gradient(90deg, var(--blue-500), var(--blue-400))',
  },
  improving: {
    label: 'Improving',
    text: 'text-accent',
    edge: 'var(--accent)',
    bar: 'linear-gradient(90deg, var(--indigo-600), var(--indigo-400))',
  },
  strong: {
    label: 'Mastered',
    text: 'text-success',
    edge: 'var(--success)',
    bar: 'linear-gradient(90deg, var(--green-600), var(--green-400))',
  },
  untested: {
    label: 'New',
    text: 'text-text-muted',
    edge: 'var(--text-faint)',
    bar: 'linear-gradient(90deg, var(--graphite-500), var(--graphite-400))',
  },
};

export const LedgerRow = ({ subtopic, index, onDrill, drilling }: LedgerRowProps) => {
  const config = bandConfig[subtopic.band];

  return (
    <button
      type="button"
      onClick={() => onDrill(subtopic)}
      disabled={drilling}
      aria-label={`Drill ${subtopic.subtopicName} — ${subtopic.accuracy}% accuracy, ${config.label}`}
      style={{
        borderLeftColor: config.edge,
        animationDelay: `${Math.min(index * 50, 400)}ms`,
      }}
      className={clsx(
        'group flex w-full animate-rise items-center gap-3 rounded-lg border border-l-[3px] border-border bg-surface p-3 text-left',
        'transition-[border-color,background,box-shadow] duration-200 ease-out-expo',
        'hover:border-border-strong hover:bg-surface-raised hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:pointer-events-none disabled:opacity-60'
      )}
    >
      <span className="w-5 shrink-0 font-mono text-[0.9375rem] font-bold tabular-nums text-text-faint">
        {index + 1}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-heading text-[0.84375rem] font-semibold text-text-primary">
            {subtopic.subtopicName}
          </span>
          {/* Sample size. A bare 34% reads the same off 3 attempts as off 47,
              and those are very different claims. */}
          <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-text-faint">
            {subtopic.attempts}q
          </span>
          <Icon
            name="arrowRight"
            size={13}
            strokeWidth={2.5}
            className="shrink-0 text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        </span>

        {/* Accuracy as a bar as well as a number — the bar is what makes a
            column of these rows comparable at a glance. */}
        <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-surface-overlay">
          <span
            className="block h-full animate-grow-x rounded-full"
            style={{
              width: `${Math.max(subtopic.accuracy, 2)}%`,
              background: config.bar,
              animationDelay: `${Math.min(index * 50, 400) + 150}ms`,
            }}
          />
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={clsx(
            'block font-mono text-[0.9375rem] font-bold tabular-nums',
            config.text
          )}
        >
          {drilling ? '…' : `${subtopic.accuracy}%`}
        </span>
        <span
          className={clsx(
            'mt-0.5 block font-body text-[0.5625rem] font-semibold uppercase tracking-[0.08em]',
            config.text
          )}
        >
          {config.label}
        </span>
      </span>
    </button>
  );
};

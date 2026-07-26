import { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

export type TopicTone = 'topic-a' | 'topic-b' | 'topic-c' | 'topic-d' | 'accent';

const toneText = {
  'topic-a': 'text-topic-a',
  'topic-b': 'text-topic-b',
  'topic-c': 'text-topic-c',
  'topic-d': 'text-topic-d',
  accent: 'text-accent',
} as const;

/**
 * Selectable topic/section tile.
 *
 * This is a deliberate correction of the pattern it's modelled on. Each rule
 * below fixes a specific defect found in that reference:
 *
 *  1. THE ICON KEEPS ITS IDENTITY COLOUR IN BOTH STATES.
 *     The reference inverted it — coloured glyph when idle, black glyph on a
 *     coloured tile when selected. Since colour was the only thing telling its
 *     four glyphs apart, selecting a tile destroyed the one cue that
 *     identified it.
 *
 *  2. NO NOTCH. The stat lives in a caption under the label, on EVERY tile.
 *     The reference hung it in a tab cut into the selected tile only, which
 *     (a) made the selected tile taller, shoving its icon ~8px above the row's
 *     shared centreline, and (b) left an empty slot on the other three that
 *     read as "not loaded yet" rather than "intentionally hidden".
 *
 *  3. FIXED HEIGHT, NO SCALE ON SELECT. Icon centrelines stay pinned across
 *     the row. The selection ring is drawn with box-shadow so it costs zero
 *     layout, keeping the inter-tile gaps even — the reference's ring ate into
 *     the first gap and broke the row's rhythm.
 *
 *  4. TWO STATE SIGNALS, NOT SIX. Ring + label treatment. The reference stacked
 *     fill, border, glow, label colour, scale and a shape change all at once.
 *
 *  5. STATE IS NOT COLOUR-ONLY. `aria-pressed` carries it for assistive tech,
 *     and the label shifts weight as well as colour (WCAG 1.4.1).
 */

interface TopicTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  icon: IconName;
  label: string;
  tone: TopicTone;
  selected?: boolean;
  /** Caption under the label — accuracy, mastery, question count. */
  stat?: string;
}

export const TopicTile = ({
  icon,
  label,
  tone,
  selected = false,
  stat,
  className,
  ...props
}: TopicTileProps) => (
  <button
    type="button"
    aria-pressed={selected}
    className={clsx(
      'flex w-[5.5rem] flex-shrink-0 flex-col items-center gap-2 rounded-lg p-1',
      'transition-shadow duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      className
    )}
    {...props}
  >
    {/* Fixed-size icon well. Height never changes, so the row keeps one
        optical baseline whether a tile is selected or not. */}
    <span
      className={clsx(
        'flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-lg',
        'bg-surface-raised transition-shadow duration-200',
        // Ring is box-shadow based: no layout cost, so gaps stay even.
        selected ? 'shadow-[0_0_0_2px_var(--accent)]' : 'shadow-none'
      )}
    >
      {/* Identity colour is constant across states — see rule 1. */}
      <Icon name={icon} size={28} strokeWidth={2} className={toneText[tone]} />
    </span>

    <span className="flex flex-col items-center gap-0.5">
      <span
        className={clsx(
          'font-body text-xs uppercase tracking-wider transition-colors',
          selected ? 'font-bold text-text-primary' : 'font-medium text-text-muted'
        )}
      >
        {label}
      </span>
      {/* Rendered for every tile, so the row is comparable at a glance. */}
      {stat && (
        <span
          className={clsx(
            'font-body text-[0.6875rem] font-semibold tabular-nums transition-colors',
            selected ? 'text-text-secondary' : 'text-text-muted opacity-70'
          )}
        >
          {stat}
        </span>
      )}
    </span>
  </button>
);

/** Horizontally scrollable rail. Edge padding lets the last tile clear the gutter. */
export const TopicTileRow = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx(
      'flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]',
      '[&::-webkit-scrollbar]:hidden',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

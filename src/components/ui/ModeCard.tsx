import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Display, Eyebrow } from './Display';
import { Icon } from './Icon';

/**
 * Large editorial card for choosing a mode (Weakness Hunt, Mock, Topic Drill).
 *
 * Fixes applied vs. the reference this pattern is drawn from:
 *  - The WHOLE card is the button, so the tap target is the full surface
 *    rather than a sub-44px chevron.
 *  - The description is SENTENCE CASE and uses --text-secondary. In the
 *    reference this line was small, grey and uppercase — simultaneously the
 *    only text explaining what the mode does and the hardest text to read.
 *  - `meta` chips carry the distinguishing facts (duration, question count)
 *    up into the scannable layer. Two cards that both say "fast" and differ
 *    only in a buried subtitle are two cards a user cannot tell apart.
 *  - The chevron aligns to the headline's optical centre, not the card's, so
 *    it doesn't drift low against a two-line title.
 */

interface ModeCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  description: string;
  /** Short uppercase kicker. Omit it when the surrounding context already says this. */
  eyebrow?: string;
  /** Scannable facts — "12 min", "20 questions". Keep to 3 max. */
  meta?: string[];
  /** Identity tint for the accent rule and chevron. */
  tone?: 'accent' | 'topic-a' | 'topic-b' | 'topic-c' | 'topic-d';
}

const toneText = {
  accent: 'text-accent',
  'topic-a': 'text-topic-a',
  'topic-b': 'text-topic-b',
  'topic-c': 'text-topic-c',
  'topic-d': 'text-topic-d',
} as const;

const toneBg = {
  accent: 'bg-accent',
  'topic-a': 'bg-topic-a',
  'topic-b': 'bg-topic-b',
  'topic-c': 'bg-topic-c',
  'topic-d': 'bg-topic-d',
} as const;

export const ModeCard = ({
  title,
  description,
  eyebrow,
  meta,
  tone = 'accent',
  className,
  ...props
}: ModeCardProps) => (
  <button
    type="button"
    className={clsx(
      'group relative w-full overflow-hidden rounded-2xl bg-surface p-5 text-left',
      'border border-border transition-all duration-200',
      'hover:border-border-strong hover:bg-surface-raised',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'active:scale-[0.99]',
      className
    )}
    {...props}
  >
    {/* Identity rule down the leading edge — carries the tone without
        recolouring the whole card. */}
    <span className={clsx('absolute inset-y-0 left-0 w-1', toneBg[tone])} aria-hidden="true" />

    <div className="flex items-start justify-between gap-4 pl-2">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <Eyebrow className={clsx('mb-2 block', toneText[tone])}>{eyebrow}</Eyebrow>
        )}

        <Display as="h3" size="md" className="mb-2 break-words">
          {title}
        </Display>

        {/* Sentence case, secondary — readable, not decorative. */}
        <p className="font-body text-sm leading-relaxed text-text-secondary">{description}</p>

        {meta && meta.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-1.5">
            {meta.map((item) => (
              <li
                key={item}
                className="rounded-sm bg-surface-raised px-2 py-1 font-body text-[0.6875rem] font-semibold uppercase tracking-wider text-text-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Icon
        name="chevronRight"
        size={22}
        strokeWidth={2.5}
        className={clsx(
          'mt-1 transition-transform duration-200 group-hover:translate-x-1',
          toneText[tone]
        )}
      />
    </div>
  </button>
);

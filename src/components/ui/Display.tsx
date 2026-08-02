import { ElementType, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Editorial headline.
 *
 * Previously set in Anton — a single-weight condensed face, forced to
 * UPPERCASE on every h1/h2 in the app. That combination is what made Refyn
 * read as a sports poster rather than an analysis tool, and it meant any
 * `font-bold` on a heading produced a synthesized fake bold.
 *
 * Now Sora, which has a real weight axis. Rules that carry over:
 *  - Tracking tightens as size grows. Large type set at default tracking is
 *    the single most common tell of an unstyled app.
 *  - Sentence case. Uppercase belongs to <Eyebrow>, where strings are short.
 */

const sizes = {
  xs: 'text-lg leading-tight tracking-[-0.02em]',
  sm: 'text-[1.375rem] leading-tight tracking-[-0.025em]',
  md: 'text-[1.75rem] leading-[1.1] tracking-[-0.03em]',
  lg: 'text-[2.25rem] leading-[1.05] tracking-[-0.035em] lg:text-[2.75rem]',
  xl: 'text-[2.75rem] leading-[1.02] tracking-[-0.04em] lg:text-[3.5rem]',
} as const;

interface DisplayProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  size?: keyof typeof sizes;
  as?: ElementType;
  /** Tint a trailing fragment in the accent colour. */
  accentPart?: ReactNode;
  /** Fade the headline into a subtle vertical gradient. Use once per screen. */
  gradient?: boolean;
}

export const Display = ({
  children,
  size = 'md',
  as: Tag = 'h2',
  accentPart,
  gradient = false,
  className,
  ...props
}: DisplayProps) => (
  <Tag
    className={clsx(
      'text-balance font-display font-bold',
      gradient ? 'text-gradient' : 'text-text-primary',
      sizes[size],
      className
    )}
    {...props}
  >
    {children}
    {accentPart && <span className="text-accent"> {accentPart}</span>}
  </Tag>
);

/**
 * Small uppercase label — section headers, chips, metadata.
 * This is the ONLY place uppercase belongs. Full sentences stay sentence-case:
 * uppercase destroys word-shape recognition and is the slowest text to read.
 */
export const Eyebrow = ({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={clsx(
      'font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-secondary',
      className
    )}
    {...props}
  >
    {children}
  </span>
);

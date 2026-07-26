import { ElementType, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Editorial headline set in Anton.
 *
 * Anton has ONE weight (400). Never apply font-bold/font-semibold to it —
 * the browser will synthesize a fake bold and the stems smear. The weight is
 * baked into the face; size and tracking are the only levers.
 *
 * Do not use below `sm`. Condensed heavy faces collapse at small sizes; for
 * anything under ~20px use <Eyebrow> or plain body type instead.
 */

const sizes = {
  sm: 'text-2xl leading-none',
  md: 'text-[2rem] leading-none',
  lg: 'text-[2.75rem] leading-[0.95]',
  xl: 'text-[3.5rem] leading-[0.9]',
} as const;

interface DisplayProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  size?: keyof typeof sizes;
  as?: ElementType;
  /** Tint a trailing fragment in the accent colour, like the reference's "STARTER QUEST". */
  accentPart?: ReactNode;
}

export const Display = ({
  children,
  size = 'md',
  as: Tag = 'h2',
  accentPart,
  className,
  ...props
}: DisplayProps) => (
  <Tag
    className={clsx(
      'font-display font-normal uppercase tracking-[0.01em] text-text-primary',
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

import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Legacy card wrapper, kept for the screens that still use its sub-parts.
 * New surfaces should use <Panel> — it carries the elevation scale, the glass
 * variant and the lit edge. This now renders on the same visual footing so the
 * two never look like two different design systems side by side.
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  borderColor?: 'accent' | 'danger' | 'success' | 'muted';
}

const accentRules = {
  accent: 'before:bg-accent',
  danger: 'before:bg-danger',
  success: 'before:bg-success',
  muted: 'before:bg-border-strong',
} as const;

export const Card = ({
  children,
  className,
  elevated = false,
  borderColor,
  ...props
}: CardProps) => (
  <div
    className={clsx(
      'relative overflow-hidden rounded-xl border border-border p-5 lg:p-6',
      elevated ? 'bg-surface-raised shadow-lg' : 'bg-surface shadow-sm',
      // Identity rule as a pseudo-element rather than border-l-4, so the
      // padding stays identical whether or not a card is tinted.
      borderColor &&
        clsx(
          'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
          accentRules[borderColor]
        ),
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={clsx(
      'font-heading text-[1.0625rem] font-semibold tracking-[-0.015em] text-text-primary',
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={clsx('mt-1 font-body text-[0.8125rem] text-text-muted', className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx(className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('mt-5 flex gap-2 border-t border-border pt-5', className)} {...props}>
    {children}
  </div>
);

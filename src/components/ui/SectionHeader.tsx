import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Eyebrow } from './Display';

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Optional trailing action — "View all". Keep it in the accent colour;
      never introduce a third accent hue for a secondary link. */
  action?: ReactNode;
}

export const SectionHeader = ({ title, action, className, ...props }: SectionHeaderProps) => (
  <div className={clsx('mb-3 flex items-center justify-between gap-4', className)} {...props}>
    <Eyebrow className="text-text-muted">{title}</Eyebrow>
    {action}
  </div>
);

export const SectionAction = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={clsx(
      'font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-accent',
      'transition-opacity hover:opacity-80',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-xs',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

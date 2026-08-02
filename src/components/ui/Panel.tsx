import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';
import { Eyebrow } from './Display';

/**
 * The surface primitive.
 *
 * Replaces the old `Card` treatment of `bg-surface rounded-sm shadow-md`,
 * which gave every panel the same 8px radius and the same stock one-layer
 * shadow. Depth here is a real scale, and `glass` panels let the ambient
 * background bleed through instead of stamping an opaque rectangle over it.
 */

const tones = {
  default: 'border-border',
  accent: 'border-accent-muted',
  danger: 'border-danger/25',
  success: 'border-success/25',
} as const;

const elevations = {
  flat: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
} as const;

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Translucent + blurred, so the aurora reads through the panel. */
  glass?: boolean;
  elevation?: keyof typeof elevations;
  tone?: keyof typeof tones;
  /** Lit hairline across the top edge. Reads as a surface catching light. */
  lit?: boolean;
  /** Lift and brighten the border on hover. Use for clickable panels only. */
  interactive?: boolean;
  padded?: boolean;
}

export const Panel = ({
  children,
  glass = false,
  elevation = 'sm',
  tone = 'default',
  lit = true,
  interactive = false,
  padded = true,
  className,
  ...props
}: PanelProps) => (
  <div
    className={clsx(
      'relative overflow-hidden rounded-xl border',
      glass
        ? 'bg-surface-glass backdrop-blur-xl backdrop-saturate-150'
        : 'bg-surface',
      tones[tone],
      elevations[elevation],
      lit && 'edge-lit',
      padded && 'p-5 lg:p-6',
      interactive &&
        'transition-[transform,box-shadow,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

interface PanelHeaderProps {
  title: ReactNode;
  /** Right-aligned count, control, or badge. */
  aside?: ReactNode;
  icon?: IconName;
  className?: string;
}

export const PanelHeader = ({ title, aside, icon, className }: PanelHeaderProps) => (
  <div className={clsx('mb-4 flex items-center justify-between gap-4', className)}>
    <span className="flex min-w-0 items-center gap-2">
      {icon && <Icon name={icon} size={14} className="shrink-0 text-text-faint" />}
      <Eyebrow className="truncate text-text-muted">{title}</Eyebrow>
    </span>
    {aside && <span className="shrink-0">{aside}</span>}
  </div>
);

const statTones = {
  default: 'text-text-primary',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
} as const;

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Unit suffix rendered small and muted after the value. */
  unit?: string;
  icon?: IconName;
  /** Short qualifier under the value — "vs last week", "3 attempted". */
  hint?: ReactNode;
  tone?: keyof typeof statTones;
  className?: string;
}

/**
 * The dashboard number tile. Value first at display scale, label above it in
 * the quiet layer — the reverse of the old stat blocks, which led with a small
 * grey caption and made the figure itself the second thing you read.
 */
export const StatCard = ({
  label,
  value,
  unit,
  icon,
  hint,
  tone = 'default',
  className,
}: StatCardProps) => (
  <Panel padded={false} className={clsx('p-4 lg:p-5', className)}>
    <div className="mb-2.5 flex items-center gap-1.5">
      {icon && <Icon name={icon} size={13} className="text-text-faint" />}
      <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </span>
    </div>

    <div className="flex items-baseline gap-1">
      <span
        className={clsx(
          'font-display text-[1.75rem] font-bold leading-none tracking-[-0.03em] tabular-nums lg:text-[2rem]',
          statTones[tone]
        )}
      >
        {value}
      </span>
      {unit && (
        <span className="font-body text-sm font-medium text-text-muted">{unit}</span>
      )}
    </div>

    {hint && (
      <p className="mt-2 font-body text-xs leading-snug text-text-faint">{hint}</p>
    )}
  </Panel>
);

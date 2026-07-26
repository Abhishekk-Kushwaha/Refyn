import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

/**
 * Compact stat readout for the app header (streak, XP, accuracy...).
 *
 * Two rules carried over from the audit:
 *  - All pills use the SAME icon treatment. Mixing outline / solid / illustrated
 *    icons across three adjacent pills is what makes a stat bar look assembled
 *    rather than designed.
 *  - Every value carries a unit or a label. A bare "0" next to a flame tells
 *    the user nothing.
 */

interface StatPillProps extends HTMLAttributes<HTMLDivElement> {
  icon: IconName;
  value: string | number;
  /** Unit or noun. Renders muted after the value — "12 day", "340 XP". */
  unit?: string;
  /** Screen-reader description, since the icon alone is not a label. */
  label: string;
  /** Tint the icon. Defaults to inheriting muted text. */
  tone?: 'accent' | 'default';
}

export const StatPill = ({
  icon,
  value,
  unit,
  label,
  tone = 'default',
  className,
  ...props
}: StatPillProps) => (
  <div
    className={clsx(
      'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5',
      className
    )}
    {...props}
  >
    <Icon
      name={icon}
      size={15}
      className={tone === 'accent' ? 'text-accent' : 'text-text-muted'}
    />
    <span className="font-body text-sm font-bold tabular-nums text-text-primary">{value}</span>
    {unit && <span className="font-body text-xs font-medium text-text-muted">{unit}</span>}
    <span className="sr-only">{label}</span>
  </div>
);

export const StatBar = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('flex items-center gap-2', className)} {...props}>
    {children}
  </div>
);

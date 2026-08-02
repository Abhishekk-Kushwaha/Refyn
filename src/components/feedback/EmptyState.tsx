import { ReactNode } from 'react';
import clsx from 'clsx';
import { Button, Icon, type IconName } from '@/components/ui';

/**
 * Empty and error states.
 *
 * The 5xl emoji that used to lead these has been replaced by a framed glyph
 * from the app's own icon set — an emoji renders as a different picture on
 * every platform, which is why it never reads as part of the product.
 * `icon` still accepts a string so existing callers keep working; a string is
 * now treated as a hint rather than rendered raw.
 */

interface EmptyStateProps {
  /** Icon name from the Refyn set, or a legacy emoji string (mapped below). */
  icon?: IconName | string | ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Legacy emoji call sites → a real glyph. */
const emojiFallback: Record<string, IconName> = {
  '🎯': 'practice',
  '📚': 'flashcards',
  '💬': 'board',
  '📊': 'dashboard',
  '✅': 'check',
  '📭': 'board',
  '⚠️': 'alert',
};

const resolveIcon = (icon: unknown): IconName => {
  if (typeof icon !== 'string') return 'spark';
  if (icon in emojiFallback) return emojiFallback[icon];
  return 'spark';
};

const Frame = ({ name, tone }: { name: IconName; tone: 'default' | 'danger' }) => (
  <span
    className={clsx(
      'mb-5 grid h-14 w-14 place-items-center rounded-2xl border',
      tone === 'danger'
        ? 'border-danger/25 bg-danger-subtle text-danger'
        : 'border-border bg-surface-raised text-text-muted'
    )}
    aria-hidden="true"
  >
    <Icon name={name} size={24} strokeWidth={1.75} />
  </span>
);

export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <div
    className={clsx(
      'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center',
      className
    )}
  >
    <Frame name={resolveIcon(icon)} tone="default" />

    <h3 className="font-display text-xl font-bold tracking-[-0.025em] text-text-primary">
      {title}
    </h3>

    {description && (
      <p className="mt-2.5 max-w-md font-body text-sm leading-relaxed text-text-muted">
        {description}
      </p>
    )}

    {action && (
      <Button onClick={action.onClick} className="mt-6" trailingIcon="arrowRight">
        {action.label}
      </Button>
    )}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  icon?: string;
  className?: string;
}

export const ErrorState = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) => (
  <div
    className={clsx(
      'flex flex-col items-center justify-center rounded-2xl border border-danger/20 bg-danger-subtle/40 px-6 py-16 text-center',
      className
    )}
  >
    <Frame name="alert" tone="danger" />

    <h3 className="font-display text-xl font-bold tracking-[-0.025em] text-text-primary">
      {title}
    </h3>

    <p className="mt-2.5 max-w-md font-body text-sm leading-relaxed text-text-muted">{message}</p>

    {onRetry && (
      <Button onClick={onRetry} variant="secondary" icon="refresh" className="mt-6">
        Try again
      </Button>
    )}
  </div>
);

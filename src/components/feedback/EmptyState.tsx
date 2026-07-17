import { ReactNode } from 'react';
import { Button } from '@/components/ui';
import clsx from 'clsx';

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState = ({
  icon = '📭',
  title,
  description,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      <div className="text-5xl mb-4">
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-text-secondary mb-6 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

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
  icon = '⚠️',
  className,
}: ErrorStateProps) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-text-secondary mb-6 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
};

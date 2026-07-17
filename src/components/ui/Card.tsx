import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  borderColor?: 'accent' | 'danger' | 'success' | 'muted';
}

export const Card = ({
  children,
  className,
  elevated = false,
  borderColor,
  ...props
}: CardProps) => {
  const borderClasses = {
    accent: 'border-l-4 border-l-accent',
    danger: 'border-l-4 border-l-danger',
    success: 'border-l-4 border-l-success',
    muted: 'border border-border',
  };

  return (
    <div
      className={clsx(
        'bg-surface rounded-sm p-4 transition-all duration-200',
        elevated && 'bg-surface-raised shadow-lg',
        !elevated && 'shadow-md',
        borderColor && borderClasses[borderColor],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('mb-3', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={clsx('text-lg font-semibold text-text-primary', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={clsx('text-sm text-text-muted mt-1', className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('flex gap-2 mt-4 pt-4 border-t border-border', className)} {...props}>
    {children}
  </div>
);

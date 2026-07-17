import { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-semibold text-xs px-2 py-1 transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent-subtle text-accent',
        success: 'bg-success-subtle text-success',
        danger: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
        muted: 'bg-border text-text-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  children: ReactNode;
  icon?: ReactNode;
}

export const Badge = ({ children, className, variant, icon, ...props }: BadgeProps) => {
  return (
    <div
      className={clsx(badgeVariants({ variant }), className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </div>
  );
};

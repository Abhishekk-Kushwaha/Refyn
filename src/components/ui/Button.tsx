import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-accent',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover shadow-md hover:shadow-lg',
        secondary: 'bg-surface-raised text-text-primary border border-border hover:bg-surface hover:border-border-strong',
        ghost: 'text-text-primary hover:text-accent hover:bg-surface-raised',
        danger: 'bg-danger text-white hover:bg-red-600',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-12 px-6 text-base min-w-48',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = ({
  className,
  variant,
  size,
  fullWidth,
  children,
  loading,
  icon,
  disabled,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={clsx(
        buttonVariants({ variant, size, fullWidth }),
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

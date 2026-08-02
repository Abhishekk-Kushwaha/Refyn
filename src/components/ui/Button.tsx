import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-body font-semibold tracking-[-0.01em]',
    'transition-[background,box-shadow,transform,border-color,color] duration-150 ease-out-expo',
    'disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'active:translate-y-px',
  ],
  {
    variants: {
      variant: {
        // Gradient fill + coloured glow. This is the only element on a screen
        // allowed to glow, which is what keeps it reading as *the* action.
        primary:
          'bg-gradient-accent text-white shadow-glow-soft hover:shadow-glow hover:brightness-[1.07]',
        secondary:
          'border border-border-strong bg-surface-raised text-text-primary shadow-xs hover:border-text-faint hover:bg-surface-overlay',
        ghost:
          'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
        subtle:
          'bg-accent-subtle text-accent hover:bg-accent-muted',
        danger:
          'bg-danger text-white shadow-sm hover:bg-danger-hover',
      },
      size: {
        xs: 'h-8 rounded-md px-2.5 text-xs',
        sm: 'h-9 rounded-md px-3.5 text-[0.8125rem]',
        md: 'h-10 rounded-lg px-4 text-sm',
        lg: 'h-12 rounded-lg px-6 text-[0.9375rem]',
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
  /** Icon name from the Refyn set, rendered before the label. */
  icon?: IconName;
  /** Icon rendered after the label — use for directional actions. */
  trailingIcon?: IconName;
}

export const Button = ({
  className,
  variant,
  size,
  fullWidth,
  children,
  loading,
  icon,
  trailingIcon,
  disabled,
  ...props
}: ButtonProps) => (
  <button
    className={clsx(buttonVariants({ variant, size, fullWidth }), className)}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading ? (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    ) : (
      icon && <Icon name={icon} size={16} strokeWidth={2.25} />
    )}

    {children}

    {trailingIcon && !loading && (
      <Icon name={trailingIcon} size={16} strokeWidth={2.25} />
    )}
  </button>
);

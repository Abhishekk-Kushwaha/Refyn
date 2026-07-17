import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'accent' | 'white';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

const colorClasses = {
  accent: 'border-accent border-t-transparent',
  white: 'border-white border-t-transparent',
};

export const Spinner = ({ size = 'md', color = 'accent', className }: SpinnerProps) => {
  return (
    <div
      className={clsx(
        'inline-block rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    />
  );
};

export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg">
    <Spinner size="lg" />
  </div>
);

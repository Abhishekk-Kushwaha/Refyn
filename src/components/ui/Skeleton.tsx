import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  count?: number;
}

/**
 * Uses the `.skeleton` class from globals.css, which sweeps a transform-only
 * overlay. The previous implementation animated `background-position` across a
 * 1000px gradient — a full repaint of every placeholder, every frame.
 */
export const Skeleton = ({ className, count = 1 }: SkeletonProps) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={clsx('skeleton rounded-md', className)} aria-hidden="true" />
    ))}
  </>
);

export const SkeletonCard = () => (
  <div className="space-y-3 rounded-xl border border-border bg-surface p-5 lg:p-6">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export const SkeletonRadar = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <Skeleton className="h-48 w-48 rounded-full" />
  </div>
);

export const SkeletonAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  return <Skeleton className={clsx(sizeClasses[size], 'rounded-full')} />;
};

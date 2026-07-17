import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton = ({ className, count = 1 }: SkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'bg-skeleton rounded-md animate-shimmer',
            className
          )}
        />
      ))}
    </>
  );
};

export const SkeletonCard = () => (
  <div className="bg-surface rounded-sm p-4 shadow-md space-y-3">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export const SkeletonRadar = () => (
  <div className="flex items-center justify-center w-full h-64">
    <div className="relative w-48 h-48">
      <Skeleton className="absolute inset-0 rounded-full" />
    </div>
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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui';

export interface TimerHandle {
  getElapsedSeconds: () => number;
  reset: () => void;
}

interface TimerProps {
  warnAtSeconds?: number;
  className?: string;
}

/**
 * Isolated so its 1s tick only re-renders this component, never the parent
 * question view — critical for a smooth practice session (see Architecture doc,
 * Performance Baseline: "Timer via useRef").
 */
export const Timer = forwardRef<TimerHandle, TimerProps>(({ warnAtSeconds, className }, ref) => {
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const secondsRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      secondsRef.current += 1;
      setDisplaySeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    getElapsedSeconds: () => secondsRef.current,
    reset: () => {
      secondsRef.current = 0;
      setDisplaySeconds(0);
    },
  }));

  const mm = Math.floor(displaySeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (displaySeconds % 60).toString().padStart(2, '0');
  const isWarning = warnAtSeconds !== undefined && displaySeconds >= warnAtSeconds;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
        isWarning
          ? 'border-danger/30 bg-danger-subtle text-danger'
          : 'border-border bg-surface-raised text-text-primary',
        className
      )}
      role="timer"
      aria-label={`Elapsed time ${mm} minutes ${ss} seconds`}
    >
      <Icon name="clock" size={15} className={isWarning ? 'text-danger' : 'text-text-faint'} />
      <span className="font-mono text-base font-bold tabular-nums tracking-tight">
        {mm}:{ss}
      </span>
    </div>
  );
});

Timer.displayName = 'Timer';

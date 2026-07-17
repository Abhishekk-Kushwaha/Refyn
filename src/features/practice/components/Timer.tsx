import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';

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
        'font-mono font-bold text-lg px-3 py-1.5 rounded-md transition-colors',
        isWarning ? 'bg-danger-subtle text-danger' : 'bg-surface-raised text-text-primary',
        className
      )}
    >
      ⏱️ {mm}:{ss}
    </div>
  );
});

Timer.displayName = 'Timer';

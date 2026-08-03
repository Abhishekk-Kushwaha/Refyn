import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';

export interface TimerHandle {
  getElapsedSeconds: () => number;
  reset: () => void;
}

interface TimerProps {
  /** Pace budget for this question. Drives the ring and the warning flip. */
  warnAtSeconds?: number;
  className?: string;
}

const RADIUS = 19;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The pace ring.
 *
 * Isolated so its 1s tick only re-renders this component, never the parent
 * question view — critical for a smooth practice session (see Architecture doc,
 * Performance Baseline: "Timer via useRef").
 *
 * A ring rather than a readout because pace is a ratio, not a duration: what
 * matters mid-question is how much of the budget is gone, and a bare mm:ss
 * makes you do that division yourself.
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

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = (displaySeconds % 60).toString().padStart(2, '0');
  const isWarning = warnAtSeconds !== undefined && displaySeconds >= warnAtSeconds;

  // With no budget to measure against there is no ratio to draw, so the ring
  // fills as a plain 60-second sweep rather than pretending to know the pace.
  const budget = warnAtSeconds && warnAtSeconds > 0 ? warnAtSeconds : 60;
  const fraction = Math.min(1, displaySeconds / budget);

  return (
    <div
      className={clsx('relative h-[46px] w-[46px] shrink-0', className)}
      role="timer"
      aria-label={`Elapsed time ${minutes} minutes ${seconds} seconds${
        isWarning ? ' — over the expected pace' : ''
      }`}
    >
      <svg viewBox="0 0 46 46" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="23"
          cy="23"
          r={RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth="3.5"
        />
        <circle
          cx="23"
          cy="23"
          r={RADIUS}
          fill="none"
          stroke={isWarning ? 'var(--danger)' : 'var(--accent)'}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 200ms ease' }}
        />
      </svg>

      <span
        className={clsx(
          'absolute inset-0 grid place-items-center font-mono text-[0.6875rem] font-bold tabular-nums',
          isWarning ? 'text-danger' : 'text-text-primary'
        )}
      >
        {minutes}:{seconds}
      </span>
    </div>
  );
});

Timer.displayName = 'Timer';

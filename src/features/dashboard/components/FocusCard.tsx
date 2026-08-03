import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Icon } from '@/components/ui';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

interface FocusCardProps {
  subtopic: SubtopicWeakness;
  /** Coaching prose. Never contains the learner's own figures — see below. */
  message: string;
  loading: boolean;
  onDrill: (subtopic: SubtopicWeakness) => void;
  drilling: boolean;
}

/** 34s / 2m 10s — seconds alone stop reading as a duration past a minute. */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

/**
 * True when they spend materially longer on questions they get wrong than on
 * ones they get right — the expensive habit in a timed paper, since both the
 * marks and the minutes are lost. Needs a real gap, not a few seconds.
 */
const sinkingTime = (s: { avgSecondsCorrect: number | null; avgSecondsIncorrect: number | null }) =>
  s.avgSecondsCorrect !== null &&
  s.avgSecondsIncorrect !== null &&
  s.avgSecondsIncorrect > s.avgSecondsCorrect * 1.5 &&
  s.avgSecondsIncorrect - s.avgSecondsCorrect >= 30;

const bandLabel: Record<WeaknessBand, string> = {
  critical: 'Weakest area',
  weak: 'Weak spot',
  learning: 'Still shaky',
  improving: 'Trending up',
  strong: 'Keep it sharp',
  untested: 'Blind spot',
};

/** The band label is the one place on this card allowed to raise an alarm. */
const bandTone: Record<WeaknessBand, string> = {
  critical: 'text-danger',
  weak: 'text-danger',
  learning: 'text-info',
  improving: 'text-accent',
  strong: 'text-success',
  untested: 'text-text-muted',
};

/** One figure with its caption. Keeps the metric row on a single baseline. */
const Metric = ({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'danger';
}) => (
  <div className="min-w-0">
    <div
      className={clsx(
        'font-mono text-[1.0625rem] font-bold leading-none tracking-[-0.02em] tabular-nums',
        tone === 'danger' ? 'text-danger' : 'text-text-primary'
      )}
    >
      {value}
    </div>
    <div className="mt-1.5 truncate font-body text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-text-faint">
      {label}
    </div>
  </div>
);

export const FocusCard = ({ subtopic, message, loading, onDrill, drilling }: FocusCardProps) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-accent-muted p-5 lg:p-6"
    style={{
      // The lit field the card sits in. Deliberately a plain vertical wash
      // rather than the 135° brand gradient: this panel sits next to the
      // gradient CTA it contains, and two gradients fight.
      background:
        'linear-gradient(180deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.03) 100%)',
    }}
  >
    <div className="relative flex flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.13em] text-accent">
          Today&rsquo;s focus
        </span>
        <span
          className={clsx(
            'font-body text-[0.65625rem] font-bold uppercase tracking-[0.1em]',
            loading ? 'text-text-muted' : bandTone[subtopic.band]
          )}
        >
          {loading ? 'Analysing' : bandLabel[subtopic.band]}
        </span>
      </div>

      {/* Nothing about the concept is shown until the choice is final. The model
          picks the concept, not just the prose, and it may overrule the engine —
          rendering the engine's pick first would flash one topic and then swap
          it for another, which reads as a glitch. */}
      {loading ? (
        <div className="mt-3 flex-1 space-y-3" aria-hidden>
          <div className="skeleton h-7 w-3/5 rounded-lg" />
          <div className="skeleton h-3 w-2/5 rounded" />
          <div className="skeleton mt-5 h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      ) : (
        <div className="flex-1">
          <h2 className="mt-1.5 text-balance font-heading text-xl font-semibold tracking-[-0.01em] text-text-primary lg:text-2xl">
            {subtopic.subtopicName}
          </h2>

          {/* The figures, in one mono line. Tabular so they line up with the
              ledger rows underneath. */}
          <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
            {subtopic.topicName} ·{' '}
            <span className={bandTone[subtopic.band]}>{subtopic.accuracy}% accuracy</span> ·{' '}
            {subtopic.attempts} attempted
          </p>

          <p className="mt-2.5 max-w-prose font-body text-[0.8125rem] leading-relaxed text-text-secondary">
            {message}
          </p>

          {/* Real figures come from the engine and are rendered here rather
              than asked of the model, so they cannot be misremembered.
              Timing shows as two figures, not one average, because the gap is
              the point: minutes sunk into questions that still come out wrong
              is a different problem from simply being slow. */}
          {(subtopic.avgSecondsCorrect !== null || subtopic.avgSecondsIncorrect !== null) && (
            <div className="mt-4 flex gap-8 border-t border-accent-muted/60 pt-4">
              {subtopic.avgSecondsCorrect !== null && (
                <Metric
                  value={formatDuration(subtopic.avgSecondsCorrect)}
                  label="When right"
                />
              )}
              {subtopic.avgSecondsIncorrect !== null && (
                <Metric
                  value={formatDuration(subtopic.avgSecondsIncorrect)}
                  label="When wrong"
                  tone={sinkingTime(subtopic) ? 'danger' : undefined}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* The one control on the home screen that breathes. Not a <Button>:
          this is the only full-bleed pulsing CTA in the app, and pushing that
          treatment into the shared variant set would licence it everywhere. */}
      <button
        type="button"
        onClick={() => onDrill(subtopic)}
        disabled={drilling || loading}
        aria-busy={drilling || undefined}
        className={clsx(
          'mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent',
          'font-body text-sm font-semibold tracking-[-0.01em] text-accent-text shadow-glow',
          'transition-[filter,transform] duration-150 ease-out-expo hover:brightness-[1.07] active:translate-y-px',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:pointer-events-none disabled:opacity-45',
          !drilling && !loading && 'animate-pulse-glow'
        )}
      >
        {drilling ? (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {loading ? 'Picking your focus…' : drilling ? 'Loading…' : 'Drill this now'}
        {!loading && !drilling && <Icon name="arrowRight" size={17} strokeWidth={2.4} />}
      </button>
    </div>
  </motion.section>
);

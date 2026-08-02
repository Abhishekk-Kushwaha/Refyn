import { motion } from 'framer-motion';
import { Button, Eyebrow, Icon } from '@/components/ui';
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
      className={`font-display text-xl font-bold leading-none tracking-[-0.03em] tabular-nums ${
        tone === 'danger' ? 'text-danger' : 'text-text-primary'
      }`}
    >
      {value}
    </div>
    <div className="mt-1.5 truncate font-body text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-text-faint">
      {label}
    </div>
  </div>
);

export const FocusCard = ({ subtopic, message, loading, onDrill, drilling }: FocusCardProps) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-accent-muted bg-surface p-6 shadow-lg lg:p-8"
  >
    {/* Accent field behind the hero. Sits under the content, never over it. */}
    <div
      className="pointer-events-none absolute inset-0 bg-gradient-accent-soft"
      aria-hidden="true"
    />
    <div
      className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent/20 blur-[90px]"
      aria-hidden="true"
    />

    <div className="relative flex flex-1 flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-muted bg-accent-subtle px-2.5 py-1">
          <Icon name="spark" size={12} className="text-accent" />
          <Eyebrow className="text-accent">Today&rsquo;s focus</Eyebrow>
        </span>
        <Eyebrow className="text-text-muted">
          {loading ? 'Analysing' : bandLabel[subtopic.band]}
        </Eyebrow>
      </div>

      {/* Nothing about the concept is shown until the choice is final. The model
          picks the concept, not just the prose, and it may overrule the engine —
          rendering the engine's pick first would flash one topic and then swap
          it for another, which reads as a glitch. */}
      {loading ? (
        <div className="flex-1 space-y-3" aria-hidden>
          <div className="skeleton h-9 w-3/5 rounded-lg" />
          <div className="skeleton h-3 w-2/5 rounded" />
          <div className="skeleton mt-6 h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      ) : (
        <div className="flex-1">
          <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            {subtopic.topicName}
          </p>

          <h2 className="text-balance font-display text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary lg:text-[2.125rem]">
            {subtopic.subtopicName}
          </h2>

          <p className="mt-4 max-w-prose font-body text-[0.9375rem] leading-relaxed text-text-secondary">
            {message}
          </p>

          {/* Real figures come from the engine and are rendered here rather
              than asked of the model, so they cannot be misremembered.
              Timing shows as two figures, not one average, because the gap is
              the point: minutes sunk into questions that still come out wrong
              is a different problem from simply being slow. */}
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
            <Metric value={`${subtopic.accuracy}%`} label="Accuracy" />
            <Metric value={String(subtopic.attempts)} label="Attempted" />
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
        </div>
      )}

      <div className="mt-7">
        <Button
          size="lg"
          onClick={() => onDrill(subtopic)}
          disabled={drilling || loading}
          loading={drilling}
          trailingIcon={drilling ? undefined : 'arrowRight'}
          className="w-full sm:w-auto"
        >
          {loading ? 'Picking your focus…' : drilling ? 'Loading…' : 'Drill this concept'}
        </Button>
      </div>
    </div>
  </motion.section>
);

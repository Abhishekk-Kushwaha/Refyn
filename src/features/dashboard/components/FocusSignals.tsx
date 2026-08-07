import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

// The figures behind today's focus, drawn instead of described.
//
// The briefing's argument is always a comparison — this concept against the
// learner's own average, weighed by how much evidence sits behind the number
// and how often the concept actually shows up in CAT. Prose has to spend a
// sentence on each of those; two bars and two meters land all three at once.
//
// Everything here comes from the engine, never from the model. Same rule as
// the timing figures in FocusCard: numbers the learner might act on are
// rendered from data, so they cannot be misremembered by a language model.

interface FocusSignalsProps {
  subtopic: SubtopicWeakness;
  /** Accuracy across every concept — the line the focus concept is measured against. */
  overallAccuracy: number;
}

const bandBar: Record<WeaknessBand, string> = {
  critical: 'bg-danger',
  weak: 'bg-danger',
  learning: 'bg-info',
  improving: 'bg-accent',
  strong: 'bg-success',
  untested: 'bg-text-muted',
};

const bandText: Record<WeaknessBand, string> = {
  critical: 'text-danger',
  weak: 'text-danger',
  learning: 'text-info',
  improving: 'text-accent',
  strong: 'text-success',
  untested: 'text-text-muted',
};

/**
 * How far to trust the accuracy figure. 0% over 2 attempts and 0% over 40 are
 * the same number and completely different facts — the briefing leans on that
 * distinction, so the card shows it rather than burying it in a clause.
 */
const evidenceOf = (attempts: number): { level: number; label: string } => {
  if (attempts >= 20) return { level: 4, label: 'Strong evidence' };
  if (attempts >= 10) return { level: 3, label: 'Solid evidence' };
  if (attempts >= 5) return { level: 2, label: 'Some evidence' };
  return { level: 1, label: 'Thin evidence' };
};

/** frequencyWeight (1.3 very_high … 0.4 low), worded for a learner. */
const frequencyOf = (weight: number): { level: number; label: string } => {
  if (weight >= 1.2) return { level: 4, label: 'Very common in CAT' };
  if (weight >= 0.9) return { level: 3, label: 'Common in CAT' };
  if (weight >= 0.6) return { level: 2, label: 'Sometimes in CAT' };
  return { level: 1, label: 'Rare in CAT' };
};

/**
 * Four segments filled to `level`. Reads at a glance and needs no legend.
 *
 * Empty segments use --border-strong rather than a token with an opacity
 * modifier. The colour tokens are full colours (var(--graphite-500),
 * rgba(...)), not raw channels, so Tailwind cannot compose `/20` onto them —
 * it emits an invalid colour and the segment renders fully transparent,
 * which silently turns a 4-segment meter into a 1-segment one.
 */
const Meter = ({ level, tone }: { level: number; tone: string }) => (
  <span className="flex shrink-0 items-center gap-[2.5px]" aria-hidden>
    {[1, 2, 3, 4].map((i) => (
      <span
        key={i}
        className={clsx('h-2.5 w-[3px] rounded-full', i <= level ? tone : 'bg-border-strong')}
      />
    ))}
  </span>
);

const Signal = ({ level, label, tone }: { level: number; label: string; tone: string }) => (
  <span className="flex min-w-0 items-center gap-2">
    <Meter level={level} tone={tone} />
    <span className="truncate font-body text-[0.6875rem] font-medium text-text-muted">{label}</span>
  </span>
);

/**
 * One accuracy bar. A 0% concept still gets a visible nub — an empty track
 * reads as "no data" when the point is that the data is zero.
 *
 * The grow-in is a CSS transition off a mount flag, not an animation library
 * keyframe. That distinction matters: a transition always *lands* on its
 * target, so if the animation engine never ticks — a backgrounded tab on
 * first paint, reduced-motion, a headless renderer — the bar simply appears
 * at its true width. Animating from zero the other way leaves an empty track
 * sitting next to the label "53%", which reads as a broken chart.
 */
const AccuracyBar = ({
  label,
  value,
  barClass,
  textClass,
  delayMs,
}: {
  label: string;
  value: number;
  barClass: string;
  textClass: string;
  delayMs: number;
}) => {
  const [grown, setGrown] = useState(false);
  useEffect(() => setGrown(true), []);

  return (
    <div className="flex items-center gap-3">
      <span className="w-[4.75rem] shrink-0 font-body text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-text-faint">
        {label}
      </span>
      {/* --border, not an opacity modifier: see the note on Meter. Without a
          visible track there is no scale to read the fill against. */}
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border">
        <span
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out-expo',
            barClass
          )}
          style={{
            width: grown ? `${Math.max(value, 2)}%` : '0%',
            transitionDelay: `${delayMs}ms`,
          }}
        />
      </span>
      <span
        className={clsx('w-9 shrink-0 text-right font-mono text-xs font-bold tabular-nums', textClass)}
      >
        {value}%
      </span>
    </div>
  );
};

export const FocusSignals = ({ subtopic, overallAccuracy }: FocusSignalsProps) => {
  const evidence = evidenceOf(subtopic.attempts);
  const frequency = frequencyOf(subtopic.frequencyWeight);
  const gap = overallAccuracy - subtopic.accuracy;

  return (
    <div className="mt-4">
      <div className="space-y-2">
        <AccuracyBar
          label="This topic"
          value={subtopic.accuracy}
          barClass={bandBar[subtopic.band]}
          textClass={bandText[subtopic.band]}
          delayMs={150}
        />
        <AccuracyBar
          label="Your average"
          value={overallAccuracy}
          barClass="bg-text-muted"
          textClass="text-text-secondary"
          delayMs={280}
        />
      </div>

      {/* The gap is the whole argument for drilling this today, so it gets
          stated once in words. Only when it is real — a concept at or above
          the learner's own average is not behind, and saying so would be a
          lie the bars immediately contradict. */}
      {gap >= 5 && (
        <p className="mt-2.5 font-body text-[0.6875rem] text-text-faint">
          <span className="font-mono font-bold tabular-nums text-text-secondary">{gap} pts</span>{' '}
          below your own average
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Signal
          level={evidence.level}
          label={`${evidence.label} · ${subtopic.attempts} attempts`}
          tone="bg-accent"
        />
        <Signal level={frequency.level} label={frequency.label} tone="bg-accent" />
      </div>
    </div>
  );
};

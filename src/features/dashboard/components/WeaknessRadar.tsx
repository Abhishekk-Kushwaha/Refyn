import { useMemo } from 'react';
import { SubtopicWeakness, TopicWeakness } from '@/services/weakness.service';

interface WeaknessRadarProps {
  topics: TopicWeakness[];
  /**
   * Axes to fall back to when the student's practice sits inside fewer than
   * three parent topics. Drilling one topic deeply is normal — and it used to
   * leave the radar permanently locked behind "practice at least 3 topics"
   * while a dozen weak subtopics sat listed right underneath it.
   */
  subtopics?: SubtopicWeakness[];
}

/** A radar needs at least this many axes to read as an area rather than a line. */
const MIN_AXES = 3;
const MAX_AXES = 8;

/* Geometry, in viewBox units. The chart is drawn by hand rather than by
   recharts: the sweep, the reticle spokes that overshoot the outer ring, and
   the flag on the weakest axis are all part of the instrument, and none of
   them are things a chart library will draw for you. */
const SIZE = 300;
const C = SIZE / 2;
/** Outer grid ring — also the radius a mastery of 100 plots at. */
const R = 82;
/** Spokes overshoot the rings, which is what makes it read as a reticle. */
const SPOKE = 108;
const LABEL = 121;
/** Rings drawn between the centre and R. */
const RINGS = [1 / 3, 2 / 3, 1];
/** Keeps a zeroed axis visible as a point instead of collapsing it onto the centre. */
const FLOOR = 0.08;

interface Axis {
  label: string;
  /** 0–100. High is good — this plots mastery, not weakness. */
  mastery: number;
}

const pointAt = (index: number, count: number, radius: number) => {
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  return {
    x: C + radius * Math.cos(angle),
    y: C + radius * Math.sin(angle),
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
};

const polygon = (count: number, radius: number) =>
  Array.from({ length: count }, (_, i) => {
    const p = pointAt(i, count, radius);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

/** Axis labels sit outside the rings, so long concept names have to give. */
const shorten = (name: string, max = 14) =>
  name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;

export const WeaknessRadar = ({ topics, subtopics = [] }: WeaknessRadarProps) => {
  const { axes, usingSubtopics } = useMemo(() => {
    // A topic carries no mastery of its own, so roll its concepts up weighted
    // by attempts. Averaging the per-concept scores flat would let a concept
    // with one attempt outweigh one with fifty.
    const topicAxes: Axis[] = topics.map((t) => {
      const own = subtopics.filter((s) => s.topicName === t.topicName);
      const weight = own.reduce((sum, s) => sum + s.attempts, 0);
      return {
        label: t.topicName,
        mastery: weight
          ? own.reduce((sum, s) => sum + s.masteryScore * s.attempts, 0) / weight
          : t.accuracy,
      };
    });

    // Not enough parent topics to plot? Plot the concepts instead. The data is
    // there either way, and the whole point of the map is to show it.
    if (topicAxes.length < MIN_AXES && subtopics.length >= MIN_AXES) {
      return {
        usingSubtopics: true,
        axes: subtopics
          .slice(0, MAX_AXES)
          .map((s) => ({ label: s.subtopicName, mastery: s.masteryScore })),
      };
    }
    return { usingSubtopics: false, axes: topicAxes.slice(0, MAX_AXES) };
  }, [topics, subtopics]);

  const count = axes.length;

  if (count < MIN_AXES) {
    const touched = Math.max(topics.length, subtopics.length);
    return (
      <div className="flex h-64 items-center justify-center px-6 text-center">
        <p className="font-body text-sm text-text-muted">
          Practice at least {MIN_AXES} concepts to unlock your weakness radar. So far
          you&rsquo;ve touched {touched}.
        </p>
      </div>
    );
  }

  // Scale the rings to the data, not to a theoretical 100.
  //
  // masteryScore rises slowly by design: a concept with one attempt scores in
  // the low teens even when it was answered correctly. Against a fixed 0–100
  // axis a real profile collapsed into an unreadable dot at the centre — the
  // chart looked broken rather than early. Scaling to the peak keeps the shape
  // legible at any level, with a floor so a genuinely thin profile doesn't get
  // magnified into looking mastered. The radar is a comparison between axes,
  // not a readout of absolute mastery; the ledger below carries the figures.
  const peak = Math.max(...axes.map((a) => a.mastery), 0);
  const axisMax = Math.min(100, Math.max(25, Math.ceil((peak * 1.15) / 5) * 5));

  const radiusFor = (mastery: number) =>
    R * (FLOOR + (1 - FLOOR) * Math.min(1, Math.max(0, mastery / axisMax)));

  const vertices = axes.map((a, i) => pointAt(i, count, radiusFor(a.mastery)));
  const shape = vertices.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // The innermost point is the weakest link — the one thing this chart is
  // meant to make findable in a glance, so it gets flagged.
  const weakestIndex = axes.reduce(
    (lowest, a, i) => (a.mastery < axes[lowest].mastery ? i : lowest),
    0
  );

  return (
    <div>
      {usingSubtopics && (
        <p className="mb-1 text-center font-body text-xs text-text-muted">
          Showing concepts — practice more topics to compare sections
        </p>
      )}

      <div className="relative mx-auto aspect-square w-full max-w-[300px]">
        {/* Sweep. Purely ambient: it carries no data, so it sits under the
            plot and never intercepts a pointer. */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden"
          aria-hidden="true"
        >
          <div
            className="h-[72%] w-[72%] rounded-full opacity-55"
            style={{
              background: 'conic-gradient(from 0deg, var(--radar-sweep), transparent 55%)',
              WebkitMask: 'radial-gradient(circle, transparent 8%, #000 9%)',
              mask: 'radial-gradient(circle, transparent 8%, #000 9%)',
              animation: 'radar-sweep 5s linear infinite',
            }}
          />
        </div>

        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative h-full w-full overflow-visible"
          role="img"
          aria-label={`Mastery across ${count} ${usingSubtopics ? 'concepts' : 'sections'}. Weakest: ${axes[weakestIndex].label}.`}
        >
          <defs>
            <linearGradient id="radar-fill" x1="0" y1="0" x2={SIZE} y2={SIZE} gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--accent-2)" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {/* Rings */}
          <g fill="none" stroke="var(--border-strong)" strokeWidth="1">
            {RINGS.map((ratio) => (
              <polygon key={ratio} points={polygon(count, R * ratio)} />
            ))}
          </g>

          {/* Spokes */}
          <g stroke="var(--border)" strokeWidth="1">
            {axes.map((axis, i) => {
              const p = pointAt(i, count, SPOKE);
              return <line key={axis.label} x1={C} y1={C} x2={p.x} y2={p.y} />;
            })}
          </g>

          {/* The plot */}
          <polygon
            points={shape}
            fill="url(#radar-fill)"
            stroke="var(--accent-hover)"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 8px var(--radar-glow))' }}
          />

          <g fill="var(--topic-a)">
            {vertices.map((p, i) => (
              <circle key={axes[i].label} cx={p.x} cy={p.y} r="3.5" />
            ))}
          </g>

          {/* Weakest-axis flag */}
          <circle
            cx={vertices[weakestIndex].x}
            cy={vertices[weakestIndex].y}
            r="6.5"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="1.5"
            opacity="0.9"
          />

          {/* Axis labels. Anchored off the angle so nothing collides with the
              plot on the left-hand axes. */}
          <g className="font-body" fontSize="10" fontWeight="600">
            {axes.map((axis, i) => {
              const p = pointAt(i, count, LABEL);
              const anchor =
                Math.abs(p.cos) < 0.25 ? 'middle' : p.cos > 0 ? 'start' : 'end';
              return (
                <text
                  key={axis.label}
                  x={p.x}
                  y={p.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fill={i === weakestIndex ? 'var(--danger-hover)' : 'var(--text-secondary)'}
                >
                  {shorten(axis.label)}
                </text>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-2 flex justify-center gap-4">
        <span className="inline-flex items-center gap-1.5 font-body text-[0.6875rem] font-semibold text-text-secondary">
          <span className="h-2 w-2 rounded-[2px] bg-accent-hover" aria-hidden="true" />
          Your mastery
        </span>
        <span className="inline-flex items-center gap-1.5 font-body text-[0.6875rem] font-semibold text-text-secondary">
          <span
            className="h-2 w-2 rounded-full border-[1.5px] border-danger-hover"
            aria-hidden="true"
          />
          Weakest
        </span>
      </div>
    </div>
  );
};

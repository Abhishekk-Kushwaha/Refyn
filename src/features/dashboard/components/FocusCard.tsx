import { motion } from 'framer-motion';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

interface FocusCardProps {
  subtopic: SubtopicWeakness;
  /** Coaching prose. Never contains the learner's own figures — see below. */
  message: string;
  loading: boolean;
  onDrill: (subtopic: SubtopicWeakness) => void;
  drilling: boolean;
}

const bandLabel: Record<WeaknessBand, string> = {
  critical: 'Weakest area',
  weak: 'Weak spot',
  learning: 'Still shaky',
  improving: 'Trending up',
  strong: 'Keep it sharp',
  untested: 'Blind spot',
};

export const FocusCard = ({
  subtopic,
  message,
  loading,
  onDrill,
  drilling,
}: FocusCardProps) => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl border border-accent/30 bg-accent/5 p-5"
  >
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wider text-accent">
        Today&rsquo;s focus
      </span>
      <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wider text-text-secondary">
        {bandLabel[subtopic.band]}
      </span>
    </div>

    <h2 className="font-semibold text-lg text-text-primary">{subtopic.subtopicName}</h2>

    {/* The learner's real figures come from the engine and are rendered here,
        never inside the coaching text — that text is shared across everyone in
        the same band, so it has to stay free of personal numbers. */}
    <p className="mt-0.5 font-body text-xs text-text-muted">
      {subtopic.topicName} · {subtopic.accuracy}% accuracy · {subtopic.attempts} attempted
    </p>

    {loading ? (
      <div className="mt-3 space-y-2" aria-hidden>
        <div className="h-3 w-full animate-pulse rounded bg-border" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-border" />
      </div>
    ) : (
      <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">{message}</p>
    )}

    <button
      onClick={() => onDrill(subtopic)}
      disabled={drilling}
      className="mt-4 w-full rounded-sm bg-accent px-4 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {drilling ? 'Loading…' : `Drill ${subtopic.subtopicName} →`}
    </button>
  </motion.section>
);

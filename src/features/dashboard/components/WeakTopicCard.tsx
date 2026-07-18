import { motion } from 'framer-motion';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

interface WeakTopicCardProps {
  subtopic: SubtopicWeakness;
  index: number;
  onDrill: (subtopic: SubtopicWeakness) => void;
  drilling: boolean;
}

const bandConfig: Record<WeaknessBand, { label: string; text: string; border: string }> = {
  critical: { label: 'VERY WEAK', text: 'text-danger', border: 'border-l-danger' },
  weak: { label: 'WEAK', text: 'text-danger', border: 'border-l-danger' },
  learning: { label: 'LEARNING', text: 'text-info', border: 'border-l-info' },
  improving: { label: 'IMPROVING', text: 'text-accent', border: 'border-l-accent' },
  strong: { label: 'MASTERED', text: 'text-success', border: 'border-l-success' },
  untested: { label: 'NEW', text: 'text-text-muted', border: 'border-l-border-strong' },
};

const relativeTime = (iso: string | null): string => {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

export const WeakTopicCard = ({ subtopic, index, onDrill, drilling }: WeakTopicCardProps) => {
  const config = bandConfig[subtopic.band];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-surface rounded-sm p-4 border-l-4 ${config.border} flex items-center justify-between gap-3`}
    >
      <div className="min-w-0">
        <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
        <h3 className="font-semibold text-text-primary truncate">{subtopic.subtopicName}</h3>
        <p className="text-text-muted text-xs">
          {subtopic.accuracy}% accuracy · {subtopic.attempts} attempted · {relativeTime(subtopic.lastAttemptedAt)}
        </p>
      </div>

      <button
        onClick={() => onDrill(subtopic)}
        disabled={drilling}
        className="flex-shrink-0 text-sm font-semibold text-accent hover:text-accent-hover disabled:opacity-50 transition-colors"
      >
        {drilling ? '…' : 'Drill →'}
      </button>
    </motion.div>
  );
};

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Icon } from '@/components/ui';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

interface WeakTopicCardProps {
  subtopic: SubtopicWeakness;
  index: number;
  onDrill: (subtopic: SubtopicWeakness) => void;
  drilling: boolean;
}

const bandConfig: Record<
  WeaknessBand,
  { label: string; text: string; dot: string; bar: string }
> = {
  critical: { label: 'Very weak', text: 'text-danger', dot: 'bg-danger', bar: 'bg-danger' },
  weak: { label: 'Weak', text: 'text-danger', dot: 'bg-danger', bar: 'bg-danger' },
  learning: { label: 'Learning', text: 'text-info', dot: 'bg-info', bar: 'bg-info' },
  improving: { label: 'Improving', text: 'text-accent', dot: 'bg-accent', bar: 'bg-accent' },
  strong: { label: 'Mastered', text: 'text-success', dot: 'bg-success', bar: 'bg-success' },
  untested: { label: 'New', text: 'text-text-muted', dot: 'bg-text-faint', bar: 'bg-text-faint' },
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
    <motion.button
      type="button"
      onClick={() => onDrill(subtopic)}
      disabled={drilling}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
      className={clsx(
        'group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-4 text-left',
        'transition-[transform,border-color,box-shadow] duration-200 ease-out-expo',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:pointer-events-none disabled:opacity-60'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} aria-hidden="true" />
        <span
          className={clsx(
            'font-body text-[0.625rem] font-bold uppercase tracking-[0.12em]',
            config.text
          )}
        >
          {config.label}
        </span>
        <span className="ml-auto font-body text-[0.6875rem] text-text-faint">
          {relativeTime(subtopic.lastAttemptedAt)}
        </span>
      </div>

      <h3 className="truncate font-heading text-[0.9375rem] font-semibold tracking-[-0.01em] text-text-primary">
        {subtopic.subtopicName}
      </h3>
      <p className="mt-0.5 truncate font-body text-xs text-text-faint">{subtopic.topicName}</p>

      {/* Accuracy as a bar as well as a number — the bar is what makes a
          column of these cards comparable at a glance. */}
      <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${subtopic.accuracy}%` }}
          transition={{ delay: Math.min(index * 0.03, 0.3) + 0.15, duration: 0.5 }}
          className={clsx('h-full rounded-full', config.bar)}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-body text-xs text-text-muted tabular-nums">
          <span className="font-semibold text-text-secondary">{subtopic.accuracy}%</span> ·{' '}
          {subtopic.attempts} attempted
        </span>
        <span className="inline-flex items-center gap-1 font-body text-xs font-semibold text-accent">
          {drilling ? 'Loading…' : 'Drill'}
          {!drilling && (
            <Icon
              name="arrowRight"
              size={13}
              strokeWidth={2.5}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          )}
        </span>
      </div>
    </motion.button>
  );
};

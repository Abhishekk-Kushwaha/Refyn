import { motion } from 'framer-motion';
import { Eyebrow } from '@/components/ui';
import { SkipConcern, SkipSnapshot } from '@/services/skipInsights.service';
import { SkipBehaviour } from '@/engine/skipProfile';

interface SkipPanelProps {
  data: SkipSnapshot;
}

const behaviourStyle: Record<
  Exclude<SkipBehaviour, 'none'>,
  { label: string; text: string; border: string }
> = {
  avoiding: { label: 'AVOIDING', text: 'text-danger', border: 'border-l-danger' },
  stalling: { label: 'LOSING TIME', text: 'text-info', border: 'border-l-info' },
  triaging: { label: 'GOOD TRIAGE', text: 'text-success', border: 'border-l-success' },
};

/** 90s reads worse than 1m 30s at a glance; both are fine, minutes win past two. */
const duration = (seconds: number): string => {
  if (seconds < 120) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

const Row = ({ concern, index }: { concern: SkipConcern; index: number }) => {
  const style = behaviourStyle[concern.behaviour as Exclude<SkipBehaviour, 'none'>];
  if (!style) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-surface rounded-sm p-4 border-l-4 ${style.border}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
        <span className="font-body text-[0.6875rem] text-text-muted">
          {concern.skips} skipped · {Math.round(concern.skipRate * 100)}% of what you saw
        </span>
      </div>

      <h3 className="mt-0.5 font-semibold text-text-primary truncate">{concern.conceptName}</h3>
      <p className="font-body text-xs text-text-muted">{concern.topicName}</p>

      <p className="mt-2 font-body text-sm leading-relaxed text-text-secondary">
        {concern.summary}
      </p>

      {(concern.avgSkipSeconds !== null || concern.avgSkipDifficulty !== null) && (
        <p className="mt-2 font-body text-[0.6875rem] text-text-muted">
          {concern.avgSkipSeconds !== null && <>avg {duration(concern.avgSkipSeconds)} before skipping</>}
          {concern.avgSkipSeconds !== null && concern.avgSkipDifficulty !== null && ' · '}
          {concern.avgSkipDifficulty !== null && <>avg difficulty {concern.avgSkipDifficulty}/10</>}
        </p>
      )}
    </motion.div>
  );
};

export const SkipPanel = ({ data }: SkipPanelProps) => {
  // Nothing to say yet is better than an empty box. The panel only earns its
  // space once there is a pattern in the skips.
  if (data.concerns.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <Eyebrow className="text-text-muted">What you skipped</Eyebrow>
        <span className="font-body text-[0.6875rem] font-bold uppercase tracking-wider text-text-secondary">
          {data.totalSkips} skipped
          {data.totalSecondsLost > 0 && ` · ${duration(data.totalSecondsLost)} spent`}
        </span>
      </div>
      <div className="space-y-2">
        {data.concerns.map((c, i) => (
          <Row key={c.conceptId} concern={c} index={i} />
        ))}
      </div>
    </section>
  );
};

import { motion } from 'framer-motion';
import { Panel, PanelHeader } from '@/components/ui';
import { SkipConcern, SkipSnapshot } from '@/services/skipInsights.service';
import { SkipBehaviour } from '@/engine/skipProfile';

interface SkipPanelProps {
  data: SkipSnapshot;
}

const behaviourStyle: Record<
  Exclude<SkipBehaviour, 'none'>,
  { label: string; text: string; rule: string }
> = {
  avoiding: { label: 'Avoiding', text: 'text-danger', rule: 'bg-danger' },
  stalling: { label: 'Losing time', text: 'text-info', rule: 'bg-info' },
  triaging: { label: 'Good triage', text: 'text-success', rule: 'bg-success' },
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
      className="relative overflow-hidden rounded-lg bg-surface-raised p-4 pl-5"
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${style.rule}`}
        aria-hidden="true"
      />
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`font-body text-[0.625rem] font-bold uppercase tracking-[0.12em] ${style.text}`}
        >
          {style.label}
        </span>
        <span className="font-body text-[0.6875rem] text-text-faint">
          {concern.skips} skipped · {Math.round(concern.skipRate * 100)}% of what you saw
        </span>
      </div>

      <h3 className="mt-1 truncate font-heading text-[0.9375rem] font-semibold tracking-[-0.01em] text-text-primary">
        {concern.conceptName}
      </h3>
      <p className="font-body text-xs text-text-faint">{concern.topicName}</p>

      <p className="mt-2.5 font-body text-[0.8125rem] leading-relaxed text-text-secondary">
        {concern.summary}
      </p>

      {(concern.avgSkipSeconds !== null || concern.avgSkipDifficulty !== null) && (
        <p className="mt-2.5 font-body text-[0.6875rem] text-text-faint">
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
    <Panel className="h-full">
      <PanelHeader
        icon="filter"
        title="What you skipped"
        aside={
          <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-faint">
            {data.totalSkips} skipped
            {data.totalSecondsLost > 0 && ` · ${duration(data.totalSecondsLost)} spent`}
          </span>
        }
      />
      <div className="space-y-2">
        {data.concerns.map((c, i) => (
          <Row key={c.conceptId} concern={c} index={i} />
        ))}
      </div>
    </Panel>
  );
};

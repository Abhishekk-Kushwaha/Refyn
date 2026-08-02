import { motion } from 'framer-motion';
import { Panel, PanelHeader } from '@/components/ui';
import { TopicWeakness } from '@/services/weakness.service';

interface TopicTimePanelProps {
  topics: TopicWeakness[];
}

/** 45s / 1m 20s — seconds stop reading as a duration past a minute. */
const duration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

/** Longer form for totals, where hours start to appear. */
const longDuration = (seconds: number): string => {
  if (seconds < 3600) return duration(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * True when wrong answers cost materially more than right ones. That is the
 * expensive pattern in a timed paper: the marks are lost and the minutes go
 * with them. Needs a real gap, not a few seconds of noise.
 */
const sinkingTime = (t: TopicWeakness) =>
  t.avgSecondsCorrect !== null &&
  t.avgSecondsIncorrect !== null &&
  t.avgSecondsIncorrect > t.avgSecondsCorrect * 1.5 &&
  t.avgSecondsIncorrect - t.avgSecondsCorrect >= 30;

const Row = ({ topic, slowest, index }: { topic: TopicWeakness; slowest: number; index: number }) => {
  const bad = sinkingTime(topic);
  // Bar is relative to the slowest topic, so the comparison is the message
  // rather than the absolute number.
  const width = slowest > 0 ? Math.max(4, ((topic.avgSeconds ?? 0) / slowest) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg bg-surface-raised p-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-heading text-sm font-semibold tracking-[-0.01em] text-text-primary">
          {topic.topicName}
        </h3>
        <span className="flex-shrink-0 font-body text-sm font-semibold tabular-nums text-text-primary">
          {topic.avgSeconds !== null ? duration(topic.avgSeconds) : '—'}
          <span className="font-normal text-text-muted"> / question</span>
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ delay: index * 0.04 + 0.1, duration: 0.4 }}
          className={`h-full rounded-full ${bad ? 'bg-danger' : 'bg-accent'}`}
        />
      </div>

      <p className="mt-1.5 font-body text-[0.6875rem] text-text-muted">
        {topic.avgSecondsCorrect !== null && <>{duration(topic.avgSecondsCorrect)} when right</>}
        {topic.avgSecondsCorrect !== null && topic.avgSecondsIncorrect !== null && ' · '}
        {topic.avgSecondsIncorrect !== null && (
          <span className={bad ? 'text-danger' : undefined}>
            {duration(topic.avgSecondsIncorrect)} when wrong
          </span>
        )}
        {topic.totalSeconds > 0 && <> · {longDuration(topic.totalSeconds)} total</>}
      </p>
    </motion.div>
  );
};

export const TopicTimePanel = ({ topics }: TopicTimePanelProps) => {
  // Only topics with a timed attempt can say anything about pace.
  const timed = topics
    .filter((t) => t.timedAttempts > 0 && t.avgSeconds !== null)
    .sort((a, b) => (b.avgSeconds ?? 0) - (a.avgSeconds ?? 0));

  if (timed.length === 0) return null;

  const slowest = timed[0].avgSeconds ?? 0;
  const totalSpent = timed.reduce((sum, t) => sum + t.totalSeconds, 0);

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        icon="clock"
        title="Time per topic"
        aside={
          <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-faint">
            {longDuration(totalSpent)} practised
          </span>
        }
      />
      <div className="space-y-2">
        {timed.map((t, i) => (
          <Row key={t.topicName} topic={t} slowest={slowest} index={i} />
        ))}
      </div>
      <p className="mt-auto pt-4 font-body text-[0.6875rem] leading-relaxed text-text-faint">
        Slowest first. Red marks a topic where wrong answers cost more time than right ones.
      </p>
    </Panel>
  );
};

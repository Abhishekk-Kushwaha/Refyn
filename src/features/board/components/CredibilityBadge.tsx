import clsx from 'clsx';
import { Icon } from '@/components/ui';

interface CredibilityBadgeProps {
  accuracy: number | null; // null = not enough data in this concept
  conceptName?: string;
  /** Attempts behind the figure. A 94% off four questions is not credibility. */
  solved?: number | null;
  size?: 'sm' | 'md';
  /** Prefixes "You:" — used in the reply bar. */
  self?: boolean;
}

/**
 * The credibility badge: the answerer's real accuracy in the doubt's concept,
 * from quiz data — not self-reported. No badge when there isn't enough data
 * to be honest about it.
 *
 * The shield glyph is deliberately not shared with any status pill: this is a
 * claim about a person, and it must never be mistaken for a state like
 * "resolved" or "correct".
 */
export const CredibilityBadge = ({
  accuracy,
  conceptName,
  solved,
  size = 'md',
  self,
}: CredibilityBadgeProps) => {
  if (accuracy === null) return null;

  const tone =
    accuracy >= 85
      ? 'bg-success/15 text-success'
      : accuracy >= 60
        ? 'bg-accent-subtle text-accent'
        : 'bg-warning-subtle text-warning';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md font-mono font-bold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.5625rem]' : 'px-2 py-1 text-[0.625rem]',
        tone
      )}
      title={
        conceptName
          ? `Accuracy in ${conceptName}, measured from real practice data`
          : 'Concept accuracy, measured from real practice data'
      }
    >
      <Icon name="shield" size={size === 'sm' ? 9 : 11} strokeWidth={2.8} />
      {self ? 'You: ' : ''}
      {accuracy}%{conceptName ? ` in ${conceptName}` : ''}
      {typeof solved === 'number' && solved > 0 && (
        <span className="opacity-70"> · {solved} solved</span>
      )}
    </span>
  );
};

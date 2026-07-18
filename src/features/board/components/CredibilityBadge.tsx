import clsx from 'clsx';

interface CredibilityBadgeProps {
  accuracy: number | null; // null = not enough data in this concept
  conceptName?: string;
}

/**
 * The credibility badge: the answerer's real accuracy in the doubt's concept,
 * from quiz data — not self-reported. No badge when there isn't enough data
 * to be honest about it.
 */
export const CredibilityBadge = ({ accuracy, conceptName }: CredibilityBadgeProps) => {
  if (accuracy === null) return null;

  const tone =
    accuracy >= 85
      ? 'bg-success-subtle text-success'
      : accuracy >= 60
        ? 'bg-accent-subtle text-accent'
        : 'bg-danger-subtle text-danger';

  return (
    <span
      className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', tone)}
      title={conceptName ? `Accuracy in ${conceptName}, from real practice data` : 'Concept accuracy'}
    >
      {accuracy}%{conceptName ? ` in ${conceptName}` : ''}
    </span>
  );
};

import { Fragment, HTMLAttributes } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

/**
 * Horizontal step rail for multi-stage progress (onboarding, a study streak
 * goal, a mock series).
 *
 * Fixes vs. the reference:
 *  - THE RAIL STARTS AT THE FIRST NODE. The reference ran a filled segment in
 *    from the card's left edge before step one, implying a completed step that
 *    did not exist.
 *  - Symmetric padding on both ends.
 *  - Completion is carried by a check glyph as well as by fill, so the state
 *    is not colour-only.
 */

export interface RailStep {
  id: string;
  label: string;
  icon: IconName;
  status: 'done' | 'current' | 'locked';
}

interface ProgressRailProps extends HTMLAttributes<HTMLDivElement> {
  steps: RailStep[];
}

export const ProgressRail = ({ steps, className, ...props }: ProgressRailProps) => (
  <div className={clsx('w-full', className)} {...props}>
    <div className="flex items-start">
      {steps.map((step, i) => {
        const isDone = step.status === 'done';
        const isCurrent = step.status === 'current';

        return (
          <Fragment key={step.id}>
            {/* Connector precedes every node EXCEPT the first — no phantom
                leading segment. */}
            {i > 0 && (
              <span
                className={clsx(
                  'mt-[1.375rem] h-1 flex-1 rounded-full transition-colors duration-300',
                  steps[i - 1].status === 'done' ? 'bg-accent' : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}

            <div className="flex w-[4.5rem] flex-shrink-0 flex-col items-center gap-2">
              <span
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200',
                  isDone && 'bg-accent text-accent-text',
                  isCurrent && 'bg-surface-raised text-accent shadow-[0_0_0_2px_var(--accent)]',
                  step.status === 'locked' && 'bg-surface-raised text-text-muted'
                )}
              >
                {/* Check on completion — a second, non-colour signal. */}
                <Icon name={isDone ? 'check' : step.icon} size={20} strokeWidth={2.25} />
              </span>

              <span
                className={clsx(
                  'text-center font-body text-[0.6875rem] font-semibold uppercase tracking-wider',
                  isDone || isCurrent ? 'text-text-secondary' : 'text-text-muted'
                )}
              >
                {step.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  </div>
);

import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Eyebrow } from '../ui/Display';

/**
 * The page container.
 *
 * Every screen in this app used to be wrapped in `max-w-2xl mx-auto` — a
 * 672px column. On a 1680px display that left ~1000px of dead canvas and made
 * the desktop build read as a stretched phone. Width is now a per-screen
 * decision:
 *
 *   `wide`    — dashboards and grids. Fills the shell up to 1560px.
 *   `default` — list + detail screens. Roomy but still scannable.
 *   `reading` — long-form prose and single-question flows, where line length
 *               matters more than filling the viewport.
 *   `focus`   — centred, narrow, for auth and single-decision screens.
 */

const widths = {
  wide: 'max-w-content',
  default: 'max-w-[1120px]',
  reading: 'max-w-[860px]',
  focus: 'max-w-[460px]',
} as const;

interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  width?: keyof typeof widths;
}

export const Page = ({ children, width = 'default', className, ...props }: PageProps) => (
  <div
    className={clsx(
      'mx-auto w-full flex-1',
      // Gutters grow with the viewport — a 16px gutter on a 27" monitor is
      // what makes content look glued to the chrome.
      'px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-12',
      widths[width],
      className
    )}
    {...props}
  >
    {children}
  </div>
);

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Buttons / controls. Sits right of the title on desktop, below on mobile. */
  actions?: ReactNode;
  /** Stat pills or meta shown under the description. */
  meta?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) => (
  <header className={clsx('mb-8 lg:mb-10', className)}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <Eyebrow className="mb-2.5 block text-accent">{eyebrow}</Eyebrow>}

        <h1 className="text-balance font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-text-primary lg:text-[2.75rem]">
          {title}
        </h1>

        {description && (
          <p className="mt-3 max-w-prose font-body text-[0.9375rem] leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>

    {meta && <div className="mt-6">{meta}</div>}
  </header>
);

/**
 * 12-column grid. Children position themselves with col-span utilities at the
 * `lg` breakpoint and up; everything stacks below that.
 */
export const PageGrid = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx('grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 xl:gap-6', className)}
    {...props}
  >
    {children}
  </div>
);

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Right-aligned count or control on the section's header row. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A titled block inside a page. Keeps every section header identical. */
export const Section = ({ title, aside, children, className, ...props }: SectionProps) => (
  <section className={clsx('min-w-0', className)} {...props}>
    {(title || aside) && (
      <div className="mb-3.5 flex items-baseline justify-between gap-4">
        {title && <Eyebrow className="text-text-muted">{title}</Eyebrow>}
        {aside && (
          <span className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-faint">
            {aside}
          </span>
        )}
      </div>
    )}
    {children}
  </section>
);

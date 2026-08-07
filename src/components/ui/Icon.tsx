import { SVGProps } from 'react';
import clsx from 'clsx';

/**
 * Refyn icon set.
 *
 * Design rules (these exist for a reason — see the audit that produced them):
 *  1. SILHOUETTE FIRST. Every glyph must be identifiable with colour stripped
 *     out. If two icons read as the same grey blob when desaturated, one of
 *     them is wrong. Never build a set where colour does the identifying.
 *  2. One primitive per glyph. Don't build the whole set out of rounded
 *     squares — that is exactly how you end up with four indistinguishable
 *     tiles.
 *  3. currentColor only. The consumer decides the colour; the icon never
 *     hard-codes one. This is what lets a glyph keep its identity hue in
 *     both selected and unselected states.
 *  4. 24x24 grid, 2px stroke, round caps/joins, optically balanced ink.
 */

const paths = {
  // ---- Navigation ----------------------------------------------------
  // Ascending bars — a wide, flat-bottomed silhouette.
  dashboard: (
    <>
      <path d="M3 21h18" />
      <path d="M7 21V11" />
      <path d="M12 21V4" />
      <path d="M17 21V15" />
    </>
  ),
  // Concentric target — the only circular glyph in the nav.
  practice: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Offset stack — the only glyph with a doubled, shifted outline.
  flashcards: (
    <>
      <rect x="9" y="3" width="11" height="15" rx="2" />
      <path d="M15 18v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" />
    </>
  ),
  // Speech bubble — the only glyph with a tail breaking its outline.
  board: (
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
  ),
  // Head and shoulders — the only glyph with an organic arc.
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),

  // ---- Subject identity ----------------------------------------------
  // Sigma — a hard angular zigzag, unlike anything else in the set.
  sigma: <path d="M18 4H6l6 8-6 8h12" />,
  // Book — tall spine plus a fold, distinct from the flashcard stack.
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),

  // ---- Stats / meta --------------------------------------------------
  flame: (
    <>
      <path d="M12 22c4 0 7-2.6 7-6.5 0-3.4-2-5.4-3.5-7.8C14 5.2 12 2 12 2s-1 3.4-3 5.9C7.5 10 5 11.6 5 15.5 5 19.4 8 22 12 22z" />
      <path d="M12 22c1.7 0 3-1.2 3-2.9 0-1.5-1-2.4-1.6-3.4-.6-1-1.4-2.5-1.4-2.5s-.5 1.3-1.2 2.3C10.1 16.6 9 17.5 9 19.1 9 20.8 10.3 22 12 22z" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>
  ),
  spark: <path d="M12 2.5 14.2 9.3 21 11.5l-6.8 2.2L12 20.5l-2.2-6.8L3 11.5l6.8-2.2z" />,

  // ---- Controls ------------------------------------------------------
  check: <path d="M20 6 9 17l-5-5" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  // Shield — credibility. The only glyph built from a crest, so an accuracy
  // badge never reads as a status pill.
  shield: <path d="M12 2 4 6v6c0 5 8 8 8 8s8-3 8-8V6Z" />,
  // Flame with a hollow core, distinct from the solid `flame` used for streaks.
  hot: (
    <path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1 .4-2 .4-2s-.4 4 2.6 4c2 0 2-2 2-3 0-2-2-3-2-5s2-3 2-3Z" />
  ),
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),

  // ---- Shell / settings ----------------------------------------------
  // Gear — the only glyph built from a toothed ring.
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  // Door with an exiting arrow — reads as leaving, not as a generic box.
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  // Pennant on a pole — replaces the 📌 emoji in the session header.
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 3.5L16 11H5" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16.5v.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 4v4h-4M3 20v-4h4" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Rendered pixel size. Defaults to 24 (the design grid). */
  size?: number;
  /** Stroke weight. Bump to 2.5 for large display sizes. */
  strokeWidth?: number;
}

export const Icon = ({ name, size = 24, strokeWidth = 2, className, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={clsx('flex-shrink-0', className)}
    {...props}
  >
    {paths[name]}
  </svg>
);

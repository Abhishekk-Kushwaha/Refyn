interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Refyn mark: a rounded tile carrying a refinement glyph — a wide bar
 * narrowing to a point, which is literally what the engine does to a weakness
 * profile. Replaces the old gradient-clipped "REFYN" wordmark, which relied on
 * `bg-clip-text` and fell back to invisible text wherever that failed.
 */
export const BrandMark = ({ size = 28, className }: BrandMarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <defs>
      <linearGradient id="refyn-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--indigo-500)" />
        <stop offset="1" stopColor="var(--violet-500)" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#refyn-mark)" />
    {/* Three bars converging — broad signal refined to a single point. */}
    <path
      d="M9 11h14M11 16h10M14 21h4"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

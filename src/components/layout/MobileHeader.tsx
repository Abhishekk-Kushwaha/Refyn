import { THEME_LABELS, THEME_ORDER, useThemeStore } from '@/stores/themeStore';
import { Icon } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';

/**
 * Mobile-only chrome. On desktop the sidebar carries the brand and each screen
 * carries its own <PageHeader>, so a second title bar there would only repeat
 * what is already on screen.
 */
export const MobileHeader = () => {
  const { theme, toggleTheme } = useThemeStore();
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2.5">
        <BrandMark size={24} />
        <span className="font-display text-sm font-bold tracking-[-0.02em] text-text-primary">
          Refyn
        </span>
      </div>

      {/* Three themes now, so the control cycles rather than toggles. The
          label names where the next press lands, not where you are. */}
      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${THEME_LABELS[nextTheme].toLowerCase()} theme`}
        title={`${THEME_LABELS[theme]} theme`}
        className="grid h-9 w-9 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </header>
  );
};

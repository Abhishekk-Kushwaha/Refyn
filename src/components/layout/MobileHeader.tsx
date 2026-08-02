import { useThemeStore } from '@/stores/themeStore';
import { Icon } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';

/**
 * Mobile-only chrome. On desktop the sidebar carries the brand and each screen
 * carries its own <PageHeader>, so a second title bar there would only repeat
 * what is already on screen.
 */
export const MobileHeader = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2.5">
        <BrandMark size={24} />
        <span className="font-display text-sm font-bold tracking-[-0.02em] text-text-primary">
          Refyn
        </span>
      </div>

      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="grid h-9 w-9 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </header>
  );
};

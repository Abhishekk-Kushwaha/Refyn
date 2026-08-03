import { create } from 'zustand';
import { Theme } from '@/types/domain.types';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Advances to the next theme in THEME_ORDER, wrapping at the end. */
  toggleTheme: () => void;
}

/**
 * Cycle order. Dark is home, so the two light themes sit after it and the
 * cycle returns there — a user who wanders into `warm` is never more than
 * two presses from where they started.
 */
export const THEME_ORDER: Theme[] = ['dark', 'light', 'warm'];

/** Human labels, used by every theme control in the app. */
export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  warm: 'Warm',
};

const isTheme = (value: string | null): value is Theme =>
  value !== null && (THEME_ORDER as string[]).includes(value);

const getInitialTheme = (): Theme => {
  // Validated rather than cast: a stale or hand-edited value used to be
  // written straight onto data-theme, which matched no block and left the
  // app rendering with no tokens at all.
  const stored = localStorage.getItem('refyn-theme');
  return isTheme(stored) ? stored : 'dark';
};

const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('refyn-theme', theme);
};

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const next =
        THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
      applyTheme(next);
      return { theme: next };
    });
  },
}));

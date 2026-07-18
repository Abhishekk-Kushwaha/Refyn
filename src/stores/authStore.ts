import { create } from 'zustand';
import { AuthSession, OnboardingState } from '@/types/auth.types';

interface AuthStore {
  session: AuthSession | null;
  onboarding: OnboardingState;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  skipAuth: () => void;
  logout: () => void;
  updateOnboarding: (updates: Partial<OnboardingState>) => void;
  completeOnboarding: () => void;
}

// Demo/explore mode is persisted so it survives refreshes (in-memory auth
// otherwise drops you back to /login on every reload). Real login stays
// in-memory until Phase 1 wires Supabase's own session persistence.
const DEMO_KEY = 'refyn-demo-session';

const demoSession: AuthSession = {
  user: {
    id: 'demo-user',
    email: 'demo@refyn.app',
    displayName: 'Explorer',
    avatarUrl: undefined,
  },
  isAuthenticated: true,
};

const demoOnboarding: OnboardingState = {
  selectedExamId: 'cat',
  weakAreas: ['Arithmetic', 'Algebra', 'Geometry'],
  dailyTarget: 20,
  isComplete: true,
};

const hasDemoSession = (): boolean => {
  try {
    return localStorage.getItem(DEMO_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useAuthStore = create<AuthStore>((set) => ({
  // Rehydrate the demo session on load so exploring survives a refresh.
  session: hasDemoSession() ? demoSession : null,
  onboarding: hasDemoSession()
    ? demoOnboarding
    : {
        weakAreas: [],
        dailyTarget: 20,
        isComplete: false,
      },
  isLoading: false,

  login: async (email: string) => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({
      session: {
        user: {
          id: 'mock-' + Date.now(),
          email,
          displayName: email.split('@')[0],
          avatarUrl: undefined,
        },
        isAuthenticated: true,
      },
      isLoading: false,
    });
  },

  // Explore mode: drop straight into the app with onboarding pre-completed.
  skipAuth: () => {
    try {
      localStorage.setItem(DEMO_KEY, 'true');
    } catch {
      // ignore — still works for this tab even if storage is unavailable
    }
    set({ session: demoSession, onboarding: demoOnboarding, isLoading: false });
  },

  logout: () => {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      // ignore
    }
    set({
      session: null,
      onboarding: { weakAreas: [], dailyTarget: 20, isComplete: false },
    });
  },

  updateOnboarding: (updates) => {
    set((state) => ({
      onboarding: { ...state.onboarding, ...updates },
    }));
  },

  completeOnboarding: () => {
    set((state) => ({
      onboarding: { ...state.onboarding, isComplete: true },
    }));
  },
}));

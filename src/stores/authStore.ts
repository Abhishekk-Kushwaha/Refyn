import { create } from 'zustand';
import { AuthSession, OnboardingState } from '@/types/auth.types';

interface AuthStore {
  session: AuthSession | null;
  onboarding: OnboardingState;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  updateOnboarding: (updates: Partial<OnboardingState>) => void;
  completeOnboarding: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  onboarding: {
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

  logout: () => {
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

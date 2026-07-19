import { create } from 'zustand';
import { AuthSession, OnboardingState } from '@/types/auth.types';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';
import { getExamUuid } from '@/services/taxonomy.service';
import { configureAweLocal, configureAweSupabase, flushAwe } from '@/engine/engine';
import { configureQuestionPoolDemo, configureQuestionPoolSupabase } from '@/services/questionPool';
import {
  configureFlashcardPoolDemo,
  configureFlashcardPoolSupabase,
  resetFlashcardPool,
} from '@/services/flashcardPool';

// Real auth (Supabase magic link) + a persisted demo/explore mode.
// Demo sessions never touch the database — every service dual-paths on
// isDemo so explorers get the localStorage experience.

type AuthStatus = 'initializing' | 'ready';

interface AuthStore {
  status: AuthStatus;
  session: AuthSession | null;
  isDemo: boolean;
  onboarding: OnboardingState;
  initialize: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  skipAuth: () => void;
  logout: () => Promise<void>;
  updateOnboarding: (updates: Partial<OnboardingState>) => void;
  completeOnboarding: () => Promise<void>;
}

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

const emptyOnboarding: OnboardingState = {
  weakAreas: [],
  dailyTarget: 20,
  isComplete: false,
};

const hasDemoFlag = (): boolean => {
  try {
    return localStorage.getItem(DEMO_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useAuthStore = create<AuthStore>((set, get) => {
  /** Load the profile row for a signed-in user and hydrate session state. */
  const loadProfile = async (userId: string, email: string | undefined) => {
    const supabase = getSupabase();
    let { data: profile } = await supabase
      .from('profiles')
      .select('display_name, onboarding_complete')
      .eq('id', userId)
      .maybeSingle();

    // Self-heal: the row is normally created by the on_auth_user_created
    // trigger, but a user who signed up while that trigger was broken would
    // otherwise have no profile — and no way to ever persist onboarding.
    if (!profile) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, display_name: email?.split('@')[0] ?? 'Student' })
        .select('display_name, onboarding_complete')
        .maybeSingle();
      profile = created ?? null;
    }

    set({
      session: {
        user: {
          id: userId,
          email,
          displayName: profile?.display_name ?? email?.split('@')[0] ?? 'Student',
          avatarUrl: undefined,
        },
        isAuthenticated: true,
      },
      isDemo: false,
      onboarding: {
        ...emptyOnboarding,
        selectedExamId: 'cat',
        isComplete: profile?.onboarding_complete ?? false,
      },
    });

    // Point questions + AWE at the live database for this user.
    await Promise.all([
      configureQuestionPoolSupabase('cat').catch(() => configureQuestionPoolDemo()),
      configureFlashcardPoolSupabase().catch(() => configureFlashcardPoolDemo()),
      configureAweSupabase(userId, 'cat'),
    ]);
  };

  return {
    status: 'initializing',
    session: null,
    isDemo: false,
    onboarding: emptyOnboarding,

    initialize: async () => {
      if (get().status === 'ready') return;

      // Demo/explore mode wins if flagged — works with or without Supabase.
      if (hasDemoFlag()) {
        configureAweLocal();
        configureQuestionPoolDemo();
        configureFlashcardPoolDemo();
        set({ session: demoSession, isDemo: true, onboarding: demoOnboarding, status: 'ready' });
        return;
      }

      if (!isSupabaseConfigured) {
        configureAweLocal();
        configureQuestionPoolDemo();
        configureFlashcardPoolDemo();
        set({ status: 'ready' });
        return;
      }

      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await loadProfile(data.session.user.id, data.session.user.email);
      } else {
        // No session yet — the login screen runs on the mock pool/local engine.
        configureAweLocal();
        configureQuestionPoolDemo();
        configureFlashcardPoolDemo();
      }

      supabase.auth.onAuthStateChange((event, session) => {
        // Deferred: supabase-js warns against awaiting its own calls inside
        // this callback (deadlock risk), so hop off the event tick first.
        setTimeout(() => {
          if (event === 'SIGNED_IN' && session) {
            loadProfile(session.user.id, session.user.email);
          } else if (event === 'SIGNED_OUT') {
            set({ session: null, isDemo: false, onboarding: emptyOnboarding });
          }
        }, 0);
      });

      set({ status: 'ready' });
    },

    sendMagicLink: async (email: string) => {
      // OTP mode: sends a 6-digit code to email
      const { error } = await getSupabase().auth.signInWithOtp({ email });
      if (error) throw error;
    },

    verifyOtp: async (email: string, token: string) => {
      const { data, error } = await getSupabase().auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) throw error;
      // Hydrate profile + engine before returning so the dashboard renders with
      // this user's real weakness data already loaded (no empty-then-populate flash).
      if (data.user) {
        await loadProfile(data.user.id, data.user.email);
      }
    },

    skipAuth: () => {
      try {
        localStorage.setItem(DEMO_KEY, 'true');
      } catch {
        // still works for this tab
      }
      configureAweLocal();
      configureQuestionPoolDemo();
      configureFlashcardPoolDemo();
      set({ session: demoSession, isDemo: true, onboarding: demoOnboarding });
    },

    logout: async () => {
      const { isDemo } = get();
      // Flush any pending engine writes before tearing down the session.
      if (!isDemo) await flushAwe();
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        // ignore
      }
      if (!isDemo && isSupabaseConfigured) {
        await getSupabase().auth.signOut();
      }
      // Reset the engine + pool to a clean local state for the login screen.
      configureAweLocal();
      configureQuestionPoolDemo();
      // Full reset (not the demo pool): the next sign-in must refetch the real
      // card bank rather than inherit the mock one.
      resetFlashcardPool();
      set({ session: null, isDemo: false, onboarding: emptyOnboarding });
    },

    updateOnboarding: (updates) => {
      set((state) => ({ onboarding: { ...state.onboarding, ...updates } }));
    },

    completeOnboarding: async () => {
      const { session, isDemo, onboarding } = get();
      set({ onboarding: { ...onboarding, isComplete: true } });

      // Real accounts persist onboarding to profiles + user_exams (Database §3).
      if (session && !isDemo && isSupabaseConfigured) {
        const supabase = getSupabase();
        // Upsert, not update: an update would silently affect zero rows if the
        // profile were missing, stranding the user in onboarding forever.
        await supabase.from('profiles').upsert(
          {
            id: session.user.id,
            onboarding_complete: true,
            display_name: session.user.displayName ?? null,
          },
          { onConflict: 'id' }
        );

        try {
          const examUuid = await getExamUuid(onboarding.selectedExamId ?? 'cat');
          await supabase.from('user_exams').upsert(
            {
              user_id: session.user.id,
              exam_id: examUuid,
              daily_target: onboarding.dailyTarget ?? 20,
              is_primary: true,
            },
            { onConflict: 'user_id,exam_id' }
          );
        } catch {
          // Non-fatal: the profile flag is what gates routing; user_exams
          // can be repaired on next onboarding-affecting action.
        }
      }
    },
  };
});

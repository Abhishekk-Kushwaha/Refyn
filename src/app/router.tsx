import { ReactNode, lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { PageLoader } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

// Lazy load feature screens
const LoginView = lazy(() => import('@/features/auth/LoginView').then((m) => ({ default: m.LoginView })));
const OnboardingView = lazy(() => import('@/features/onboarding/OnboardingView').then((m) => ({ default: m.OnboardingView })));
const DashboardView = lazy(() => import('@/features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })));
const PracticeConfigView = lazy(() => import('@/features/practice/PracticeConfigView').then((m) => ({ default: m.PracticeConfigView })));
const PracticeSessionView = lazy(() => import('@/features/practice/PracticeSessionView').then((m) => ({ default: m.PracticeSessionView })));
const PracticeReviewView = lazy(() => import('@/features/practice/PracticeReviewView').then((m) => ({ default: m.PracticeReviewView })));
const FlashcardsView = lazy(() => import('@/features/flashcards/FlashcardsView').then((m) => ({ default: m.FlashcardsView })));
const BoardView = lazy(() => import('@/features/board/BoardView').then((m) => ({ default: m.BoardView })));
const ProfileView = lazy(() => import('@/features/profile/ProfileView').then((m) => ({ default: m.ProfileView })));
const AppLayout = lazy(() => import('@/components/layout/AppLayout').then((m) => ({ default: m.AppLayout })));

// Lazy load wrapper
const LazyComponent = ({ component: Component }: { component: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{Component}</Suspense>
);

// Guards the main app (shell + focused routes): needs a session AND finished onboarding.
const AuthGuard = () => {
  const session = useAuthStore((state) => state.session);
  const onboarding = useAuthStore((state) => state.onboarding);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!onboarding.isComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

// Guards the onboarding route itself: needs a session, but must NOT redirect back to
// /onboarding when onboarding is incomplete — that's the expected state while on this
// page. (Reusing AuthGuard here caused a same-URL redirect loop that rendered a blank
// screen forever.) Already-onboarded users are sent straight to the dashboard.
const RequireSession = () => {
  const session = useAuthStore((state) => state.session);
  const onboarding = useAuthStore((state) => state.onboarding);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (onboarding.isComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

// Public routes (login)
const publicRoutes = [
  {
    path: '/login',
    element: <LazyComponent component={<LoginView />} />,
  },
];

// Protected routes with the app shell (bottom nav / sidebar)
const shellRoutes = [
  {
    element: <AuthGuard />,
    children: [
      {
        element: <Suspense fallback={<PageLoader />}><AppLayout /></Suspense>,
        children: [
          {
            path: '/dashboard',
            element: <LazyComponent component={<DashboardView />} />,
          },
          {
            path: '/practice',
            element: <LazyComponent component={<PracticeConfigView />} />,
          },
          {
            path: '/flashcards',
            element: <LazyComponent component={<FlashcardsView />} />,
          },
          {
            path: '/board',
            element: <LazyComponent component={<BoardView />} />,
          },
          {
            path: '/profile',
            element: <LazyComponent component={<ProfileView />} />,
          },
        ],
      },
    ],
  },
];

// Protected routes WITHOUT the shell — full-screen, focused (active practice + results)
const focusedRoutes = [
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/practice/session',
        element: <LazyComponent component={<PracticeSessionView />} />,
      },
      {
        path: '/practice/review',
        element: <LazyComponent component={<PracticeReviewView />} />,
      },
    ],
  },
];

// Onboarding route (requires auth; deliberately does not require onboarding to be complete)
const onboardingRoutes = [
  {
    path: '/onboarding',
    element: <RequireSession />,
    children: [
      {
        index: true,
        element: <LazyComponent component={<OnboardingView />} />,
      },
    ],
  },
];

export const router = createBrowserRouter([
  ...publicRoutes,
  ...onboardingRoutes,
  ...focusedRoutes,
  ...shellRoutes,
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

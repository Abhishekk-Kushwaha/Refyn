import { ReactNode, lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { PageLoader } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

// Lazy load feature screens
const LoginView = lazy(() => import('@/features/auth/LoginView').then((m) => ({ default: m.LoginView })));
const OnboardingView = lazy(() => import('@/features/onboarding/OnboardingView').then((m) => ({ default: m.OnboardingView })));
const DashboardView = lazy(() => import('@/features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })));
const PracticeView = lazy(() => import('@/features/practice/PracticeView').then((m) => ({ default: m.PracticeView })));
const FlashcardsView = lazy(() => import('@/features/flashcards/FlashcardsView').then((m) => ({ default: m.FlashcardsView })));
const BoardView = lazy(() => import('@/features/board/BoardView').then((m) => ({ default: m.BoardView })));
const ProfileView = lazy(() => import('@/features/profile/ProfileView').then((m) => ({ default: m.ProfileView })));
const AppLayout = lazy(() => import('@/components/layout/AppLayout').then((m) => ({ default: m.AppLayout })));

// Lazy load wrapper
const LazyComponent = ({ component: Component }: { component: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{Component}</Suspense>
);

// Auth Guard
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

// Public routes (login)
const publicRoutes = [
  {
    path: '/login',
    element: <LazyComponent component={<LoginView />} />,
  },
];

// Protected routes (require auth + onboarding complete)
const protectedRoutes = [
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
            element: <LazyComponent component={<PracticeView />} />,
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

// Onboarding route (requires auth, but not onboarding complete)
const onboardingRoutes = [
  {
    path: '/onboarding',
    element: <AuthGuard />,
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
  ...protectedRoutes,
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

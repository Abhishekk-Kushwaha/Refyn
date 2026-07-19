import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui';
import { router } from './router';

export const App = () => {
  const { theme } = useThemeStore();
  const authStatus = useAuthStore((s) => s.status);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Hold routing until the Supabase session (if any) is restored — otherwise
  // guards would bounce a signed-in user to /login on every refresh.
  if (authStatus !== 'ready') {
    return <PageLoader />;
  }

  return <RouterProvider router={router} />;
};

import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { router } from './router';

export const App = () => {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <RouterProvider router={router} />;
};

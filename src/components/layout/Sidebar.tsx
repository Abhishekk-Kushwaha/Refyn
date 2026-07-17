import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/practice', label: 'Practice', icon: '🎯' },
  { path: '/flashcards', label: 'Flashcards', icon: '📚' },
  { path: '/board', label: 'Board', icon: '💬' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 bg-surface-raised border-r border-border h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-accent to-amber-400 bg-clip-text text-transparent">
          REFYN
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm',
                isActive
                  ? 'bg-accent-subtle text-accent border-l-4 border-accent'
                  : 'text-text-primary hover:bg-surface'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:bg-surface text-sm transition-colors"
        >
          <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-danger hover:bg-danger-subtle text-sm transition-colors font-medium"
        >
          <span className="text-lg">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
};

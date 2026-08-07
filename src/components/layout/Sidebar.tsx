import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { THEME_LABELS, THEME_ORDER, useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { Icon, type IconName } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Routes that should also light this item up (e.g. /board/new → Board). */
  match?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  { path: '/today', label: 'Today', icon: 'spark' },
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    // The weakness drill-down belongs to the dashboard, not to a tab of its own.
    match: (p) => p === '/dashboard' || p.startsWith('/weakness'),
  },
  {
    path: '/practice',
    label: 'Practice',
    icon: 'practice',
    match: (p) => p.startsWith('/practice'),
  },
  { path: '/flashcards', label: 'Flashcards', icon: 'flashcards' },
  { path: '/board', label: 'Board', icon: 'board', match: (p) => p.startsWith('/board') },
  { path: '/profile', label: 'Profile', icon: 'profile' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.session?.user);
  const isDemo = useAuthStore((state) => state.isDemo);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Student';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-sidebar shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-topbar items-center gap-2.5 px-5">
        <BrandMark size={26} />
        <span className="font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-text-primary">
          Refyn
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
        <p className="px-3 pb-2 pt-3 font-body text-[0.625rem] font-bold uppercase tracking-[0.14em] text-text-faint">
          Workspace
        </p>

        {navItems.map((item) => {
          const isActive = item.match
            ? item.match(location.pathname)
            : location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
                'font-body text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'text-text-primary'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text-primary'
              )}
            >
              {/* The active pill is a shared layout element, so switching
                  routes slides it between items instead of popping. The old
                  border-l-4 also shifted the label 4px on activation. */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg border border-border-strong bg-surface-raised shadow-xs"
                  aria-hidden="true"
                />
              )}

              <span className="relative flex items-center gap-3">
                <Icon
                  name={item.icon}
                  size={18}
                  strokeWidth={isActive ? 2.25 : 2}
                  className={clsx(
                    'transition-colors',
                    isActive ? 'text-accent' : 'text-text-faint group-hover:text-text-secondary'
                  )}
                />
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer — identity, then controls. */}
      <div className="space-y-1 border-t border-border p-3">
        <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-accent font-body text-xs font-bold text-accent-text">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-body text-[0.8125rem] font-semibold text-text-primary">
              {displayName}
            </span>
            <span className="block truncate font-body text-[0.6875rem] text-text-faint">
              {isDemo ? 'Demo mode' : user?.email}
            </span>
          </span>
        </div>

        {/* Cycles dark → light → warm. Naming the destination rather than the
            current state is what keeps a three-way cycle predictable. */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 font-body text-[0.8125rem] font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} className="text-text-faint" />
          {THEME_LABELS[nextTheme]} theme
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 font-body text-[0.8125rem] font-medium text-text-muted transition-colors hover:bg-danger-subtle hover:text-danger"
        >
          <Icon name="logout" size={16} className="text-text-faint" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

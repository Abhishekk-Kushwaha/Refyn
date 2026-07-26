import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Icon, type IconName } from '../ui/Icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/practice', label: 'Practice', icon: 'practice' },
  { path: '/flashcards', label: 'Flashcards', icon: 'flashcards' },
  { path: '/board', label: 'Board', icon: 'board' },
  { path: '/profile', label: 'Profile', icon: 'profile' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'relative flex flex-1 flex-col items-center gap-1.5 px-2 pb-2 pt-3',
                'font-body text-[0.625rem] font-semibold uppercase tracking-wider transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {/* Active marker sits above the icon and costs no layout, so the
                  icon row keeps one baseline. The previous border-t-2 shifted
                  the active item's contents down by 2px. */}
              <span
                className={clsx(
                  'absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full transition-colors',
                  isActive ? 'bg-accent' : 'bg-transparent'
                )}
                aria-hidden="true"
              />
              <Icon name={item.icon} size={22} strokeWidth={isActive ? 2.25 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

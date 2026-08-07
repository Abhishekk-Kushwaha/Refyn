import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Icon, type IconName } from '../ui/Icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  match?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  { path: '/today', label: 'Today', icon: 'spark' },
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    match: (p) => p === '/dashboard' || p.startsWith('/weakness'),
  },
  { path: '/practice', label: 'Practice', icon: 'practice', match: (p) => p.startsWith('/practice') },
  { path: '/flashcards', label: 'Cards', icon: 'flashcards' },
  { path: '/board', label: 'Board', icon: 'board', match: (p) => p.startsWith('/board') },
  { path: '/profile', label: 'Profile', icon: 'profile' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="border-t border-border bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="flex justify-around">
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
                // px-1, not px-2: six tabs on a 375px screen leaves ~62px a
                // cell, and "Dashboard" needs every pixel of it.
                'relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 pb-2 pt-3',
                'font-body text-[0.625rem] font-semibold tracking-wide transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                isActive ? 'text-accent' : 'text-text-faint hover:text-text-secondary'
              )}
            >
              {/* Active marker sits above the icon and costs no layout, so the
                  icon row keeps one baseline. Shared layoutId slides it. */}
              {isActive && (
                <motion.span
                  layoutId="bottomnav-active"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  className="absolute inset-x-0 top-0 mx-auto h-0.5 w-9 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
              <Icon name={item.icon} size={21} strokeWidth={isActive ? 2.25 : 2} />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

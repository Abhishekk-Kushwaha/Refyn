import { useLocation, useNavigate } from 'react-router-dom';
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

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bg-surface border-t border-border">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors',
                isActive
                  ? 'text-accent border-t-2 border-accent'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

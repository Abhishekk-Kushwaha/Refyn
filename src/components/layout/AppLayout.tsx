import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export const AppLayout = () => {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-bg">
      {/* Sidebar (desktop only) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col pb-16 lg:pb-0">
        <Outlet />
      </div>

      {/* Bottom nav (mobile only) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
};

import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useToast } from '@/components/feedback';
import { onAweStoreError } from '@/engine/engine';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';

export const AppLayout = () => {
  const toast = useToast();
  const warnedRef = useRef(false);
  const { pathname } = useLocation();

  // Persistence failures used to be swallowed entirely: the store logged
  // nothing, showed nothing, and relied on "the next write will retry" — so a
  // session that simply ended lost its progress in silence. Warn once per app
  // session; the localStorage mirror means the data is still recoverable.
  useEffect(
    () =>
      onAweStoreError((error) => {
        if (!error || warnedRef.current) return;
        warnedRef.current = true;
        toast.error(
          error === 'hydrate_failed'
            ? "Couldn't load your saved progress — working offline for now."
            : "Couldn't sync your progress to the cloud. It's saved on this device and will retry."
        );
      }),
    [toast]
  );

  return (
    <div className="relative min-h-screen bg-bg">
      {/* Ambient wash. Fixed and non-interactive; sits behind everything. */}
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen">
        {/* Persistent desktop sidebar. */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader />

          {/* `key` restarts the entry animation on navigation so each screen
              arrives rather than snapping in. */}
          <main key={pathname} className="flex flex-1 flex-col pb-20 animate-rise lg:pb-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile tab bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
};

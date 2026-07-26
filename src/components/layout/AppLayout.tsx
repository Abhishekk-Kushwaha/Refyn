import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useToast } from '@/components/feedback';
import { onAweStoreError } from '@/engine/engine';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export const AppLayout = () => {
  const toast = useToast();
  const warnedRef = useRef(false);

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

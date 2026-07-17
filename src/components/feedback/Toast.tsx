import { useState, useCallback, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = Math.random().toString();
      const newToast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const value: ToastContextType = {
    toast: addToast,
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onClose={() => removeToast(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem = ({ toast, onClose }: ToastItemProps) => {
  const typeConfig = {
    success: { bg: 'bg-success-subtle', text: 'text-success', icon: '✓' },
    error: { bg: 'bg-danger-subtle', text: 'text-danger', icon: '✕' },
    info: { bg: 'bg-info-subtle', text: 'text-info', icon: 'ℹ' },
    warning: { bg: 'bg-accent-subtle', text: 'text-accent', icon: '⚠' },
  };

  const config = typeConfig[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-md shadow-lg pointer-events-auto',
        config.bg,
        config.text
      )}
    >
      <span className="font-bold">{config.icon}</span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          className="text-xs font-semibold hover:opacity-80 transition-opacity"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onClose}
        className="text-lg leading-none hover:opacity-60 transition-opacity"
      >
        ×
      </button>
    </motion.div>
  );
};

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'error' | 'high-priority';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
      const duration = toast.variant === 'high-priority' ? 9000 : 4800;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const isHigh = toast.variant === 'high-priority';
          const isErr = toast.variant === 'error';
          const isOk = toast.variant === 'success';

          const containerClasses = isHigh
            ? 'bg-red-700 text-white border-red-800 shadow-lg'
            : isErr
              ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800 shadow-md'
              : isOk
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800 shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-md';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto border rounded-lg p-3.5 flex items-start gap-3 transition-all ${containerClasses}`}
            >
              <div className="shrink-0 mt-0.5">
                {isHigh ? (
                  <AlertTriangle className="w-4 h-4 text-white" />
                ) : isErr ? (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                ) : isOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{toast.title}</p>
                {toast.description && (
                  <p
                    className={`text-xs mt-0.5 line-clamp-2 ${
                      isHigh ? 'text-red-100' : 'opacity-80'
                    }`}
                  >
                    {toast.description}
                  </p>
                )}
                {toast.actionLabel && toast.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      removeToast(toast.id);
                    }}
                    className={`mt-2 text-xs font-semibold underline ${
                      isHigh ? 'text-white' : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className={`p-1 rounded shrink-0 ${
                  isHigh
                    ? 'text-red-100 hover:text-white'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

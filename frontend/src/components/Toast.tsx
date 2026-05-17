import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext debe usarse dentro de ToastProvider");
  return ctx;
}

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 220);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, message, variant, exiting: false }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4000);
    },
    [dismissToast]
  );

  return { toasts, showToast, dismissToast };
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.variant}${toast.exiting ? " toast--exiting" : ""}`}
          role="alert"
        >
          <span className="toast__message">{toast.message}</span>
          <button className="toast__dismiss" type="button" onClick={() => onDismiss(toast.id)} aria-label="Cerrar notificación">
            x
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

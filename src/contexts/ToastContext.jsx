import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ToastViewport, createToastId } from "../components/common/Toast";
import { bindNotifyApi } from "../utils/notify";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = createToastId();
    setToasts((prev) => [...prev.slice(-4), { id, ...toast }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      show(toast) {
        return push(toast);
      },
      success(message, options = {}) {
        return push({ type: "success", message, ...options });
      },
      error(message, options = {}) {
        return push({ type: "error", message, ...options });
      },
      info(message, options = {}) {
        return push({ type: "info", message, ...options });
      },
      warning(message, options = {}) {
        return push({ type: "warning", message, ...options });
      },
      dismiss,
    }),
    [dismiss, push]
  );

  useEffect(() => {
    bindNotifyApi(api);
    return () => bindNotifyApi(null);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

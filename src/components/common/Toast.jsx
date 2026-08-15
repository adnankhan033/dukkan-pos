import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import "./Toast.css";

const TYPE_META = {
  success: { title: "Success", Icon: CheckCircle2 },
  error: { title: "Error", Icon: XCircle },
  info: { title: "Info", Icon: Info },
  warning: { title: "Warning", Icon: AlertTriangle },
};

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const meta = TYPE_META[toast.type] || TYPE_META.info;
  const Icon = meta.Icon;

  function dismiss() {
    setExiting(true);
    window.setTimeout(() => onDismiss(toast.id), 260);
  }

  useEffect(() => {
    const timer = window.setTimeout(dismiss, toast.duration ?? 4500);
    return () => window.clearTimeout(timer);
  }, [toast.duration, toast.id]);

  return (
    <div
      className={`toast-item toast-${toast.type}${exiting ? " toast-exit" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="toast-icon-wrap">
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <div className="toast-content">
        <div className="toast-title">{toast.title || meta.title}</div>
        {toast.message ? <div className="toast-message">{toast.message}</div> : null}
      </div>
      <button type="button" className="toast-close" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
      <div
        className="toast-progress"
        style={{ animationDuration: `${toast.duration ?? 4500}ms` }}
      />
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function createToastId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

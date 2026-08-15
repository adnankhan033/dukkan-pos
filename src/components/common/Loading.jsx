import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import "./Loading.css";

export function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message = "No data found" }) {
  return <div className="empty-state">{message}</div>;
}

const ALERT_META = {
  success: { Icon: CheckCircle2, defaultTitle: "Success" },
  error: { Icon: XCircle, defaultTitle: "Error" },
  info: { Icon: Info, defaultTitle: "Information" },
  warning: { Icon: AlertTriangle, defaultTitle: "Warning" },
};

export function Alert({
  type = "error",
  title,
  children,
  onDismiss,
  className = "",
  style,
}) {
  const meta = ALERT_META[type] || ALERT_META.error;
  const Icon = meta.Icon;

  return (
    <div
      className={`alert alert-${type} ${className}`.trim()}
      role="alert"
      style={style}
    >
      <div className="alert-icon-wrap">
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <div className="alert-content">
        {(title || meta.defaultTitle) && (
          <div className="alert-title">{title || meta.defaultTitle}</div>
        )}
        <div className="alert-message">{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="alert-close" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

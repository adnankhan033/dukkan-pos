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

export function Alert({ type = "error", children }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}

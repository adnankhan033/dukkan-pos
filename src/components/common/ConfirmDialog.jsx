import Button from "./Button";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  size = "md",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className={`confirm-dialog ${size === "lg" ? "confirm-dialog-lg" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">{title}</div>
        <div className="confirm-body">{children ?? message}</div>
        <div className="confirm-footer">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import Button from "./Button";
import "./Modal.css";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  overlayClassName = "",
}) {
  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`modal ${size === "lg" ? "modal-lg" : size === "xl" ? "modal-xl" : size === "sm" ? "modal-sm" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <Button variant="ghost" size="sm" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

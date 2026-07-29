import { CheckCircle2 } from "lucide-react";
import Button from "../common/Button";
import { formatCurrency } from "../../utils/format";
import { PURCHASE_PAYMENT_STATUS_LABELS, PURCHASE_TYPE } from "../../utils/constants";
import "../sales/SaleCompleteModal.css";

const PURCHASE_TYPE_LABELS = {
  [PURCHASE_TYPE.MARKET]: "Market / Cash",
  [PURCHASE_TYPE.SUPPLIER_PAID]: "Supplier — paid now",
  [PURCHASE_TYPE.SUPPLIER_CREDIT]: "Supplier — on credit",
};

export default function PurchaseSaveModal({
  step,
  supplierName,
  purchaseType,
  items,
  total,
  currency,
  savedPurchase,
  processing = false,
  onConfirm,
  onCancel,
  onDone,
}) {
  if (!step) return null;

  return (
    <div className="sale-complete-overlay" onClick={step === "confirm" ? onCancel : undefined}>
      <div className="sale-complete-modal" onClick={(e) => e.stopPropagation()}>
        {step === "confirm" && (
          <>
            <div className="sale-complete-header">
              <h3>Save this purchase?</h3>
              <p>Review items before recording the purchase and updating inventory.</p>
            </div>
            <div className="sale-complete-body">
              <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                Type: <strong>{PURCHASE_TYPE_LABELS[purchaseType]}</strong>
              </p>
              {supplierName && (
                <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                  Supplier: <strong>{supplierName}</strong>
                </p>
              )}
              <div className="sale-complete-items">
                {items.map((item) => (
                  <div key={item.product_id} className="sale-complete-item">
                    <span className="sale-complete-item-name">
                      {item.name} × {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.total, currency)}</strong>
                  </div>
                ))}
              </div>
              <div className="sale-complete-summary">
                <div className="sale-complete-row grand">
                  <span>Total</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
              {purchaseType === PURCHASE_TYPE.SUPPLIER_CREDIT && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  Payment will stay pending until you pay the supplier from Supplier Accounts.
                </p>
              )}
            </div>
            <div className="sale-complete-footer">
              <Button variant="secondary" onClick={onCancel} disabled={processing}>
                No, Cancel
              </Button>
              <Button onClick={onConfirm} disabled={processing}>
                {processing ? "Saving..." : "Yes, Save Purchase"}
              </Button>
            </div>
          </>
        )}

        {step === "success" && savedPurchase && (
          <>
            <div className="sale-complete-body">
              <div className="sale-complete-success">
                <div className="sale-complete-success-icon">
                  <CheckCircle2 size={32} />
                </div>
                <h4>Purchase saved!</h4>
                <p>
                  <strong>{savedPurchase.purchase_number}</strong> — {formatCurrency(savedPurchase.total, currency)}
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  Status:{" "}
                  <strong>
                    {PURCHASE_PAYMENT_STATUS_LABELS[savedPurchase.payment_status] || savedPurchase.payment_status}
                  </strong>
                </p>
                <p style={{ marginTop: "0.5rem" }}>Inventory has been updated.</p>
              </div>
            </div>
            <div className="sale-complete-footer">
              <Button onClick={onDone}>OK</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

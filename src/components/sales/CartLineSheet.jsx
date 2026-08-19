import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, X, Delete } from "lucide-react";
import Button from "../common/Button";
import ProductBilingualName from "../products/ProductBilingualName";
import { formatCurrency, formatQuantity } from "../../utils/format";
import { cartItemDisplayLineTotal, cartItemDisplayUnitPrice } from "../../utils/vatPricing";
import "./CartLineSheet.css";

const PRESETS = [1, 2, 5, 10, 20];
const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "⌫"];

export default function CartLineSheet({
  item,
  currency,
  onSetQty,
  onRemove,
  onClose,
}) {
  const [draft, setDraft] = useState(() => String(item?.quantity || 1));

  useEffect(() => {
    setDraft(String(item?.quantity || 1));
  }, [item?.product_id, item?.quantity]);

  if (!item) return null;

  const unitPrice = cartItemDisplayUnitPrice(item);
  const lineTotal = cartItemDisplayLineTotal(item);
  const unit = item.unit_symbol || "pcs";

  function applyQty(next) {
    const qty = Math.max(0, Math.floor(Number(next) || 0));
    setDraft(String(qty || ""));
    if (qty <= 0) {
      onRemove();
      return;
    }
    onSetQty(qty);
  }

  function handleKey(key) {
    if (key === "C") {
      setDraft("");
      return;
    }
    if (key === "⌫") {
      setDraft((prev) => {
        const next = prev.slice(0, -1);
        const qty = Math.floor(Number(next) || 0);
        if (qty > 0) onSetQty(qty);
        return next;
      });
      return;
    }
    setDraft((prev) => {
      const next = `${prev === "0" ? "" : prev}${key}`.replace(/\D/g, "").slice(0, 6);
      const qty = Math.floor(Number(next) || 0);
      if (qty > 0) onSetQty(qty);
      return next;
    });
  }

  function commitDraft() {
    applyQty(draft === "" ? item.quantity : draft);
  }

  function handleClose() {
    if (draft !== "" && Number(draft) !== Number(item.quantity)) {
      applyQty(draft);
    }
    onClose();
  }

  return (
    <div className="cart-line-overlay" onClick={handleClose}>
      <div className="cart-line-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="cart-line-head">
          <div>
            <p className="cart-line-kicker">Cart line</p>
            <ProductBilingualName name={item.name} nameAr={item.name_ar} size="md" />
          </div>
          <button type="button" className="cart-line-close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="cart-line-math">
          <div>
            <span>Each</span>
            <strong>{formatCurrency(unitPrice, currency)}</strong>
          </div>
          <span className="cart-line-math-x">×</span>
          <div>
            <span>Qty</span>
            <strong>{formatQuantity(item.quantity, unit)}</strong>
          </div>
          <span className="cart-line-math-eq">=</span>
          <div className="cart-line-math-total">
            <span>Line total</span>
            <strong>{formatCurrency(lineTotal, currency)}</strong>
          </div>
        </div>

        <div className="cart-line-qty-row">
          <button type="button" className="cart-line-step" onClick={() => applyQty(item.quantity - 1)}>
            <Minus size={22} />
          </button>
          <input
            className="cart-line-qty-input"
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 6);
              setDraft(next);
              const qty = Math.floor(Number(next) || 0);
              if (qty > 0) onSetQty(qty);
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            aria-label="Quantity"
          />
          <button type="button" className="cart-line-step" onClick={() => applyQty(item.quantity + 1)}>
            <Plus size={22} />
          </button>
        </div>

        <div className="cart-line-presets">
          {PRESETS.map((qty) => (
            <button
              key={qty}
              type="button"
              className={`cart-line-preset ${Number(item.quantity) === qty ? "is-active" : ""}`}
              onClick={() => applyQty(qty)}
            >
              {qty}
            </button>
          ))}
        </div>

        <div className="cart-line-pad">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`cart-line-key ${key === "C" ? "is-muted" : ""} ${key === "⌫" ? "is-muted" : ""}`}
              onClick={() => handleKey(key)}
            >
              {key === "⌫" ? <Delete size={18} /> : key}
            </button>
          ))}
        </div>

        <div className="cart-line-actions">
          <Button variant="danger" onClick={onRemove}>
            <Trash2 size={16} /> Remove
          </Button>
          <Button onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  canOverridePrice = false,
  onSetQty,
  onSetPrice,
  onRemove,
  onClose,
}) {
  const [draft, setDraft] = useState(() => String(item?.quantity || 1));
  const [priceDraft, setPriceDraft] = useState(() =>
    String(item ? cartItemDisplayUnitPrice(item) : "")
  );

  useEffect(() => {
    setDraft(String(item?.quantity || 1));
  }, [item?.product_id, item?.quantity]);

  useEffect(() => {
    if (!item) return;
    setPriceDraft(String(cartItemDisplayUnitPrice(item)));
  }, [item?.product_id, item?.shelf_unit_price, item?.unit_price]);

  if (!item) return null;

  const unitPrice = cartItemDisplayUnitPrice(item);
  const lineTotal = cartItemDisplayLineTotal(item);
  const unit = item.unit_symbol || "pcs";
  const catalogPrice =
    item.catalog_shelf_unit_price != null ? Number(item.catalog_shelf_unit_price) : unitPrice;

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

  function applyPrice(next) {
    if (!canOverridePrice || typeof onSetPrice !== "function") return;
    const value = Math.max(0, Number(next) || 0);
    onSetPrice(value);
  }

  function commitPrice() {
    if (priceDraft === "") {
      setPriceDraft(String(unitPrice));
      return;
    }
    applyPrice(priceDraft);
  }

  function resetCatalogPrice() {
    setPriceDraft(String(catalogPrice));
    applyPrice(catalogPrice);
  }

  function handleClose() {
    if (draft !== "" && Number(draft) !== Number(item.quantity)) {
      applyQty(draft);
    }
    if (canOverridePrice && priceDraft !== "" && Number(priceDraft) !== Number(unitPrice)) {
      applyPrice(priceDraft);
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

        {canOverridePrice ? (
          <div className="cart-line-price">
            <div className="cart-line-price-row">
              <label className="cart-line-price-label" htmlFor="cart-line-price-input">
                Price for this sale
              </label>
              <input
                id="cart-line-price-input"
                className="cart-line-price-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPrice();
                  }
                }}
                aria-label="Price for this sale"
              />
            </div>
            <p className="cart-line-price-hint">
              Catalog stays {formatCurrency(catalogPrice, currency)}. This amount is only for this
              order and invoice.
            </p>
            {item.price_overridden ? (
              <button type="button" className="cart-line-price-reset" onClick={resetCatalogPrice}>
                Reset to catalog price
              </button>
            ) : null}
          </div>
        ) : null}

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

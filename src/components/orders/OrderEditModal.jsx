import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Input } from "../common/Input";
import ProductBilingualName from "../products/ProductBilingualName";
import { Alert, LoadingSpinner } from "../common/Loading";
import { productService } from "../../services/ProductService";
import { formatCurrency } from "../../utils/format";
import {
  applyCartLineQuantity,
  applyCartLineShelfPrice,
  buildCartLineFromProduct,
  calcCartTotals,
  cartItemDisplayLineTotal,
  cartItemDisplayUnitPrice,
  cartLineFromSaleItem,
  isTaxEnabled,
} from "../../utils/vatPricing";
import "./OrderEditModal.css";

export default function OrderEditModal({
  isOpen,
  sale,
  settings,
  currency,
  vatPercent,
  saving = false,
  onClose,
  onSave,
}) {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const taxEnabled = isTaxEnabled(settings);
  const totals = useMemo(
    () => calcCartTotals(cart, Number(discount) || 0, settings),
    [cart, discount, settings]
  );

  useEffect(() => {
    if (!isOpen || !sale) return undefined;
    let cancelled = false;

    async function loadLines() {
      setLoading(true);
      setError("");
      setSearch("");
      setResults([]);
      try {
        const lines = [];
        for (const item of sale.items || []) {
          const product = item.product_id ? await productService.getById(item.product_id) : null;
          if (cancelled) return;
          lines.push(cartLineFromSaleItem(item, product, settings));
        }
        if (cancelled) return;
        setCart(lines);
        setDiscount(Number(sale.discount) || 0);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load invoice items.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLines();
    return () => {
      cancelled = true;
    };
    // Reload only when the invoice is opened, not when unrelated settings objects change.
  }, [isOpen, sale?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const term = search.trim();
    if (term.length < 1) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await productService.searchForPos(term);
        if (!cancelled) setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, search]);

  function addProduct(product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? applyCartLineQuantity(item, Number(item.quantity) + 1)
            : item
        );
      }
      return [...prev, buildCartLineFromProduct(product, settings, 1)];
    });
    setSearch("");
    setResults([]);
    setError("");
  }

  function setQty(productId, quantity) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id !== productId) return item;
          const next = applyCartLineQuantity(item, quantity);
          return next.quantity > 0 ? next : null;
        })
        .filter(Boolean)
    );
  }

  function setPrice(productId, shelfPrice) {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? applyCartLineShelfPrice(item, shelfPrice) : item
      )
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  function handleSave() {
    if (!cart.length) {
      setError("Add at least one item.");
      return;
    }
    onSave?.({ items: cart, discount: Number(discount) || 0 });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sale ? `Update invoice ${sale.sale_number}` : "Update invoice"}
      size="lg"
      closeOnOverlay={!saving}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || loading || cart.length === 0} onClick={handleSave}>
            {saving ? "Saving…" : "Save invoice"}
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingSpinner message="Loading invoice items..." />
      ) : (
        <div className="order-edit">
          {error ? <Alert>{error}</Alert> : null}
          <p className="order-edit-hint">
            Changes apply only to this invoice. Product catalog prices stay the same.
          </p>

          <div className="order-edit-search">
            <Search size={16} className="order-edit-search-icon" />
            <input
              className="order-edit-search-input"
              placeholder="Search to add a product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={saving}
            />
            {search ? (
              <button
                type="button"
                className="order-edit-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {search.trim() ? (
            <div className="order-edit-results">
              {results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="order-edit-result"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!saving) addProduct(product);
                  }}
                  disabled={saving}
                >
                  <ProductBilingualName name={product.name} nameAr={product.name_ar} size="sm" />
                  <strong>{formatCurrency(product.selling_price, currency)}</strong>
                </button>
              ))}
              {searching && results.length === 0 ? (
                <p className="order-edit-muted">Searching…</p>
              ) : null}
              {!searching && results.length === 0 ? (
                <p className="order-edit-muted">No products match “{search.trim()}”.</p>
              ) : null}
            </div>
          ) : null}

          <div className="order-edit-lines">
            {cart.length === 0 ? (
              <p className="order-edit-muted">No items on this invoice.</p>
            ) : (
              cart.map((item) => {
                const qty = Number(item.quantity) || 0;
                const unitPrice = cartItemDisplayUnitPrice(item);
                const lineTotal = cartItemDisplayLineTotal(item);
                return (
                <div key={item.product_id} className="order-edit-line">
                  <div className="order-edit-line-name">
                    <ProductBilingualName name={item.name} nameAr={item.name_ar} size="sm" />
                    {item.price_overridden ? (
                      <span className="order-edit-price-note">This sale</span>
                    ) : null}
                  </div>
                  <div className="order-edit-line-fields">
                    <label>
                      Qty
                      <span className="order-edit-stepper">
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, qty - 1)}
                          disabled={saving}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={qty}
                          onChange={(e) => setQty(item.product_id, e.target.value)}
                          disabled={saving}
                        />
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, qty + 1)}
                          disabled={saving}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </span>
                    </label>
                    <label>
                      Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitPrice}
                        onChange={(e) => setPrice(item.product_id, e.target.value)}
                        disabled={saving}
                      />
                    </label>
                    <label className="order-edit-amount">
                      Amount
                      <strong>{formatCurrency(lineTotal, currency)}</strong>
                      <span className="order-edit-amount-math">
                        {qty} × {formatCurrency(unitPrice, currency)}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="order-edit-remove"
                      onClick={() => removeItem(item.product_id)}
                      disabled={saving}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>

          <div className="order-edit-totals">
            <Input
              label="Discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={saving}
            />
            <div>
              <div>
                <span>{taxEnabled ? "Subtotal (excl. VAT)" : "Subtotal"}</span>
                <span>{formatCurrency(totals.subtotal, currency)}</span>
              </div>
              {taxEnabled ? (
                <div>
                  <span>VAT ({vatPercent}%)</span>
                  <span>{formatCurrency(totals.vat, currency)}</span>
                </div>
              ) : null}
              <div className="order-edit-grand">
                <span>Total</span>
                <strong>{formatCurrency(totals.total, currency)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

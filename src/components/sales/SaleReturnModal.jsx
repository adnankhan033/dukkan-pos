import { useEffect, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { saleService } from "../../services/SaleService";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Input, Textarea } from "../common/Input";
import ProductBilingualName from "../products/ProductBilingualName";
import { Alert } from "../common/Loading";
import { formatCurrency } from "../../utils/format";
import "./SaleReturnModal.css";

export default function SaleReturnModal({
  isOpen,
  onClose,
  onSuccess,
  currency,
  initialSaleId = null,
  initialSaleNumber = "",
}) {
  const { submitting, guard } = useSubmitGuard();
  const [saleNumber, setSaleNumber] = useState(initialSaleNumber);
  const [sale, setSale] = useState(null);
  const [returnLines, setReturnLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSaleNumber(initialSaleNumber || "");
    setSale(null);
    setReturnLines([]);
    setNotes("");
    setError("");
    if (initialSaleId) {
      loadSaleById(initialSaleId);
    }
  }, [isOpen, initialSaleId, initialSaleNumber]);

  async function loadSaleById(id) {
    setLoading(true);
    setError("");
    try {
      const full = await saleService.getById(id);
      if (!full) {
        setError("Sale not found");
        return;
      }
      await applySale(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function applySale(full) {
    const returnable = await saleService.getReturnableItems(full.id);
    if (!returnable?.length) {
      setSale(full);
      setReturnLines([]);
      setError("This sale has no items left to return.");
      return;
    }
    setSale(full);
    setReturnLines(
      returnable.map((item) => ({
        sale_item_id: item.id,
        product_id: item.product_id,
        name: item.name,
        name_ar: item.name_ar,
        unit_price: item.unit_price,
        returnable_qty: item.returnable_qty,
        return_qty: 0,
      }))
    );
    setError("");
  }

  async function searchSale() {
    if (!saleNumber.trim()) {
      setError("Enter a sale number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const found = await saleService.getBySaleNumber(saleNumber.trim());
      if (!found) {
        setError("No sale found with that number");
        setSale(null);
        setReturnLines([]);
        return;
      }
      await applySale(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setReturnQty(productId, delta) {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.product_id !== productId) return line;
        const next = Math.max(0, Math.min(line.returnable_qty, line.return_qty + delta));
        return { ...line, return_qty: next };
      })
    );
  }

  const refundTotal = returnLines.reduce(
    (sum, line) => sum + line.return_qty * line.unit_price,
    0
  );
  const selectedCount = returnLines.filter((l) => l.return_qty > 0).length;

  async function handleSubmit() {
    const items = returnLines
      .filter((l) => l.return_qty > 0)
      .map((l) => ({
        sale_item_id: l.sale_item_id,
        product_id: l.product_id,
        name: l.name,
        quantity: l.return_qty,
        unit_price: l.unit_price,
        total: l.return_qty * l.unit_price,
      }));

    if (!items.length) {
      setError("Select quantity to return for at least one item");
      return;
    }

    try {
      await guard(async () => {
        const result = await saleService.processReturn({
          saleId: sale.id,
          items,
          notes,
        });
        onSuccess?.(result);
        onClose();
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      closeOnOverlay={!submitting}
      title="Return Products"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !sale || selectedCount === 0}
          >
            {submitting ? "Processing..." : `Process Return (${formatCurrency(refundTotal, currency)})`}
          </Button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}

      {!initialSaleId && (
        <div className="return-search-row">
          <Input
            label="Sale Number"
            value={saleNumber}
            onChange={(e) => setSaleNumber(e.target.value)}
            placeholder="e.g. INV-1"
            onKeyDown={(e) => e.key === "Enter" && searchSale()}
          />
          <Button onClick={searchSale} disabled={loading || submitting}>
            <Search size={16} /> Find Sale
          </Button>
        </div>
      )}

      {loading && <p className="return-muted">Loading sale...</p>}

      {sale && (
        <div className="return-sale-info">
          <div>
            <strong>{sale.sale_number}</strong>
            <span className="return-muted"> — {sale.customer_name || "Walk-in"}</span>
          </div>
          <div className="return-muted">
            Original total: {formatCurrency(sale.total, currency)}
          </div>
        </div>
      )}

      {returnLines.length > 0 && (
        <div className="return-lines">
          <p className="return-lines-title">Select items to return</p>
          {returnLines.map((line) => (
            <div key={line.product_id} className="return-line">
              <ProductBilingualName name={line.name} nameAr={line.name_ar} size="sm" />
              <div className="return-line-meta">
                <span>{formatCurrency(line.unit_price, currency)} each</span>
                <span>Max: {line.returnable_qty}</span>
              </div>
              <div className="return-qty-row">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  disabled={line.return_qty <= 0}
                  onClick={() => setReturnQty(line.product_id, -1)}
                >
                  <Minus size={14} />
                </Button>
                <span className="return-qty-value">{line.return_qty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  disabled={line.return_qty >= line.returnable_qty}
                  onClick={() => setReturnQty(line.product_id, 1)}
                >
                  <Plus size={14} />
                </Button>
                <strong>{formatCurrency(line.return_qty * line.unit_price, currency)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {sale && returnLines.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <Textarea
            label="Return notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for return..."
          />
        </div>
      )}
    </Modal>
  );
}

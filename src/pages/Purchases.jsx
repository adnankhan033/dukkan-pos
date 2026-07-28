import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { purchaseService } from "../services/PurchaseService";
import { supplierService } from "../services/SupplierService";
import { productService } from "../services/ProductService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import { Input, Select, Textarea } from "../components/common/Input";
import { Card } from "../components/common/Card";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import PurchaseSaveModal from "../components/purchases/PurchaseSaveModal";
import { formatCurrency, formatDateTime } from "../utils/format";

export default function Purchases() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const { submitting, guard } = useSubmitGuard();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [saveStep, setSaveStep] = useState(null);
  const [savedPurchase, setSavedPurchase] = useState(null);

  const loadPurchases = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await purchaseService.getAll({ limit: 20, page: 1 });
      setPurchases(list.items);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const [supplierList, products] = await Promise.all([
        supplierService.getAll({ limit: 100, page: 1 }),
        productService.getPosCatalog(),
        loadPurchases(),
      ]);
      setSuppliers(supplierList.items);
      setCatalog(products);
    }
    init();
  }, [loadPurchases]);

  const searchResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return [];
    return catalog.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
    ).slice(0, 15);
  }, [catalog, productSearch]);

  const supplierName = suppliers.find((s) => String(s.id) === String(supplierId))?.company || "";
  const total = items.reduce((s, i) => s + i.total, 0);

  function addItem(product) {
    setError("");
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_cost }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_cost: product.cost_price || product.selling_price,
          total: product.cost_price || product.selling_price,
        },
      ];
    });
    setProductSearch("");
  }

  function updateItem(productId, field, value) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.product_id !== productId) return i;
        const updated = { ...i, [field]: Number(value) };
        updated.total = updated.quantity * updated.unit_cost;
        return updated;
      })
    );
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  function openSaveConfirm() {
    if (items.length === 0) {
      setError("Add at least one product");
      return;
    }
    setError("");
    setSaveStep("confirm");
  }

  async function confirmSavePurchase() {
    try {
      await guard(async () => {
        const purchase = await purchaseService.create({
          supplierId: supplierId ? Number(supplierId) : null,
          items,
          notes,
        });

        setItems([]);
        setNotes("");
        setSupplierId("");
        setSavedPurchase(purchase);
        setSaveStep("success");

        await Promise.all([
          loadPurchases(),
          productService.getPosCatalog().then(setCatalog),
        ]);
      });
    } catch (err) {
      setSaveStep(null);
      setError(err.message || "Failed to save purchase");
    }
  }

  function closeSaveModal() {
    setSaveStep(null);
    setSavedPurchase(null);
  }

  const columns = [
    { key: "purchase_number", label: "PO #" },
    { key: "supplier_name", label: "Supplier", render: (r) => r.supplier_name || "-" },
    { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Record purchases and update inventory." />

      {error && <Alert>{error}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>New Purchase</h3>
          <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company}</option>)}
          </Select>
          <div style={{ marginTop: "1rem" }}>
            <Input label="Search Product" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." />
            {searchResults.length > 0 && (
              <div style={{ marginTop: "0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                {searchResults.map((p) => (
                  <div key={p.id} onClick={() => addItem(p)} style={{ padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.875rem", borderBottom: "1px solid var(--color-border)" }}>
                    {p.name} — {formatCurrency(p.cost_price, currency)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              {items.map((item) => (
                <div key={item.product_id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px auto", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                  <span>{item.name}</span>
                  <input className="form-input" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.product_id, "quantity", e.target.value)} />
                  <input className="form-input" type="number" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(item.product_id, "unit_cost", e.target.value)} />
                  <Button variant="ghost" size="sm" className="btn-icon" onClick={() => removeItem(item.product_id)}><Trash2 size={16} /></Button>
                </div>
              ))}
              <div style={{ fontWeight: 700, marginTop: "0.75rem" }}>Total: {formatCurrency(total, currency)}</div>
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={openSaveConfirm} disabled={submitting || items.length === 0} style={{ marginTop: "1rem" }}>
            {submitting ? "Saving..." : (<><Plus size={16} /> Save Purchase</>)}
          </Button>
        </Card>

        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Recent Purchases</h3>
          {listLoading ? <LoadingSpinner /> : <Table columns={columns} data={purchases} emptyMessage="No purchases yet" />}
        </Card>
      </div>

      <PurchaseSaveModal
        step={saveStep}
        supplierName={supplierName}
        items={items}
        total={total}
        currency={currency}
        savedPurchase={savedPurchase}
        processing={submitting}
        onConfirm={confirmSavePurchase}
        onCancel={closeSaveModal}
        onDone={closeSaveModal}
      />
    </div>
  );
}

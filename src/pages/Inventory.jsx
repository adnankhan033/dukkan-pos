import { useEffect, useState } from "react";
import { inventoryService } from "../services/InventoryService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Modal from "../components/common/Modal";
import { Input } from "../components/common/Input";
import Badge from "../components/common/Badge";
import { LoadingSpinner } from "../components/common/Loading";
import { formatCurrency } from "../utils/format";

export default function Inventory() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newQty, setNewQty] = useState("");
  const [reason, setReason] = useState("Manual adjustment");

  async function load() {
    setLoading(true);
    try {
      setItems(await inventoryService.getAll({ filter }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  function openAdjust(product) {
    setSelected(product);
    setNewQty(String(product.quantity));
    setAdjustModal(true);
  }

  async function handleAdjust() {
    await inventoryService.adjustStock(selected.id, Number(newQty), reason);
    setAdjustModal(false);
    load();
  }

  const columns = [
    { key: "name", label: "Product" },
    { key: "sku", label: "SKU", render: (r) => r.sku || "-" },
    { key: "category_name", label: "Category", render: (r) => r.category_name || "-" },
    {
      key: "quantity",
      label: "Stock",
      render: (r) => (
        <Badge variant={r.quantity <= 0 ? "danger" : r.quantity <= r.min_stock ? "warning" : "success"}>
          {r.quantity}
        </Badge>
      ),
    },
    { key: "min_stock", label: "Min Stock" },
    { key: "cost_price", label: "Cost", render: (r) => formatCurrency(r.cost_price, currency) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => openAdjust(row)}>Adjust</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Monitor stock levels and make adjustments." actions={
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["all", "low", "out"].map((f) => (
            <Button key={f} variant={filter === f ? "primary" : "secondary"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
            </Button>
          ))}
        </div>
      } />
      {loading ? <LoadingSpinner /> : <Table columns={columns} data={items} />}
      <Modal isOpen={adjustModal} onClose={() => setAdjustModal(false)} title={`Adjust Stock — ${selected?.name}`}
        footer={<><Button variant="secondary" onClick={() => setAdjustModal(false)}>Cancel</Button><Button onClick={handleAdjust}>Save</Button></>}>
        <Input label="New Quantity" type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)} />
        <div style={{ marginTop: "1rem" }}>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { inventoryService } from "../services/InventoryService";
import {
  getInventoryListCache,
  getInventorySummaryCache,
  inventoryListCacheKey,
  setInventoryListCache,
  setInventorySummaryCache,
} from "../services/InventoryCache";
import { onCatalogChanged } from "../services/CatalogSync";
import { useSettingsStore } from "../contexts/store";
import { useDebounce } from "../hooks/usePagination";
import { INVENTORY_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input } from "../components/common/Input";
import Badge from "../components/common/Badge";
import { LoadingSpinner } from "../components/common/Loading";
import { formatCurrency } from "../utils/format";

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "low", label: "Low Stock" },
  { id: "out", label: "Out of Stock" },
];

export default function Inventory() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, low: 0, out: 0 });
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newQty, setNewQty] = useState("");
  const [reason, setReason] = useState("Manual adjustment");

  const debouncedSearch = useDebounce(search, 300);
  const totalPages = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const cacheKey = inventoryListCacheKey(filter, page, debouncedSearch);

  const loadSummary = useCallback(async () => {
    const cached = getInventorySummaryCache();
    if (cached) {
      setCounts(cached);
      return cached;
    }
    const summary = await inventoryService.getSummaryCounts();
    setInventorySummaryCache(summary);
    setCounts(summary);
    return summary;
  }, []);

  const loadItems = useCallback(async () => {
    const cached = getInventoryListCache(cacheKey);
    if (cached) {
      setItems(cached.items);
      setTotal(cached.total);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [result] = await Promise.all([
        inventoryService.getAll({
          filter,
          page,
          limit: INVENTORY_PAGE_SIZE,
          search: debouncedSearch,
        }),
        loadSummary(),
      ]);
      setItems(result.items);
      setTotal(result.total);
      setInventoryListCache(cacheKey, result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, filter, page, debouncedSearch, loadSummary]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    return onCatalogChanged(() => {
      loadItems();
    });
  }, [loadItems]);

  function changeFilter(next) {
    setFilter(next);
    setPage(1);
  }

  function changeSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function openAdjust(product) {
    setSelected(product);
    setNewQty(String(product.quantity));
    setReason("Manual adjustment");
    setAdjustModal(true);
  }

  async function handleAdjust() {
    await inventoryService.adjustStock(selected.id, Number(newQty), reason);
    setAdjustModal(false);
    await loadItems();
  }

  function tabLabel(tab) {
    const count = counts[tab.id];
    if (count == null) return tab.label;
    return `${tab.label} (${count.toLocaleString()})`;
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
        <Button variant="secondary" size="sm" onClick={() => openAdjust(row)}>
          Adjust
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={
          refreshing
            ? "Refreshing stock…"
            : `Monitor stock levels — ${INVENTORY_PAGE_SIZE} products per page.`
        }
        actions={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {FILTER_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant={filter === tab.id ? "primary" : "secondary"}
                size="sm"
                onClick={() => changeFilter(tab.id)}
              >
                {tabLabel(tab)}
              </Button>
            ))}
          </div>
        }
      />

      <div style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={changeSearch}
          placeholder="Search by name, SKU, or barcode…"
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading stock…" />
      ) : (
        <>
          <Table columns={columns} data={items} emptyMessage="No products match this filter" />
          <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
              itemLabel="products"
            />
        </>
      )}

      <Modal
        isOpen={adjustModal}
        onClose={() => setAdjustModal(false)}
        title={`Adjust Stock — ${selected?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust}>Save</Button>
          </>
        }
      >
        <Input
          label="New Quantity"
          type="number"
          min={0}
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
        />
        <div style={{ marginTop: "1rem" }}>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

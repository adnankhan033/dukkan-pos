import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Tags, Users } from "lucide-react";
import {
  priceListService,
  PRICE_LIST_KINDS,
  priceListKindLabel,
} from "../services/PriceListService";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { useConfirm } from "../hooks/useConfirm";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import SearchableSelect from "../components/common/SearchableSelect";
import { Card } from "../components/common/Card";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import FormValidationAlert from "../components/common/FormValidationAlert";
import { notify } from "../utils/notify";
import { required, runFormValidation } from "../utils/validation";
import { formatCurrency, formatDbError } from "../utils/format";
import { useSettingsStore } from "../contexts/store";
import "./Wholesale.css";

const emptyListForm = {
  name: "",
  kind: "wholesale",
  notes: "",
  is_default: false,
  is_active: true,
};

export default function Wholesale() {
  const currency = useSettingsStore((s) => s.settings?.currency) || "SAR";
  const { submitting, guard } = useSubmitGuard();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyListForm);
  const [errors, setErrors] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [productId, setProductId] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [minQty, setMinQty] = useState("1");
  const [customerId, setCustomerId] = useState("");

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await priceListService.list());
      setError("");
    } catch (err) {
      setLists([]);
      setError(formatDbError(err) || "Could not load wholesale price lists.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    const [list, nextItems, nextCustomers, products, people] = await Promise.all([
      priceListService.get(id),
      priceListService.listItems(id),
      priceListService.listCustomers(id),
      priceListService.searchProducts(),
      priceListService.searchCustomers(),
    ]);
    setDetail(list);
    setItems(nextItems);
    setCustomers(nextCustomers);
    setProductOptions(products);
    setCustomerOptions(people);
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setItems([]);
      setCustomers([]);
      return;
    }
    loadDetail(selectedId).catch((err) => {
      notify.error(formatDbError(err) || "Could not open this price list.");
      setSelectedId(null);
    });
  }, [selectedId, loadDetail]);

  const productSelectOptions = useMemo(
    () =>
      productOptions.map((product) => ({
        value: String(product.id),
        label: product.barcode ? `${product.name} · ${product.barcode}` : product.name,
      })),
    [productOptions]
  );

  const customerSelectOptions = useMemo(
    () =>
      customerOptions.map((customer) => ({
        value: String(customer.id),
        label: customer.phone ? `${customer.name} · ${customer.phone}` : customer.name,
      })),
    [customerOptions]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyListForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(list) {
    setEditing(list);
    setForm({
      name: list.name || "",
      kind: list.kind || "wholesale",
      notes: list.notes || "",
      is_default: Number(list.is_default) === 1,
      is_active: Number(list.is_active) !== 0,
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleSaveList(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      notes: form.notes.trim(),
      is_default: form.is_default,
      is_active: form.is_active,
    };
    const validation = runFormValidation({ name: required(payload.name, "Name") });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    try {
      const outcome = await guard(async () => {
        if (editing) return priceListService.update(editing.id, payload);
        return priceListService.create(payload);
      });
      if (outcome?.skipped) return;
      setModalOpen(false);
      notify.success(editing ? "Price list updated." : "Price list created.");
      await loadLists();
      if (!editing && outcome?.result?.id) setSelectedId(outcome.result.id);
    } catch (err) {
      setErrors({ form: formatDbError(err) || "Could not save the price list." });
    }
  }

  async function handleDeleteList(list) {
    const ok = await confirm({
      title: "Delete price list?",
      message: `Delete "${list.name}"? Product prices and customer links on this list will be removed. Retail POS prices are not changed.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await priceListService.remove(list.id);
      if (selectedId === list.id) setSelectedId(null);
      await loadLists();
      notify.success(`Deleted "${list.name}".`);
    } catch (err) {
      notify.error(formatDbError(err) || "Could not delete this price list.");
    }
  }

  async function handleAddProduct() {
    if (!selectedId) return;
    try {
      await priceListService.addItem(selectedId, {
        product_id: productId,
        price: productPrice,
        min_qty: minQty,
      });
      setProductId("");
      setProductPrice("");
      setMinQty("1");
      await loadDetail(selectedId);
      await loadLists();
      notify.success("Product price saved.");
    } catch (err) {
      notify.error(formatDbError(err) || "Could not add this product.");
    }
  }

  async function handleRemoveProduct(item) {
    await priceListService.removeItem(item.id);
    await loadDetail(selectedId);
    await loadLists();
  }

  async function handleAssignCustomer() {
    if (!selectedId) return;
    try {
      await priceListService.assignCustomer(selectedId, customerId);
      setCustomerId("");
      await loadDetail(selectedId);
      await loadLists();
      notify.success("Customer linked to this list.");
    } catch (err) {
      notify.error(formatDbError(err) || "Could not link this customer.");
    }
  }

  async function handleUnassignCustomer(row) {
    await priceListService.unassignCustomer(row.assignment_id);
    await loadDetail(selectedId);
    await loadLists();
  }

  function onPickProduct(id) {
    setProductId(id);
    const product = productOptions.find((item) => String(item.id) === String(id));
    if (product && productPrice === "") {
      setProductPrice(String(product.selling_price ?? ""));
    }
  }

  if (selectedId && detail) {
    return (
      <div>
        {confirmDialog}
        <PageHeader
          title={detail.name}
          subtitle={`${priceListKindLabel(detail.kind)} prices. Shop POS still uses each product’s retail price.`}
          actions={
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={16} /> All price lists
            </Button>
          }
        />

        <Card className="wholesale-toolbar">
          <div>
            <Badge variant={Number(detail.is_active) ? "success" : "neutral"}>
              {Number(detail.is_active) ? "Active" : "Off"}
            </Badge>
            {Number(detail.is_default) ? <Badge variant="info">Default</Badge> : null}
          </div>
          <Button variant="secondary" size="sm" onClick={() => openEdit(detail)}>
            <Pencil size={14} /> Rename / type
          </Button>
        </Card>

        <div className="wholesale-split">
          <Card className="wholesale-panel">
            <h3>
              <Tags size={16} /> Product prices
            </h3>
            <p className="wholesale-hint">Set the bulk price. Retail price on the product card does not change.</p>
            <div className="wholesale-add-row">
              <SearchableSelect
                label="Product"
                value={productId}
                onChange={onPickProduct}
                options={productSelectOptions}
                placeholder="Search products"
                noneLabel="Choose a product"
              />
              <Input
                label="Wholesale price"
                type="number"
                min="0"
                step="0.01"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
              />
              <Input
                label="Min qty"
                type="number"
                min="1"
                step="1"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
              <Button onClick={handleAddProduct} disabled={!productId}>
                Add
              </Button>
            </div>
            <Table
              emptyMessage="No products on this list yet."
              columns={[
                { key: "product_name", label: "Product" },
                {
                  key: "retail_price",
                  label: "Retail",
                  render: (row) => formatCurrency(row.retail_price, currency),
                },
                {
                  key: "price",
                  label: "Wholesale",
                  render: (row) => formatCurrency(row.price, currency),
                },
                { key: "min_qty", label: "Min qty" },
                {
                  key: "actions",
                  label: "",
                  stopPropagation: true,
                  render: (row) => (
                    <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleRemoveProduct(row)}>
                      <Trash2 size={16} />
                    </Button>
                  ),
                },
              ]}
              data={items}
            />
          </Card>

          <Card className="wholesale-panel">
            <h3>
              <Users size={16} /> Customers on this list
            </h3>
            <p className="wholesale-hint">These customers can use this wholesale price. Everyone else stays on retail.</p>
            <div className="wholesale-add-row">
              <SearchableSelect
                label="Customer"
                value={customerId}
                onChange={setCustomerId}
                options={customerSelectOptions}
                placeholder="Search customers"
                noneLabel="Choose a customer"
              />
              <Button onClick={handleAssignCustomer} disabled={!customerId}>
                Link
              </Button>
            </div>
            <Table
              emptyMessage="No customers linked yet."
              columns={[
                { key: "name", label: "Customer" },
                { key: "phone", label: "Phone", render: (row) => row.phone || "—" },
                {
                  key: "actions",
                  label: "",
                  stopPropagation: true,
                  render: (row) => (
                    <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleUnassignCustomer(row)}>
                      <Trash2 size={16} />
                    </Button>
                  ),
                },
              ]}
              data={customers}
            />
          </Card>
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Price list"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button form="wholesale-list-form" type="submit" disabled={submitting}>
                Save
              </Button>
            </>
          }
        >
          <ListForm form={form} setForm={setForm} errors={errors} onSubmit={handleSaveList} />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Wholesale prices"
        subtitle="Give shops and distributors a bulk price. The POS still sells at the normal retail price."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> New price list
          </Button>
        }
      />

      {error ? (
        <Alert type="error">{error}</Alert>
      ) : loading ? (
        <LoadingSpinner />
      ) : lists.length === 0 ? (
        <Card className="wholesale-empty">
          <Tags size={28} />
          <h3>No wholesale prices yet</h3>
          <p>
            Create a list such as “Shops” or “Distributor”. Then add products and the bulk price. Retail checkout does
            not change.
          </p>
          <Button onClick={openCreate}>
            <Plus size={16} /> Create a price list
          </Button>
        </Card>
      ) : (
        <Table
          onRowClick={(row) => setSelectedId(row.id)}
          emptyMessage="No price lists."
          columns={[
            { key: "name", label: "Name" },
            { key: "kind", label: "Type", render: (row) => priceListKindLabel(row.kind) },
            { key: "item_count", label: "Products" },
            { key: "customer_count", label: "Customers" },
            {
              key: "is_active",
              label: "Status",
              render: (row) => (
                <Badge variant={Number(row.is_active) ? "success" : "neutral"}>
                  {Number(row.is_active) ? "Active" : "Off"}
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "",
              stopPropagation: true,
              render: (row) => (
                <div className="table-actions">
                  <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEdit(row)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDeleteList(row)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ),
            },
          ]}
          data={lists}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit price list" : "New price list"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button form="wholesale-list-form" type="submit" disabled={submitting}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <ListForm form={form} setForm={setForm} errors={errors} onSubmit={handleSaveList} />
      </Modal>
    </div>
  );
}

function ListForm({ form, setForm, errors, onSubmit }) {
  return (
    <form id="wholesale-list-form" onSubmit={onSubmit}>
      <FormValidationAlert errors={errors} />
      <Input
        label="Name"
        value={form.name}
        error={errors.name}
        placeholder="e.g. Shop wholesale"
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />
      <div style={{ marginTop: "1rem" }}>
        <Select
          label="Who is this for?"
          value={form.kind}
          onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
        >
          {PRICE_LIST_KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </Select>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <Textarea
          label="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
      <label className="wholesale-check">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
        />
        Active
      </label>
      <label className="wholesale-check">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
        />
        Default wholesale list
      </label>
    </form>
  );
}

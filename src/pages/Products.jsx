import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Package, FileSpreadsheet } from "lucide-react";
import { productService } from "../services/ProductService";
import { onCatalogChanged } from "../services/CatalogSync";
import { categoryService } from "../services/CategoryService";
import { unitService } from "../services/UnitService";
import { supplierService } from "../services/SupplierService";
import { useSettingsStore } from "../contexts/store";
import { useDebounce } from "../hooks/usePagination";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { useConfirm } from "../hooks/useConfirm";
import { usePermissions } from "../hooks/usePermissions";
import { compressImageFile } from "../utils/image";
import { PRODUCTS_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Select } from "../components/common/Input";
import SearchableSelect from "../components/common/SearchableSelect";
import Badge from "../components/common/Badge";
import { LoadingSpinner } from "../components/common/Loading";
import { notify } from "../utils/notify";
import { formatCurrency, formatQuantity } from "../utils/format";
import { required, positiveNumber, runFormValidation } from "../utils/validation";
import { translateToArabic } from "../utils/translate";
import ProductNameFields from "../components/products/ProductNameFields";
import ProductVatFields from "../components/products/ProductVatFields";
import ProductBarcodeScanner from "../components/products/ProductBarcodeScanner";
import { VAT_PRICE_TYPE, vatIncludedToPriceType } from "../utils/vatPricing";
import ProductImportExportModal from "../components/products/ProductImportExportModal";
import FormValidationAlert from "../components/common/FormValidationAlert";
import "./Products.css";

const FORM_ID = "product-form";

const emptyForm = {
  name: "",
  name_ar: "",
  sku: "",
  barcode: "",
  category_id: "",
  unit_id: "",
  supplier_id: "",
  cost_price: "",
  selling_price: "",
  tax_category: "standard",
  vat_rate: "",
  vat_price_type: VAT_PRICE_TYPE.INHERIT,
  quantity: "",
  min_stock: "",
  published: true,
  image: "",
};

export default function Products() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const { submitting, guard } = useSubmitGuard();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { canPerformAction } = usePermissions();
  const canCreate = canPerformAction("products_create");
  const canEdit = canPerformAction("products_edit");
  const canDelete = canPerformAction("products_delete");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [section, setSection] = useState("published");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [imageLoading, setImageLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const debouncedSearch = useDebounce(search);

  const isPublishedSection = section === "published";

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setInitialLoading(true);
    try {
      const result = await productService.getAll({
        search: debouncedSearch,
        categoryId: categoryFilter || null,
        published: isPublishedSection,
        page,
        limit: PRODUCTS_PAGE_SIZE,
      });
      setProducts(result.items);
      setTotal(result.total);
      setSelectedIds(new Set());
    } catch (err) {
      setProducts([]);
      setTotal(0);
      notify.error(err.message || "Failed to load products. Restart the app and try again.", {
        title: "Load failed",
      });
    } finally {
      if (!silent) setInitialLoading(false);
    }
  }, [debouncedSearch, categoryFilter, page, isPublishedSection]);

  useEffect(() => {
    Promise.all([
      categoryService.getAll(),
      unitService.getAll(),
      supplierService.getAll({ limit: 200, page: 1 }),
    ]).then(([cats, unitList, supplierList]) => {
      setCategories(cats);
      setUnits(unitList);
      setSuppliers(supplierList.items);
    });
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    return onCatalogChanged(() => {
      loadProducts(true);
    });
  }, [loadProducts]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, published: isPublishedSection });
    setErrors({});
    setModalOpen(true);
  }

  async function openEdit(product) {
    setErrors({});
    setModalOpen(true);
    setEditing(product);
    setForm({
      name: product.name,
      name_ar: product.name_ar || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      unit_id: product.unit_id ? String(product.unit_id) : "",
      supplier_id: product.supplier_id ? String(product.supplier_id) : "",
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      tax_category: product.tax_category || "standard",
      vat_rate: product.vat_rate != null ? String(product.vat_rate) : "",
      vat_price_type: vatIncludedToPriceType(product.vat_included),
      quantity: String(product.quantity),
      min_stock: String(product.min_stock),
      published: Boolean(Number(product.published ?? 1)),
      image: "",
    });
    if (product.has_image) {
      const full = await productService.getById(product.id);
      if (full?.image) setForm((f) => ({ ...f, image: full.image }));
    }
  }

  async function handleDelete(id, e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const product = products.find((p) => Number(p.id) === Number(id));
    const name = product?.name || "this product";

    const ok = await confirm({
      title: "Delete Product",
      message: `Delete "${name}" permanently? This cannot be undone. Past sale line items for this product will also be removed.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await productService.delete(id);
      notify.success(`"${name}" was deleted.`, { title: "Product deleted" });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadProducts(true);
    } catch (err) {
      notify.error(err.message || "Delete failed", { title: "Delete failed" });
    }
  }

  async function handleBulkPublish(published) {
    if (selectedIds.size === 0) return;

    const action = published ? "publish" : "unpublish";
    const ok = await confirm({
      title: published ? "Publish Selected" : "Unpublish Selected",
      message: `${published ? "Publish" : "Unpublish"} ${selectedIds.size} product(s)? ${
        published ? "They will appear in Sales." : "They will be hidden from Sales."
      }`,
      confirmLabel: published ? `Publish ${selectedIds.size}` : `Unpublish ${selectedIds.size}`,
      variant: "primary",
    });
    if (!ok) return;

    setBulkPublishing(true);
    try {
      await productService.setPublishedMany([...selectedIds], published);
      setSection(published ? "published" : "unpublished");
      await loadProducts(true);
      notify.success(`${selectedIds.size} product(s) ${published ? "published" : "unpublished"}.`, {
        title: published ? "Published" : "Unpublished",
      });
    } catch (err) {
      notify.error(err.message || `Bulk ${action} failed`, { title: "Bulk update failed" });
    } finally {
      setBulkPublishing(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;

    const ok = await confirm({
      title: "Delete Selected Products",
      message: `Delete ${selectedIds.size} product(s) permanently? This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.size} Items`,
      variant: "danger",
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const { deleted, failed } = await productService.deleteMany([...selectedIds]);
      if (failed.length > 0 && deleted.length === 0) {
        notify.error(failed.map((f) => f.message).join("; "), { title: "Delete failed" });
      } else if (failed.length > 0) {
        notify.warning(
          `Deleted ${deleted.length}. Failed ${failed.length}: ${failed.map((f) => f.message).join("; ")}`,
          { title: "Partial delete" }
        );
      } else {
        notify.success(`${deleted.length} product(s) deleted.`, { title: "Products deleted" });
      }
      await loadProducts(true);
    } catch (err) {
      notify.error(err.message || "Bulk delete failed", { title: "Delete failed" });
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelect(id) {
    const numId = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => Number(p.id))));
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    try {
      const compressed = await compressImageFile(file);
      setForm((f) => ({ ...f, image: compressed }));
    } catch (err) {
      setErrors({ image: err.message });
    } finally {
      setImageLoading(false);
    }
  }

  async function handleTranslateArabic(sourceName) {
    const englishName = (sourceName ?? form.name)?.trim();
    if (!englishName) return;

    setTranslating(true);
    setErrors((prev) => ({ ...prev, name_ar: undefined, translate: undefined }));
    try {
      const translated = await translateToArabic(englishName);
      setForm((f) => ({ ...f, name_ar: translated }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, translate: err.message }));
    } finally {
      setTranslating(false);
    }
  }

  function applyBarcodeLookup(patch) {
    setForm((prev) => ({
      ...prev,
      ...patch,
      category_id: patch.category_id ? String(patch.category_id) : prev.category_id,
      unit_id: patch.unit_id ? String(patch.unit_id) : prev.unit_id,
      supplier_id: prev.supplier_id,
      cost_price: prev.cost_price,
      selling_price: prev.selling_price,
      quantity: prev.quantity,
      min_stock: prev.min_stock,
      published: prev.published,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.name;
      delete next.form;
      return next;
    });
  }

  async function handleBarcodeDuplicate(product) {
    setModalOpen(false);
    await openEdit(product);
  }

  async function createCategoryOption(name) {
    const created = await categoryService.create({ name });
    setCategories((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );
    return String(created.id);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validation = runFormValidation({
      name: required(form.name, "Name"),
      selling_price: positiveNumber(form.selling_price, "Selling price"),
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        const payload = {
          ...form,
          name_ar: form.name_ar?.trim() || null,
          category_id: form.category_id ? Number(form.category_id) : null,
          unit_id: form.unit_id ? Number(form.unit_id) : null,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          published: form.published ? 1 : 0,
          image: form.image || (editing?.has_image ? undefined : null),
        };

        if (editing) {
          if (payload.image === undefined) delete payload.image;
          await productService.update(editing.id, payload);
          notify.success(`"${payload.name}" was updated.`, { title: "Product updated" });
        } else {
          await productService.create(payload);
          notify.success(`"${payload.name}" was created.`, { title: "Product created" });
        }

        setModalOpen(false);
        setErrors({});
        if (payload.published === 1) setSection("published");
        else setSection("unpublished");
        await loadProducts(true);
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    {
      key: "select",
      label: "",
      width: "40px",
      render: (row) => (
        <input
          type="checkbox"
          className="row-checkbox"
          checked={selectedIds.has(Number(row.id))}
          onChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "image",
      label: "",
      width: "50px",
      render: (row) => (
        <div className={`product-thumb-placeholder ${row.has_image ? "product-thumb-has-image" : ""}`}>
          <Package size={16} />
        </div>
      ),
    },
    { key: "name", label: "Product", render: (row) => (
      <div className="product-name-cell">
        <div className="product-name-en">{row.name}</div>
        {row.name_ar ? (
          <div className="product-name-ar" dir="rtl">{row.name_ar}</div>
        ) : (
          <div className="product-name-ar product-name-ar-empty">No Arabic name</div>
        )}
      </div>
    ) },
    { key: "sku", label: "SKU", render: (row) => row.sku || "-" },
    { key: "barcode", label: "Barcode", render: (row) => row.barcode || "-" },
    { key: "category_name", label: "Category", render: (row) => row.category_name || "-" },
    {
      key: "unit_symbol",
      label: "Unit",
      render: (row) => row.unit_symbol || "-",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge variant={row.published ? "success" : "neutral"}>
          {row.published ? "Published" : "Unpublished"}
        </Badge>
      ),
    },
    {
      key: "cost_price",
      label: "Cost",
      render: (row) => formatCurrency(row.cost_price, currency),
    },
    {
      key: "selling_price",
      label: "Price",
      render: (row) => formatCurrency(row.selling_price, currency),
    },
    {
      key: "quantity",
      label: "Stock",
      render: (row) => (
        <Badge variant={row.quantity <= row.min_stock ? "warning" : "success"}>
          {row.unit_symbol ? formatQuantity(row.quantity, row.unit_symbol) : row.quantity}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="btn-icon"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              <Pencil size={16} />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="btn-icon"
              type="button"
              onClick={(e) => handleDelete(row.id, e)}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage published products for sales and unpublished drafts."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportExportOpen(true)}>
              <FileSpreadsheet size={16} /> Import / Export
            </Button>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus size={16} /> Add Product
              </Button>
            )}
          </>
        }
      />

      <div className="product-tabs">
        <button
          type="button"
          className={`product-tab ${section === "published" ? "active" : ""}`}
          onClick={() => { setSection("published"); setPage(1); }}
        >
          Published
        </button>
        <button
          type="button"
          className={`product-tab ${section === "unpublished" ? "active" : ""}`}
          onClick={() => { setSection("unpublished"); setPage(1); }}
        >
          Unpublished
        </button>
      </div>

      <div className="page-header-actions" style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search products..."
        />
        <Select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: "200px" }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {products.length > 0 && (
        <div className="bulk-bar">
          <input
            type="checkbox"
            className="row-checkbox"
            checked={products.length > 0 && selectedIds.size === products.length}
            onChange={toggleSelectAll}
          />
          <span className="bulk-bar-count">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all on page"}
          </span>
          {selectedIds.size > 0 && (
            <>
              {canEdit && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={bulkPublishing || bulkDeleting}
                    onClick={() => handleBulkPublish(true)}
                  >
                    {bulkPublishing ? "Updating..." : "Publish Selected"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={bulkPublishing || bulkDeleting}
                    onClick={() => handleBulkPublish(false)}
                  >
                    {bulkPublishing ? "Updating..." : "Unpublish Selected"}
                  </Button>
                </>
              )}
              {canDelete && (
                <Button variant="danger" size="sm" disabled={bulkDeleting || bulkPublishing} onClick={handleBulkDelete}>
                  {bulkDeleting ? "Deleting..." : "Delete Selected"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </>
          )}
        </div>
      )}

      {initialLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Table
            columns={columns}
            data={products}
            emptyMessage={isPublishedSection ? "No published products" : "No unpublished products"}
          />
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PRODUCTS_PAGE_SIZE)}
            total={total}
            onPageChange={setPage}
            itemLabel="products"
          />
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Product" : "Add Product"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={submitting || imageLoading}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />

          {!editing && (
            <ProductBarcodeScanner
              active={modalOpen}
              categories={categories}
              units={units}
              onApply={applyBarcodeLookup}
              onDuplicate={handleBarcodeDuplicate}
              onTranslate={handleTranslateArabic}
              translating={translating}
              disabled={submitting || imageLoading}
            />
          )}

          <ProductNameFields
            name={form.name}
            nameAr={form.name_ar}
            onNameChange={(value) => {
              setForm({ ...form, name: value });
              if (errors.name || errors.form) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  delete next.form;
                  return next;
                });
              }
            }}
            onNameArChange={(value) => setForm({ ...form, name_ar: value })}
            onTranslate={() => handleTranslateArabic()}
            translating={translating}
            nameError={errors.name}
            translateError={errors.translate}
          />

          <div className="form-row">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Input label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <SearchableSelect
              label="Category"
              value={form.category_id}
              onChange={(categoryId) => setForm({ ...form, category_id: categoryId })}
              options={categories.map((c) => ({
                value: String(c.id),
                label: c.name,
                hint: c.product_count ? `${c.product_count} products` : undefined,
              }))}
              placeholder="Search or create category…"
              creatable
              onCreateOption={createCategoryOption}
            />
            <SearchableSelect
              label="Unit"
              value={form.unit_id}
              onChange={(unitId) => setForm({ ...form, unit_id: unitId })}
              options={units.map((u) => ({
                value: String(u.id),
                label: u.name,
                hint: u.symbol,
              }))}
              placeholder="Search unit…"
            />
            <SearchableSelect
              label="Supplier"
              value={form.supplier_id}
              onChange={(supplierId) => setForm({ ...form, supplier_id: supplierId })}
              options={suppliers.map((s) => ({
                value: String(s.id),
                label: s.company,
              }))}
              placeholder="Search supplier…"
            />
            <Input label="Cost Price" type="number" step="0.01" min={0} value={form.cost_price} onChange={(e) => { setForm({ ...form, cost_price: e.target.value }); setErrors((p) => ({ ...p, cost_price: undefined, form: undefined })); }} error={errors.cost_price} />
            <Input label="Selling Price *" type="number" step="0.01" min={0} value={form.selling_price} onChange={(e) => { setForm({ ...form, selling_price: e.target.value }); setErrors((p) => ({ ...p, selling_price: undefined, form: undefined })); }} error={errors.selling_price} />
            <Input label="Quantity " type="number" min={0} value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setErrors((p) => ({ ...p, quantity: undefined, form: undefined })); }} error={errors.quantity} />
            <Input label="Min Stock" type="number" min={0} value={form.min_stock} onChange={(e) => { setForm({ ...form, min_stock: e.target.value }); setErrors((p) => ({ ...p, min_stock: undefined, form: undefined })); }} error={errors.min_stock} />
          </div>

          <ProductVatFields
            form={form}
            currency={currency}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <label className="publish-checkbox-row">
            <input
              type="checkbox"
              className="row-checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            <span>
              <strong>Published</strong>
              <small>Visible in Sales POS when checked. Uncheck to save as unpublished draft.</small>
            </span>
          </label>

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label className="form-label">Product Image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={imageLoading} />
            {imageLoading && <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Compressing image...</p>}
            {errors.image && <span className="form-error">{errors.image}</span>}
            {form.image && <img src={form.image} alt="Preview" className="image-preview" style={{ marginTop: "0.5rem" }} />}
          </div>
        </form>
      </Modal>

      <ProductImportExportModal
        isOpen={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        onComplete={() => loadProducts(true)}
      />

      {confirmDialog}
    </div>
  );
}

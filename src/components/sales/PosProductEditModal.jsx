import { useEffect, useMemo, useState } from "react";
import { productService } from "../../services/ProductService";
import { categoryService } from "../../services/CategoryService";
import { unitService } from "../../services/UnitService";
import { supplierService } from "../../services/SupplierService";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import { compressImageFile } from "../../utils/image";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Input } from "../common/Input";
import SearchableSelect from "../common/SearchableSelect";
import ProductNameFields from "../products/ProductNameFields";
import ProductVatFields, { productVatToFormFields } from "../products/ProductVatFields";
import ProductBarcodeScanner from "../products/ProductBarcodeScanner";
import ProductValueTotals from "../products/ProductValueTotals";
import { productToVatMode, vatModeToDbFields } from "../../utils/vatPricing";
import { computeProductValueTotals } from "../../utils/productValue";
import FormValidationAlert from "../common/FormValidationAlert";
import { LoadingSpinner } from "../common/Loading";
import { required, positiveNumber, runFormValidation } from "../../utils/validation";
import { translateToArabic } from "../../utils/translate";
import "../../pages/Products.css";
import "./PosProductEditModal.css";

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
  vat_mode: "default",
  quantity: "",
  min_stock: "",
  published: true,
  image: "",
};

function productToForm(row) {
  return {
    name: row.name || "",
    name_ar: row.name_ar || "",
    sku: row.sku || "",
    barcode: row.barcode || "",
    category_id: row.category_id ? String(row.category_id) : "",
    unit_id: row.unit_id ? String(row.unit_id) : "",
    supplier_id: row.supplier_id ? String(row.supplier_id) : "",
    cost_price: String(row.cost_price ?? ""),
    selling_price: String(row.selling_price ?? ""),
    ...productVatToFormFields(row),
    quantity: String(row.quantity ?? ""),
    min_stock: String(row.min_stock ?? ""),
    published: Boolean(Number(row.published ?? 1)),
    image: "",
  };
}

export default function PosProductEditModal({ isOpen, productId, currency = "SAR", onClose, onSaved }) {
  const { submitting, guard } = useSubmitGuard();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [translating, setTranslating] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const formValueTotals = useMemo(
    () => computeProductValueTotals(form),
    [form]
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    Promise.all([
      categoryService.getAll(),
      unitService.getAll(),
      supplierService.getAll({ limit: 200, page: 1 }),
    ])
      .then(([cats, unitList, supplierList]) => {
        if (!cancelled) {
          setCategories(cats);
          setUnits(unitList);
          setSuppliers(supplierList.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
          setUnits([]);
          setSuppliers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !productId) {
      setProduct(null);
      setForm(emptyForm);
      setErrors({});
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrors({});

    productService
      .getById(productId)
      .then(async (row) => {
        if (cancelled) return;
        if (!row) {
          setErrors({ form: "Product not found" });
          setProduct(null);
          return;
        }

        setProduct(row);
        const nextForm = productToForm(row);
        if (row.image) nextForm.image = row.image;
        setForm(nextForm);
      })
      .catch((err) => {
        if (!cancelled) setErrors({ form: err.message || "Failed to load product" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId]);

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function clearFieldErrors(...keys) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      delete next.form;
      return next;
    });
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
    clearFieldErrors("name");
  }

  function handleBarcodeDuplicate(localProduct) {
    if (Number(localProduct.id) === Number(productId)) {
      applyBarcodeLookup({ barcode: localProduct.barcode || form.barcode });
      return;
    }
    setErrors({
      form: `"${localProduct.name}" already uses this barcode. Choose a different barcode.`,
    });
  }

  async function createCategoryOption(name) {
    const created = await categoryService.create({ name });
    setCategories((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );
    return String(created.id);
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    try {
      const compressed = await compressImageFile(file);
      updateForm({ image: compressed });
      clearFieldErrors("image");
    } catch (err) {
      setErrors((prev) => ({ ...prev, image: err.message }));
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
      updateForm({ name_ar: translated });
    } catch (err) {
      setErrors((prev) => ({ ...prev, translate: err.message }));
    } finally {
      setTranslating(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!product) return;

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
          image: form.image || (product.image ? undefined : null),
        };

        if (payload.image === undefined) delete payload.image;

        await productService.update(product.id, payload);

        const unit = units.find((u) => Number(u.id) === Number(form.unit_id));
        const category = categories.find((c) => Number(c.id) === Number(form.category_id));

        const vatFields = vatModeToDbFields(form.vat_mode || "default");

        onSaved?.({
          id: product.id,
          name: payload.name.trim(),
          name_ar: payload.name_ar || "",
          barcode: payload.barcode?.trim() || "",
          selling_price: Number(form.selling_price),
          tax_category: vatFields.tax_category,
          vat_rate: vatFields.vat_rate,
          vat_included: vatFields.vat_included,
          vat_mode: form.vat_mode || "default",
          unit_symbol: unit?.symbol || product.unit_symbol || "pcs",
          category_name: category?.name || product.category_name || "",
          quantity: Number(form.quantity) || 0,
        });
        onClose();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit — ${product.name}` : "Edit product"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="pos-product-edit-form"
            disabled={submitting || loading || imageLoading || !product}
          >
            {submitting ? "Saving…" : "Save & update cart"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="pos-product-edit-loading">
          <LoadingSpinner message="Loading product…" />
        </div>
      ) : (
        <form id="pos-product-edit-form" className="pos-product-edit-form" onSubmit={handleSubmit} noValidate>
          <p className="pos-product-edit-hint">
            Full product details — saved to the catalog and applied to this item in the cart.
          </p>

          <FormValidationAlert errors={errors} />

          <ProductBarcodeScanner
            active={isOpen && !loading}
            categories={categories}
            units={units}
            excludeProductId={product?.id}
            onApply={applyBarcodeLookup}
            onDuplicate={handleBarcodeDuplicate}
            onTranslate={handleTranslateArabic}
            translating={translating}
            disabled={submitting || imageLoading}
            title="Scan barcode"
            description="Scan or type a barcode — matching fields fill in below when found."
          />

          <ProductNameFields
            name={form.name}
            nameAr={form.name_ar}
            onNameChange={(value) => {
              updateForm({ name: value });
              clearFieldErrors("name");
            }}
            onNameArChange={(value) => updateForm({ name_ar: value })}
            onTranslate={() => handleTranslateArabic()}
            translating={translating}
            nameError={errors.name}
            translateError={errors.translate}
          />

          <div className="form-row">
            <Input
              label="SKU"
              value={form.sku}
              onChange={(e) => updateForm({ sku: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="Barcode"
              value={form.barcode}
              onChange={(e) => updateForm({ barcode: e.target.value })}
              autoComplete="off"
            />
            <SearchableSelect
              label="Category"
              value={form.category_id}
              onChange={(categoryId) => updateForm({ category_id: categoryId })}
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
              onChange={(unitId) => updateForm({ unit_id: unitId })}
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
              onChange={(supplierId) => updateForm({ supplier_id: supplierId })}
              options={suppliers.map((s) => ({
                value: String(s.id),
                label: s.company,
              }))}
              placeholder="Search supplier…"
            />
            <Input
              label={`Cost price (${currency})`}
              type="number"
              step="0.01"
              min={0}
              value={form.cost_price}
              onChange={(e) => {
                updateForm({ cost_price: e.target.value });
                clearFieldErrors("cost_price");
              }}
              error={errors.cost_price}
              autoComplete="off"
            />
            <Input
              label={`Selling price (${currency}) *`}
              type="number"
              step="0.01"
              min={0}
              value={form.selling_price}
              onChange={(e) => {
                updateForm({ selling_price: e.target.value });
                clearFieldErrors("selling_price");
              }}
              error={errors.selling_price}
              autoComplete="off"
            />
            <Input
              label="Quantity"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => {
                updateForm({ quantity: e.target.value });
                clearFieldErrors("quantity");
              }}
              error={errors.quantity}
              autoComplete="off"
            />
            <Input
              label="Min stock"
              type="number"
              min={0}
              value={form.min_stock}
              onChange={(e) => {
                updateForm({ min_stock: e.target.value });
                clearFieldErrors("min_stock");
              }}
              error={errors.min_stock}
              autoComplete="off"
            />
          </div>
          <ProductValueTotals
            compact
            quantity={formValueTotals.quantity}
            purchaseTotal={formValueTotals.purchaseTotal}
            sellingTotal={formValueTotals.sellingTotal}
            currency={currency}
            unitSymbol={units.find((u) => String(u.id) === String(form.unit_id))?.symbol}
          />

          <ProductVatFields form={form} currency={currency} onChange={updateForm} />

          <label className="publish-checkbox-row">
            <input
              type="checkbox"
              className="row-checkbox"
              checked={form.published}
              onChange={(e) => updateForm({ published: e.target.checked })}
            />
            <span>
              <strong>Published</strong>
              <small>Visible in Sales POS when checked. Uncheck to hide from the catalog.</small>
            </span>
          </label>

          <div className="form-group pos-product-edit-image">
            <label className="form-label">Product image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={imageLoading || submitting} />
            {imageLoading && (
              <p className="pos-product-edit-image-status">Compressing image…</p>
            )}
            {errors.image && <span className="form-error">{errors.image}</span>}
            {form.image && (
              <img src={form.image} alt="Product preview" className="image-preview pos-product-edit-preview" />
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { productService } from "../../services/ProductService";
import { categoryService } from "../../services/CategoryService";
import { unitService } from "../../services/UnitService";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Input } from "../common/Input";
import ProductNameFields from "../products/ProductNameFields";
import ProductBarcodeScanner from "../products/ProductBarcodeScanner";
import FormValidationAlert from "../common/FormValidationAlert";
import { LoadingSpinner } from "../common/Loading";
import { required, positiveNumber, runFormValidation } from "../../utils/validation";
import { translateToArabic } from "../../utils/translate";
import "./PosProductEditModal.css";

export default function PosProductEditModal({ isOpen, productId, currency = "SAR", onClose, onSaved }) {
  const { submitting, guard } = useSubmitGuard();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ name: "", name_ar: "", selling_price: "", barcode: "" });
  const [errors, setErrors] = useState({});
  const [translating, setTranslating] = useState(false);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    Promise.all([categoryService.getAll(), unitService.getAll()])
      .then(([cats, unitList]) => {
        if (!cancelled) {
          setCategories(cats);
          setUnits(unitList);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
          setUnits([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !productId) {
      setProduct(null);
      setErrors({});
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrors({});

    productService
      .getById(productId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setErrors({ form: "Product not found" });
          setProduct(null);
          return;
        }
        setProduct(row);
        setForm({
          name: row.name || "",
          name_ar: row.name_ar || "",
          selling_price: String(row.selling_price ?? ""),
          barcode: row.barcode || "",
        });
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

  function applyBarcodeScan(patch) {
    if (!patch?.barcode) return;
    setForm((f) => ({ ...f, barcode: patch.barcode }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.form;
      return next;
    });
  }

  function handleBarcodeDuplicate(localProduct) {
    setErrors({
      form: `"${localProduct.name}" already uses this barcode. Choose a different barcode.`,
    });
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
          name: form.name.trim(),
          name_ar: form.name_ar?.trim() || null,
          sku: product.sku || null,
          barcode: form.barcode?.trim() || null,
          category_id: product.category_id || null,
          unit_id: product.unit_id || null,
          supplier_id: product.supplier_id || null,
          cost_price: product.cost_price ?? 0,
          selling_price: Number(form.selling_price),
          quantity: product.quantity ?? 0,
          min_stock: product.min_stock ?? 0,
          published: product.published ?? 1,
        };

        await productService.update(product.id, payload);

        onSaved?.({
          id: product.id,
          name: payload.name,
          name_ar: payload.name_ar || "",
          barcode: payload.barcode || "",
          selling_price: payload.selling_price,
          unit_symbol: product.unit_symbol || "pcs",
          category_name: product.category_name,
          quantity: product.quantity,
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
      title="Edit product"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="pos-product-edit-form" disabled={submitting || loading || !product}>
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
        <form id="pos-product-edit-form" className="pos-product-edit-form" onSubmit={handleSubmit}>
          <p className="pos-product-edit-hint">
            Changes are saved to the catalog and applied to this item in the cart.
          </p>

          <FormValidationAlert errors={errors} />

          <ProductBarcodeScanner
            active={isOpen && !loading}
            categories={categories}
            units={units}
            excludeProductId={product?.id}
            onApply={applyBarcodeScan}
            onDuplicate={handleBarcodeDuplicate}
            disabled={submitting}
            title="Scan barcode"
            description="Scan or type a barcode — it will be added to the barcode field below."
          />

          <ProductNameFields
            name={form.name}
            nameAr={form.name_ar}
            onNameChange={(value) => setForm((f) => ({ ...f, name: value }))}
            onNameArChange={(value) => setForm((f) => ({ ...f, name_ar: value }))}
            onTranslate={() => handleTranslateArabic()}
            translating={translating}
            nameError={errors.name}
            translateError={errors.translate}
          />

          <div className="pos-product-edit-prices">
            <Input
              label={`Selling price (${currency})`}
              type="number"
              step="0.01"
              min="0"
              value={form.selling_price}
              onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
              error={errors.selling_price}
              autoComplete="off"
            />
            <Input
              label="Barcode"
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
        </form>
      )}
    </Modal>
  );
}

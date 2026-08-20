import { useMemo } from "react";
import { Select } from "../common/Input";
import { useSettingsStore } from "../../contexts/store";
import {
  VAT_MODE,
  isTaxEnabled,
  previewVatBreakdown,
  productToVatMode,
  storeDefaultVatLabel,
  vatModeToDbFields,
} from "../../utils/vatPricing";
import "./ProductVatFields.css";

export default function ProductVatFields({ form, onChange, currency = "SAR" }) {
  const storeSettings = useSettingsStore((s) => s.settings);
  const taxOn = isTaxEnabled(storeSettings);
  const vatMode = form.vat_mode || VAT_MODE.DEFAULT;

  const preview = useMemo(() => {
    const dbFields = vatModeToDbFields(vatMode);
    return previewVatBreakdown(form.selling_price, storeSettings, dbFields);
  }, [form.selling_price, vatMode, storeSettings]);

  if (!taxOn) return null;

  const priceHint =
    vatMode === VAT_MODE.DEFAULT
      ? storeDefaultVatLabel(storeSettings)
      : vatMode === VAT_MODE.ZERO_RATED
        ? "Zero-rated — no VAT on this product (0%)."
        : "Exempt — no VAT on this product.";

  return (
    <div className="product-vat-fields">
      <Select
        label="VAT"
        value={vatMode}
        onChange={(e) => onChange({ vat_mode: e.target.value })}
      >
        <option value={VAT_MODE.DEFAULT}>{storeDefaultVatLabel(storeSettings)}</option>
        <option value={VAT_MODE.ZERO_RATED}>Zero-rated (0%)</option>
        <option value={VAT_MODE.EXEMPT}>Exempt (0%)</option>
      </Select>
      <p className="product-vat-hint">{priceHint}</p>
      {Number(form.selling_price) > 0 && vatMode === VAT_MODE.DEFAULT && preview.vatRate > 0 && (
        <p className="product-vat-preview">
          Preview: net {preview.net.toFixed(2)} {currency} + VAT {preview.vat.toFixed(2)} {currency} ={" "}
          {preview.gross.toFixed(2)} {currency}
        </p>
      )}
    </div>
  );
}

/** Map saved product VAT fields to the simplified form field. */
export function productVatToFormFields(product = {}) {
  return { vat_mode: productToVatMode(product) };
}

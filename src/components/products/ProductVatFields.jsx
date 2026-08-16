import { useMemo } from "react";
import { Input, Select } from "../common/Input";
import { useSettingsStore } from "../../contexts/store";
import {
  TAX_CATEGORY_OPTIONS,
  VAT_PRICE_TYPE,
  previewVatBreakdown,
} from "../../utils/vatPricing";
import "./ProductVatFields.css";

export default function ProductVatFields({ form, onChange, currency = "SAR" }) {
  const storeSettings = useSettingsStore((s) => s.settings);
  const storeVatIncluded = storeSettings.vat_included !== "0";

  const preview = useMemo(
    () =>
      previewVatBreakdown(form.selling_price, storeSettings, {
        tax_category: form.tax_category,
        vat_rate: form.vat_rate === "" ? null : form.vat_rate,
        vat_included:
          form.vat_price_type === VAT_PRICE_TYPE.INCLUSIVE
            ? 1
            : form.vat_price_type === VAT_PRICE_TYPE.EXCLUSIVE
              ? 0
              : null,
      }),
    [form.selling_price, form.tax_category, form.vat_rate, form.vat_price_type, storeSettings]
  );

  const priceHint =
    form.vat_price_type === VAT_PRICE_TYPE.INHERIT
      ? storeVatIncluded
        ? "Enter the shelf price customers pay (VAT included)."
        : "Enter the price before VAT is added at checkout."
      : form.vat_price_type === VAT_PRICE_TYPE.INCLUSIVE
        ? "Enter the final shelf price including VAT."
        : "Enter the net price before VAT.";

  return (
    <div className="product-vat-fields">
      <div className="form-row">
        <Select
          label="Tax category"
          value={form.tax_category || "standard"}
          onChange={(e) => onChange({ tax_category: e.target.value })}
        >
          {TAX_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select
          label="Price type"
          value={form.vat_price_type || VAT_PRICE_TYPE.INHERIT}
          onChange={(e) => onChange({ vat_price_type: e.target.value })}
        >
          <option value={VAT_PRICE_TYPE.INHERIT}>
            Store default ({storeVatIncluded ? "VAT inclusive" : "VAT exclusive"})
          </option>
          <option value={VAT_PRICE_TYPE.INCLUSIVE}>VAT inclusive (shelf price)</option>
          <option value={VAT_PRICE_TYPE.EXCLUSIVE}>VAT exclusive</option>
        </Select>
        <Input
          label="VAT rate override %"
          type="number"
          step="0.01"
          min={0}
          value={form.vat_rate}
          onChange={(e) => onChange({ vat_rate: e.target.value })}
          placeholder={`Store default (${storeSettings.vat_percent || "15"}%)`}
          disabled={form.tax_category !== "standard"}
        />
      </div>
      <p className="product-vat-hint">{priceHint}</p>
      {Number(form.selling_price) > 0 && form.tax_category === "standard" && preview.vatRate > 0 && (
        <p className="product-vat-preview">
          Preview: net {preview.net.toFixed(2)} {currency} + VAT {preview.vat.toFixed(2)} {currency} ={" "}
          {preview.gross.toFixed(2)} {currency}
        </p>
      )}
    </div>
  );
}

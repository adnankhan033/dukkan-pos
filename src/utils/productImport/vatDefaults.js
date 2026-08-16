import { TAX_CATEGORIES, resolveStoreVatIncluded } from "../vatPricing";

/** Default VAT values when import file has no tax columns. */
export const IMPORT_VAT_DEFAULTS = {
  tax_category: TAX_CATEGORIES.STANDARD,
  vat_rate: "",
  vat_price_type: "inherit",
};

/** Apply store VAT defaults for imported rows with blank tax columns. */
export function applyImportVatDefaults(parsed = {}, storeSettings = {}) {
  const tax_category = parsed.tax_category || IMPORT_VAT_DEFAULTS.tax_category;

  let vat_rate = parsed.vat_rate;
  if (tax_category !== TAX_CATEGORIES.STANDARD) {
    vat_rate = null;
  } else if (vat_rate === "" || vat_rate == null) {
    vat_rate = null;
  }

  let vat_included = parsed.vat_included;
  if (vat_included == null) {
    vat_included = resolveStoreVatIncluded(storeSettings) ? 1 : 0;
  }

  return {
    ...parsed,
    tax_category,
    vat_rate,
    vat_included,
  };
}

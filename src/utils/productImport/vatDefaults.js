import {
  TAX_CATEGORIES,
  VAT_MODE,
  parseVatModeInput,
  resolveStoreVatIncluded,
  vatModeToDbFields,
} from "../vatPricing";

/** Default VAT when import file has no vat column. */
export const IMPORT_VAT_DEFAULTS = {
  vat: VAT_MODE.DEFAULT,
};

function resolveImportVatMode(parsed = {}) {
  const fromVat = parseVatModeInput(parsed.vat);
  if (fromVat) return fromVat;

  const fromLegacy = parseVatModeInput(parsed.tax_category);
  if (fromLegacy && fromLegacy !== VAT_MODE.DEFAULT) return fromLegacy;
  if (parsed.tax_category === TAX_CATEGORIES.STANDARD) return VAT_MODE.DEFAULT;

  return IMPORT_VAT_DEFAULTS.vat;
}

/** Apply store VAT defaults for imported rows. */
export function applyImportVatDefaults(parsed = {}, storeSettings = {}) {
  const vatMode = resolveImportVatMode(parsed);
  const { tax_category, vat_rate, vat_included: inheritIncluded } = vatModeToDbFields(vatMode);

  let vat_included = inheritIncluded;
  if (vat_included == null && vatMode === VAT_MODE.DEFAULT) {
    vat_included = resolveStoreVatIncluded(storeSettings) ? 1 : 0;
  }

  return {
    ...parsed,
    tax_category,
    vat_rate,
    vat_included,
  };
}

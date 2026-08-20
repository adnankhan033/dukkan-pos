/** Receipt/invoice keys stored on each sale so reprints can keep the original layout. */
export const INVOICE_SETTING_KEYS = [
  "store_name",
  "store_name_ar",
  "store_address",
  "store_phone",
  "cr_number",
  "vat_registration",
  "vat_percent",
  "vat_included",
  "tax_enabled",
  "currency",
  "receipt_footer",
  "receipt_footer_ar",
  "receipt_branding",
  "receipt_show_qr",
  "receipt_show_bilingual",
  "receipt_show_tax_info",
  "receipt_section_store_header",
  "receipt_section_invoice_meta",
  "receipt_section_invoice_title",
  "receipt_section_header_note",
  "receipt_section_items",
  "receipt_section_totals",
  "receipt_section_payment",
  "receipt_section_footer",
  "receipt_section_branding",
  "receipt_paper_width",
  "receipt_header_note",
  "receipt_template",
];

export function isInvoiceUpdateExisting(settings = {}) {
  const value = settings.invoice_update_existing;
  return value === "1" || value === true || value === "true";
}

export function snapshotInvoiceSettings(settings = {}) {
  const snap = {};
  for (const key of INVOICE_SETTING_KEYS) {
    if (settings[key] !== undefined && settings[key] !== null) {
      snap[key] = settings[key];
    }
  }
  return snap;
}

export function parseInvoiceSettings(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Current store layout if the setting is on; otherwise the layout saved with the sale. */
export function resolvePrintSettings(sale, currentSettings = {}) {
  if (isInvoiceUpdateExisting(currentSettings)) return currentSettings;
  const snap = parseInvoiceSettings(sale?.invoice_settings);
  if (!snap) return currentSettings;
  return { ...currentSettings, ...snap };
}

/** Per-section visibility toggles for receipt / invoice output. */

export const RECEIPT_SECTION_KEYS = {
  STORE_HEADER: "receipt_section_store_header",
  INVOICE_META: "receipt_section_invoice_meta",
  INVOICE_TITLE: "receipt_section_invoice_title",
  HEADER_NOTE: "receipt_section_header_note",
  ITEMS: "receipt_section_items",
  TOTALS: "receipt_section_totals",
  PAYMENT: "receipt_section_payment",
  FOOTER: "receipt_section_footer",
  BRANDING: "receipt_section_branding",
};

export const RECEIPT_SECTION_DEFAULTS = {
  [RECEIPT_SECTION_KEYS.STORE_HEADER]: "1",
  [RECEIPT_SECTION_KEYS.INVOICE_META]: "1",
  [RECEIPT_SECTION_KEYS.INVOICE_TITLE]: "1",
  [RECEIPT_SECTION_KEYS.HEADER_NOTE]: "1",
  [RECEIPT_SECTION_KEYS.ITEMS]: "1",
  [RECEIPT_SECTION_KEYS.TOTALS]: "1",
  [RECEIPT_SECTION_KEYS.PAYMENT]: "1",
  [RECEIPT_SECTION_KEYS.FOOTER]: "1",
  [RECEIPT_SECTION_KEYS.BRANDING]: "1",
};

/** Settings UI — existing keys kept for backward compatibility. */
export const RECEIPT_SECTION_TOGGLES = [
  {
    key: RECEIPT_SECTION_KEYS.STORE_HEADER,
    label: "Store header",
    hint: "Store name, address, and phone",
  },
  {
    key: "receipt_show_tax_info",
    label: "Tax registration",
    hint: "CR and VAT numbers",
  },
  {
    key: RECEIPT_SECTION_KEYS.INVOICE_META,
    label: "Invoice details",
    hint: "Invoice number, date & time, customer",
  },
  {
    key: RECEIPT_SECTION_KEYS.INVOICE_TITLE,
    label: "Invoice title",
    hint: "Simplified Tax Invoice / فاتورة ضريبية مبسطة",
  },
  {
    key: RECEIPT_SECTION_KEYS.HEADER_NOTE,
    label: "Header note",
    hint: "Optional message above line items",
  },
  {
    key: RECEIPT_SECTION_KEYS.ITEMS,
    label: "Line items",
    hint: "Product table with quantities and prices",
  },
  {
    key: RECEIPT_SECTION_KEYS.TOTALS,
    label: "Totals",
    hint: "Taxable amount, VAT, total, received & change",
  },
  {
    key: RECEIPT_SECTION_KEYS.PAYMENT,
    label: "Payment method",
    hint: "Cash, card, or transfer row",
  },
  {
    key: "receipt_show_qr",
    label: "ZATCA QR code",
    hint: "Phase 1 or synced Phase 2 QR",
  },
  {
    key: RECEIPT_SECTION_KEYS.FOOTER,
    label: "Footer message",
    hint: "Thank-you text in English and Arabic",
  },
  {
    key: RECEIPT_SECTION_KEYS.BRANDING,
    label: "Powered by branding",
    hint: "Software vendor line at the bottom",
  },
];

function sectionOn(settings, key) {
  const value = settings?.[key];
  if (value === undefined || value === null || value === "") return true;
  return value !== "0" && value !== "false";
}

export function resolveReceiptSectionVisibility(settings = {}) {
  return {
    storeHeader: sectionOn(settings, RECEIPT_SECTION_KEYS.STORE_HEADER),
    invoiceMeta: sectionOn(settings, RECEIPT_SECTION_KEYS.INVOICE_META),
    invoiceTitle: sectionOn(settings, RECEIPT_SECTION_KEYS.INVOICE_TITLE),
    headerNote: sectionOn(settings, RECEIPT_SECTION_KEYS.HEADER_NOTE),
    items: sectionOn(settings, RECEIPT_SECTION_KEYS.ITEMS),
    totals: sectionOn(settings, RECEIPT_SECTION_KEYS.TOTALS),
    payment: sectionOn(settings, RECEIPT_SECTION_KEYS.PAYMENT),
    footer: sectionOn(settings, RECEIPT_SECTION_KEYS.FOOTER),
    branding: sectionOn(settings, RECEIPT_SECTION_KEYS.BRANDING),
    showTaxInfo: sectionOn(settings, "receipt_show_tax_info"),
    showQr: sectionOn(settings, "receipt_show_qr"),
    showBilingual: sectionOn(settings, "receipt_show_bilingual"),
  };
}

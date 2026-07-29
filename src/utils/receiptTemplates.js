/** Receipt template definitions for Saudi baqala / POS. */
export const RECEIPT_TEMPLATES = [
  {
    id: "baqala",
    label: "Saudi Baqala",
    labelAr: "بقالة — فاتورة سعودية",
    description: "Bilingual simplified tax invoice with ZATCA layout — recommended for grocery stores.",
    recommended: true,
  },
  {
    id: "classic",
    label: "Classic Thermal",
    labelAr: "إيصال حراري كلاسيكي",
    description: "Simple monospace receipt for basic thermal printers.",
  },
  {
    id: "compact",
    label: "Compact 58mm",
    labelAr: "مدمج ٥٨ ملم",
    description: "Minimal lines for small 58mm printers.",
  },
];

export const DEFAULT_RECEIPT_TEMPLATE = "baqala";

export function getReceiptTemplate(id) {
  return RECEIPT_TEMPLATES.find((t) => t.id === id) || RECEIPT_TEMPLATES[0];
}

/** Sample sale used in Settings preview and test print. */
export const SAMPLE_RECEIPT_SALE = {
  sale_number: "SALE-00042",
  created_at: new Date().toISOString(),
  subtotal: 43.48,
  discount: 0,
  vat: 6.52,
  total: 50,
  payment_method: "cash",
  amount_received: 50,
  change_due: 0,
  balance_due: 0,
};

export const SAMPLE_RECEIPT_ITEMS = [
  {
    name: "Fresh Milk 1L",
    name_ar: "حليب طازج ١ لتر",
    quantity: 2,
    unit_price: 6.5,
    total: 13,
  },
  {
    name: "Labneh",
    name_ar: "لبنة",
    quantity: 1,
    unit_price: 8,
    total: 8,
  },
  {
    name: "Saudi Dates 500g",
    name_ar: "تمر سعودي ٥٠٠ جم",
    quantity: 1,
    unit_price: 22.48,
    total: 22.48,
  },
];

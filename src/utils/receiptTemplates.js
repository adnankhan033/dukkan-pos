/** Receipt template definitions. The default layout uses the store name as its label. */
export const RECEIPT_TEMPLATES = [
  {
    id: "baqala",
    label: "Store invoice",
    labelAr: "فاتورة المتجر",
    description: "Bilingual invoice layout using your store name.",
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

/** Display label for a template — default layout uses the store name. */
export function receiptTemplateDisplay(tpl, storeName = "", storeNameAr = "") {
  if (tpl?.id === "baqala") {
    return {
      label: String(storeName || "").trim() || tpl.label,
      labelAr: String(storeNameAr || "").trim() || tpl.labelAr,
    };
  }
  return { label: tpl.label, labelAr: tpl.labelAr };
}

/** Sample sale used in Settings preview and test print — matches ZATCA simplified invoice totals. */
export const SAMPLE_RECEIPT_SALE = {
  sale_number: "INV-1",
  created_at: new Date().toISOString(),
  customer_name: "NA",
  subtotal: 8.26,
  discount: 0,
  vat: 1.24,
  total: 9.5,
  payment_method: "cash",
  amount_received: 10,
  change_due: 0.5,
  balance_due: 0,
};

export const SAMPLE_RECEIPT_ITEMS = [
  {
    name: "Ulker Tea Biscuits 147g",
    name_ar: "بسكويت شاي Ulker 147 جم",
    quantity: 2,
    unit_price: 2.175,
    total: 4.35,
  },
  {
    name: "teashop Digestive Biscuits 100g",
    name_ar: "بسكويت Digestive 100 جم",
    quantity: 3,
    unit_price: 1.303,
    total: 3.91,
  },
];

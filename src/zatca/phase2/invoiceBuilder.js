import { generateNumber } from "../../utils/format";

/** Build UBL 2.1 simplified tax invoice payload (placeholder structure). */
export function buildSimplifiedInvoicePayload({ sale, items, config }) {
  const counter = (config.chain.invoiceCounter || 0) + 1;

  return {
    invoiceType: "388",
    invoiceTypeName: "0211010",
    uuid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : generateNumber("INV"),
    icv: counter,
    issueDate: (sale.created_at || new Date().toISOString()).slice(0, 10),
    issueTime: (sale.created_at || new Date().toISOString()).slice(11, 19),
    saleNumber: sale.sale_number,
    seller: {
      name: config.company.name,
      nameAr: config.company.nameAr,
      vatNumber: config.company.vatNumber,
      crNumber: config.company.crNumber,
      address: config.company.address,
    },
    buyer: {
      name: sale.customer_name || "Walk-in Customer",
    },
    lineItems: (items || []).map((item, index) => ({
      id: index + 1,
      name: item.product_name || item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
      vatRate: config.vatPercent,
    })),
    totals: {
      subtotal: sale.subtotal,
      discount: sale.discount,
      vat: sale.vat,
      total: sale.total,
    },
    previousInvoiceHash: config.chain.previousInvoiceHash || "",
    device: config.device,
    environment: config.environment,
    note: "Placeholder UBL payload — full XML signing will be added with certificates.",
  };
}

/** Placeholder invoice hash until cryptographic signing is implemented. */
export function computePlaceholderInvoiceHash(invoicePayload) {
  const raw = JSON.stringify({
    uuid: invoicePayload.uuid,
    saleNumber: invoicePayload.saleNumber,
    total: invoicePayload.totals.total,
    icv: invoicePayload.icv,
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `PH-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

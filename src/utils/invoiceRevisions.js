export function originalInvoiceBalance(sale) {
  const originalTotal = Number(sale?.original_total ?? sale?.total) || 0;
  const paid = Number(sale?.amount_paid) || 0;
  return Math.max(0, originalTotal - paid);
}

export function parseRevisionList(value, fallbackCount = 0) {
  const fromList = String(value || "")
    .split(",")
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (fromList.length) return [...new Set(fromList)].sort((a, b) => a - b);
  const count = Number(fallbackCount) || 0;
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function revisionLabel(revision) {
  const n = Number(revision) || 1;
  if (n <= 1) return "Original";
  return `Revision ${n}`;
}

export function parseRevisionSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function buildInvoiceSnapshot(sale = {}) {
  return {
    sale_number: sale.sale_number,
    customer_id: sale.customer_id,
    customer_name: sale.customer_name,
    payment_method: sale.payment_method,
    payment_status: sale.payment_status,
    amount_paid: sale.amount_paid,
    subtotal: sale.subtotal,
    discount: sale.discount,
    vat: sale.vat,
    total: sale.total,
    invoice_settings: sale.invoice_settings,
    notes: sale.notes || null,
    items: (sale.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      name: item.product_name || item.name,
      name_ar: item.name_ar,
      barcode: item.barcode,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      total: item.total,
    })),
  };
}

export function mapRevisionRow(row) {
  const snapshot = parseRevisionSnapshot(row?.snapshot) || {};
  return {
    id: row.id,
    sale_id: row.sale_id,
    revision: Number(row.revision) || 1,
    created_at: row.created_at,
    created_by: row.created_by,
    created_by_name: row.created_by_name || "Staff",
    snapshot,
    items: snapshot.items || [],
    total: snapshot.total,
    subtotal: snapshot.subtotal,
    discount: snapshot.discount,
    vat: snapshot.vat,
  };
}

/** Live sale for the latest revision; snapshot overlay for older ones. */
export function saleViewForRevision(sale, revision) {
  if (!sale) return null;
  const currentRev = Number(sale.revision) || 1;
  const paymentStatus = sale.payment_status;
  const amountPaid = sale.amount_paid;
  const originalTotal = sale.original_total ?? sale.total;
  const frozenPayment = {
    original_total: originalTotal,
    payment_status: paymentStatus,
    amount_paid: amountPaid,
    balance_due: originalInvoiceBalance({
      original_total: originalTotal,
      amount_paid: amountPaid,
    }),
  };
  if (!revision || Number(revision.revision) === currentRev) {
    return {
      ...sale,
      items: sale.items || [],
      ...frozenPayment,
      viewingRevision: currentRev,
      isHistorical: false,
    };
  }
  const snap = revision.snapshot || {};
  return {
    ...sale,
    ...snap,
    id: sale.id,
    sale_number: sale.sale_number,
    status: sale.status,
    items: snap.items || [],
    ...frozenPayment,
    viewingRevision: Number(revision.revision) || 1,
    isHistorical: true,
  };
}

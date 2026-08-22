/** Shop-owner labels for debit / credit (KSA: مدين / دائن). */

export const DEBIT_LABEL = "Debit · مدين";
export const CREDIT_LABEL = "Credit · دائن";

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Build a running Debit/Credit statement.
 * customer: debit = invoice (they owe), credit = payment (they paid), balance = still due to us
 * supplier: credit = delivery (we owe), debit = payment (we paid), balance = still to pay
 */
export function buildDebitCreditStatement({ invoices = [], payments = [], party = "customer" } = {}) {
  const paidByInvoice = new Map();
  const lines = [];

  for (const payment of payments) {
    const invoiceId = Number(payment.invoiceId || payment.saleId || payment.sale_id || payment.purchaseId || payment.purchase_id || 0);
    const amount = money(payment.amount);
    if (amount <= 0) continue;
    if (invoiceId) {
      paidByInvoice.set(invoiceId, money((paidByInvoice.get(invoiceId) || 0) + amount));
    }
    lines.push({
      id: `p-${payment.id}`,
      date: payment.date || payment.payment_date || payment.created_at,
      details: payment.reference || payment.sale_number || payment.purchase_number || "Payment",
      note: payment.notes || "",
      debit: party === "supplier" ? amount : 0,
      credit: party === "customer" ? amount : 0,
      kind: "payment",
    });
  }

  for (const invoice of invoices) {
    const invoiced = money(invoice.original_total ?? invoice.total ?? invoice.amount);
    if (invoiced <= 0) continue;
    const id = Number(invoice.id);
    const recorded = paidByInvoice.get(id) || 0;
    const paidOnDoc = money(invoice.amount_paid ?? invoice.paid ?? 0);
    const leftoverPaid = Math.max(0, money(paidOnDoc - recorded));
    const reference = invoice.reference || invoice.sale_number || invoice.purchase_number || "Invoice";

    lines.push({
      id: `i-${invoice.id}`,
      date: invoice.date || invoice.created_at,
      details: reference,
      note: invoice.notes || "",
      debit: party === "customer" ? invoiced : 0,
      credit: party === "supplier" ? invoiced : 0,
      kind: "invoice",
    });

    if (leftoverPaid > 0.004) {
      lines.push({
        id: `i-paid-${invoice.id}`,
        date: invoice.date || invoice.created_at,
        details: `Paid with ${reference}`,
        note: "",
        debit: party === "supplier" ? leftoverPaid : 0,
        credit: party === "customer" ? leftoverPaid : 0,
        kind: "payment",
      });
    }
  }

  lines.sort((a, b) => {
    const delta = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    if (delta !== 0) return delta;
    if (a.kind === b.kind) return 0;
    return a.kind === "invoice" ? -1 : 1;
  });

  let balance = 0;
  for (const line of lines) {
    if (party === "customer") balance = money(balance + line.debit - line.credit);
    else balance = money(balance + line.credit - line.debit);
    line.balance = balance;
  }

  return lines.reverse();
}

export function partyStatementHint(party) {
  if (party === "supplier") {
    return "Credit (دائن) is a delivery — you owe them. Debit (مدين) is a payment — you paid. Balance is still to pay.";
  }
  return "Debit (مدين) is an invoice — they owe you. Credit (دائن) is a payment — they paid. Balance is still due.";
}

import { formatCurrency, formatDateTime } from "./format";

export function buildReceiptHtml({ sale, items, settings, currency }) {
  const storeName = settings.store_name || "Portal POS";
  const address = settings.store_address || "";
  const footer = settings.receipt_footer || "Thank you!";
  const vatPercent = settings.vat_percent || "0";

  const rows = (items || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name || item.product_name || "")}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.unit_price, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.total, currency)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(sale.sale_number || "")}</title>
  <style>
    @page { margin: 8mm; size: 80mm auto; }
    body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; padding: 12px; color: #000; background: #fff; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
    p { margin: 2px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 11px; }
    .totals { margin-top: 8px; }
    .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
    .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(storeName)}</h1>
  ${address ? `<p>${escapeHtml(address)}</p>` : ""}
  <p>${formatDateTime(sale.created_at || new Date().toISOString())}</p>
  <p><strong>${escapeHtml(sale.sale_number || "")}</strong></p>
  <p>Payment: ${escapeHtml((sale.payment_method || "cash").toUpperCase())}</p>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th>Qty</th>
        <th style="text-align:right">Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatCurrency(sale.subtotal, currency)}</span></div>
    <div><span>Discount</span><span>${formatCurrency(sale.discount, currency)}</span></div>
    <div><span>VAT (${vatPercent}%)</span><span>${formatCurrency(sale.vat, currency)}</span></div>
    <div class="grand"><span>Total</span><span>${formatCurrency(sale.total, currency)}</span></div>
    ${
      sale.amount_received != null
        ? `<div><span>Received</span><span>${formatCurrency(sale.amount_received, currency)}</span></div>
           ${
             sale.balance_due > 0
               ? `<div><span>Balance Due</span><span>${formatCurrency(sale.balance_due, currency)}</span></div>`
               : `<div><span>Change</span><span>${formatCurrency(sale.change_due, currency)}</span></div>`
           }`
        : ""
    }
  </div>
  <p class="footer">${escapeHtml(footer)}</p>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Print receipt — works in Tauri webview via hidden iframe + explicit print(). */
export function printReceipt({ sale, items, settings, currency }) {
  return new Promise((resolve) => {
    const html = buildReceiptHtml({ sale, items, settings, currency });
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "Receipt print");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (frame.parentNode) frame.parentNode.removeChild(frame);
      resolve();
    };

    const triggerPrint = () => {
      try {
        const win = frame.contentWindow;
        if (!win) {
          cleanup();
          return;
        }
        win.focus();
        win.print();
      } catch (err) {
        console.error("Print failed:", err);
      }
      setTimeout(cleanup, 1500);
    };

    frame.onload = () => setTimeout(triggerPrint, 100);
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Fallback if onload already fired
    setTimeout(() => {
      if (!finished && frame.contentWindow?.document?.readyState === "complete") {
        triggerPrint();
      }
    }, 500);
  });
}

import { formatCurrency, formatDateTime } from "./format";
import { generateZatcaQrDataUrl, canGenerateZatcaQr } from "./zatca";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function settingOn(value) {
  return value !== "0" && value !== "false";
}

function formatItemName(item, showBilingual) {
  const nameEn = item.name || item.product_name || "";
  const nameAr = item.name_ar || "";
  if (!showBilingual || !nameAr) {
    return `<td>${escapeHtml(nameEn)}</td>`;
  }
  return `<td>
    <div>${escapeHtml(nameEn)}</div>
    <div dir="rtl" style="font-size:10px;color:#444;margin-top:2px">${escapeHtml(nameAr)}</div>
  </td>`;
}

export async function buildReceiptHtml({ sale, items, settings, currency }) {
  const storeName = settings.store_name || "Portal POS";
  const storeNameAr = settings.store_name_ar || "";
  const address = settings.store_address || "";
  const footer = settings.receipt_footer || "Thank you!";
  const footerAr = settings.receipt_footer_ar || "";
  const vatPercent = settings.vat_percent || "0";
  const crNumber = settings.cr_number || "";
  const vatRegistration = settings.vat_registration || "";
  const showBilingual = settingOn(settings.receipt_show_bilingual);
  const showTaxInfo = settingOn(settings.receipt_show_tax_info);
  const showQr = settingOn(settings.receipt_show_qr);
  const paperWidth = settings.receipt_paper_width || "80";
  const headerNote = settings.receipt_header_note || "";

  const rows = (items || [])
    .map(
      (item) => `
      <tr>
        ${formatItemName(item, showBilingual)}
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.unit_price, currency)}</td>
        <td style="text-align:right">${formatCurrency(item.total, currency)}</td>
      </tr>`
    )
    .join("");

  let qrHtml = "";
  if (showQr && canGenerateZatcaQr(settings)) {
    try {
      const qrDataUrl = await generateZatcaQrDataUrl({ sale, settings });
      if (qrDataUrl) {
        qrHtml = `
          <div class="qr-section">
            <img src="${qrDataUrl}" alt="ZATCA QR Code" width="120" height="120" />
            <p class="qr-label">ZATCA Phase 1</p>
          </div>`;
      }
    } catch (err) {
      console.error("ZATCA QR generation failed:", err);
    }
  }

  const taxInfo = [];
  if (showTaxInfo && crNumber) taxInfo.push(`CR: ${escapeHtml(crNumber)}`);
  if (showTaxInfo && vatRegistration) taxInfo.push(`VAT: ${escapeHtml(vatRegistration)}`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(sale.sale_number || "")}</title>
  <style>
    @page { margin: 8mm; size: ${paperWidth}mm auto; }
    body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; padding: 12px; color: #000; background: #fff; }
    h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
    .store-name-ar { font-size: 14px; margin: 0 0 4px; text-align: center; direction: rtl; }
    .invoice-type { text-align: center; font-size: 11px; margin: 6px 0; }
    .invoice-type-ar { direction: rtl; font-size: 11px; }
    p { margin: 2px 0; text-align: center; }
    .tax-info { font-size: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 11px; vertical-align: top; }
    .totals { margin-top: 8px; }
    .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
    .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; }
    .footer-ar { direction: rtl; margin-top: 4px; }
    .qr-section { text-align: center; margin: 12px 0 8px; }
    .qr-label { font-size: 9px; color: #555; margin: 4px 0 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(storeName)}</h1>
  ${storeNameAr && showBilingual ? `<p class="store-name-ar">${escapeHtml(storeNameAr)}</p>` : ""}
  ${address ? `<p>${escapeHtml(address)}</p>` : ""}
  ${headerNote ? `<p style="font-size:10px">${escapeHtml(headerNote)}</p>` : ""}
  ${taxInfo.length ? `<p class="tax-info">${taxInfo.join(" &nbsp;|&nbsp; ")}</p>` : ""}
  <div class="invoice-type">
    <div>Simplified Tax Invoice</div>
    <div class="invoice-type-ar">فاتورة ضريبية مبسطة</div>
  </div>
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
  ${qrHtml}
  <p class="footer">${escapeHtml(footer)}</p>
  ${footerAr && showBilingual ? `<p class="footer footer-ar">${escapeHtml(footerAr)}</p>` : ""}
</body>
</html>`;
}

/** Print receipt — works in Tauri webview via hidden iframe + explicit print(). */
export async function printReceipt({ sale, items, settings, currency }) {
  return new Promise((resolve) => {
    buildReceiptHtml({ sale, items, settings, currency }).then((html) => {
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

      setTimeout(() => {
        if (!finished && frame.contentWindow?.document?.readyState === "complete") {
          triggerPrint();
        }
      }, 500);
    }).catch((err) => {
      console.error("Receipt build failed:", err);
      resolve();
    });
  });
}

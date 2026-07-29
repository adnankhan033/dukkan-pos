import { formatCurrency, formatDateTime } from "./format";
import { generateZatcaQrDataUrl, canGenerateZatcaQr } from "./zatca";
import { DEFAULT_RECEIPT_TEMPLATE, getReceiptTemplate } from "./receiptTemplates";

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

function formatItemName(item, showBilingual, compact = false) {
  const nameEn = item.name || item.product_name || "";
  const nameAr = item.name_ar || "";
  if (!showBilingual || !nameAr) {
    return `<td>${escapeHtml(nameEn)}</td>`;
  }
  if (compact) {
    return `<td><div>${escapeHtml(nameEn)}</div><div dir="rtl" class="item-ar">${escapeHtml(nameAr)}</div></td>`;
  }
  return `<td>
    <div>${escapeHtml(nameEn)}</div>
    <div dir="rtl" class="item-ar">${escapeHtml(nameAr)}</div>
  </td>`;
}

function buildItemRows(items, currency, showBilingual, compact = false) {
  return (items || [])
    .map(
      (item) => `
      <tr>
        ${formatItemName(item, showBilingual, compact)}
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unit_price, currency)}</td>
        <td class="num">${formatCurrency(item.total, currency)}</td>
      </tr>`
    )
    .join("");
}

function buildTotalsBlock(sale, currency, vatPercent, showChange = true) {
  const changeBlock =
    showChange && sale.amount_received != null
      ? `<div class="row"><span>Received / المستلم</span><span>${formatCurrency(sale.amount_received, currency)}</span></div>
         ${
           sale.balance_due > 0
             ? `<div class="row"><span>Balance Due / المتبقي</span><span>${formatCurrency(sale.balance_due, currency)}</span></div>`
             : `<div class="row"><span>Change / الباقي</span><span>${formatCurrency(sale.change_due || 0, currency)}</span></div>`
         }`
      : "";

  return `
    <div class="row"><span>Subtotal / المجموع</span><span>${formatCurrency(sale.subtotal, currency)}</span></div>
    <div class="row"><span>Discount / الخصم</span><span>${formatCurrency(sale.discount, currency)}</span></div>
    <div class="row"><span>VAT (${vatPercent}%) / الضريبة</span><span>${formatCurrency(sale.vat, currency)}</span></div>
    <div class="row grand"><span>Total / الإجمالي</span><span>${formatCurrency(sale.total, currency)}</span></div>
    ${changeBlock}`;
}

async function buildQrHtml(sale, settings, showQr) {
  if (!showQr || !canGenerateZatcaQr(settings)) return "";
  try {
    const qrDataUrl = await generateZatcaQrDataUrl({ sale, settings });
    if (!qrDataUrl) return "";
    return `
      <div class="qr-section">
        <img src="${qrDataUrl}" alt="ZATCA QR Code" width="120" height="120" />
        <p class="qr-label">ZATCA Phase 1 · المرحلة الأولى</p>
      </div>`;
  } catch (err) {
    console.error("ZATCA QR generation failed:", err);
    return "";
  }
}

function resolveTemplateId(settings) {
  const id = settings?.receipt_template || DEFAULT_RECEIPT_TEMPLATE;
  return getReceiptTemplate(id).id;
}

function wrapDocument({ title, paperWidth, css, body }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 6mm; size: ${paperWidth}mm auto; }
    ${css}
  </style>
</head>
<body>${body}</body>
</html>`;
}

async function buildBaqalaReceipt(ctx) {
  const {
    sale,
    items,
    settings,
    currency,
    storeName,
    storeNameAr,
    address,
    footer,
    footerAr,
    vatPercent,
    crNumber,
    vatRegistration,
    showBilingual,
    showTaxInfo,
    paperWidth,
    headerNote,
    qrHtml,
  } = ctx;

  const rows = buildItemRows(items, currency, showBilingual);

  const taxBlock =
    showTaxInfo && (crNumber || vatRegistration)
      ? `<div class="tax-box">
          ${crNumber ? `<div><span>CR / السجل التجاري</span><strong>${escapeHtml(crNumber)}</strong></div>` : ""}
          ${vatRegistration ? `<div><span>VAT / الرقم الضريبي</span><strong>${escapeHtml(vatRegistration)}</strong></div>` : ""}
        </div>`
      : "";

  const css = `
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #111; background: #fff; }
    .receipt { border: 2px double #111; padding: 10px; }
    .head { text-align: center; border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px; }
    .store-en { font-size: 15px; font-weight: 700; margin: 0; }
    .store-ar { font-size: 16px; font-weight: 700; margin: 4px 0 0; direction: rtl; }
    .address { font-size: 10px; color: #333; margin-top: 4px; }
    .invoice-badge { margin: 8px 0; padding: 6px; border: 1px solid #111; text-align: center; }
    .invoice-badge .en { font-size: 11px; font-weight: 600; }
    .invoice-badge .ar { font-size: 12px; font-weight: 600; direction: rtl; margin-top: 2px; }
    .meta { font-size: 10px; margin: 6px 0; }
    .meta div { display: flex; justify-content: space-between; margin: 2px 0; }
    .tax-box { font-size: 10px; border: 1px solid #ccc; padding: 6px; margin: 6px 0; }
    .tax-box div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    .note { font-size: 9px; text-align: center; color: #444; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
    th { border-bottom: 1px solid #111; padding: 4px 2px; text-align: left; font-size: 9px; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    td { padding: 4px 2px; border-bottom: 1px dotted #bbb; vertical-align: top; }
    .item-ar { font-size: 9px; color: #444; margin-top: 1px; }
    .totals { border-top: 1px solid #111; padding-top: 6px; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 10px; }
    .grand { font-weight: 700; font-size: 13px; border-top: 1px dashed #111; padding-top: 6px; margin-top: 6px; }
    .qr-section { text-align: center; margin: 10px 0 6px; }
    .qr-label { font-size: 8px; color: #555; margin: 4px 0 0; }
    .footer { text-align: center; margin-top: 10px; font-size: 10px; border-top: 1px dashed #999; padding-top: 8px; }
    .footer-ar { direction: rtl; margin-top: 4px; }
  `;

  const body = `
    <div class="receipt">
      <div class="head">
        <p class="store-en">${escapeHtml(storeName)}</p>
        ${storeNameAr && showBilingual ? `<p class="store-ar">${escapeHtml(storeNameAr)}</p>` : ""}
        ${address ? `<p class="address">${escapeHtml(address)}</p>` : ""}
      </div>
      <div class="invoice-badge">
        <div class="en">Simplified Tax Invoice</div>
        <div class="ar">فاتورة ضريبية مبسطة</div>
      </div>
      ${taxBlock}
      ${headerNote ? `<p class="note">${escapeHtml(headerNote)}</p>` : ""}
      <div class="meta">
        <div><span>Invoice / رقم الفاتورة</span><strong>${escapeHtml(sale.sale_number || "")}</strong></div>
        <div><span>Date / التاريخ</span><span>${formatDateTime(sale.created_at || new Date().toISOString())}</span></div>
        <div><span>Payment / الدفع</span><span>${escapeHtml((sale.payment_method || "cash").toUpperCase())}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item / الصنف</th>
            <th class="num">Qty</th>
            <th class="num">Price</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">${buildTotalsBlock(sale, currency, vatPercent)}</div>
      ${qrHtml}
      <p class="footer">${escapeHtml(footer)}</p>
      ${footerAr && showBilingual ? `<p class="footer footer-ar">${escapeHtml(footerAr)}</p>` : ""}
    </div>`;

  return wrapDocument({
    title: `Receipt ${sale.sale_number || ""}`,
    paperWidth,
    css,
    body,
  });
}

async function buildClassicReceipt(ctx) {
  const {
    sale,
    items,
    currency,
    storeName,
    storeNameAr,
    address,
    footer,
    footerAr,
    vatPercent,
    crNumber,
    vatRegistration,
    showBilingual,
    showTaxInfo,
    paperWidth,
    headerNote,
    qrHtml,
  } = ctx;

  const rows = buildItemRows(items, currency, showBilingual);

  const taxInfo = [];
  if (showTaxInfo && crNumber) taxInfo.push(`CR: ${escapeHtml(crNumber)}`);
  if (showTaxInfo && vatRegistration) taxInfo.push(`VAT: ${escapeHtml(vatRegistration)}`);

  const css = `
    body { font-family: monospace, sans-serif; font-size: 12px; margin: 0; padding: 12px; color: #000; background: #fff; }
    h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
    .store-name-ar { font-size: 14px; margin: 0 0 4px; text-align: center; direction: rtl; }
    .invoice-type { text-align: center; font-size: 11px; margin: 6px 0; }
    .invoice-type-ar { direction: rtl; font-size: 11px; }
    p { margin: 2px 0; text-align: center; }
    .tax-info { font-size: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 11px; vertical-align: top; }
    .num { text-align: right; }
    .item-ar { font-size: 10px; color: #444; margin-top: 2px; }
    .totals .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; }
    .footer-ar { direction: rtl; margin-top: 4px; }
    .qr-section { text-align: center; margin: 12px 0 8px; }
    .qr-label { font-size: 9px; color: #555; margin: 4px 0 0; }
  `;

  const body = `
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
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">${buildTotalsBlock(sale, currency, vatPercent)}</div>
    ${qrHtml}
    <p class="footer">${escapeHtml(footer)}</p>
    ${footerAr && showBilingual ? `<p class="footer footer-ar">${escapeHtml(footerAr)}</p>` : ""}`;

  return wrapDocument({
    title: `Receipt ${sale.sale_number || ""}`,
    paperWidth,
    css,
    body,
  });
}

async function buildCompactReceipt(ctx) {
  const {
    sale,
    items,
    currency,
    storeName,
    storeNameAr,
    footer,
    vatPercent,
    showBilingual,
    paperWidth,
    qrHtml,
  } = ctx;

  const rows = (items || [])
    .map(
      (item) => `
      <tr>
        ${formatItemName(item, showBilingual, true)}
        <td class="num">${item.quantity}×${formatCurrency(item.unit_price, currency)}</td>
        <td class="num">${formatCurrency(item.total, currency)}</td>
      </tr>`
    )
    .join("");

  const css = `
    body { font-family: monospace, sans-serif; font-size: 10px; margin: 0; padding: 6px; color: #000; }
    .center { text-align: center; }
    .store-ar { direction: rtl; font-size: 11px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    td { padding: 2px 0; border-bottom: 1px dotted #ccc; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .item-ar { font-size: 8px; color: #555; }
    .total { font-weight: bold; font-size: 12px; display: flex; justify-content: space-between; margin-top: 4px; }
    .qr-section { text-align: center; margin: 6px 0; }
    .qr-section img { width: 90px; height: 90px; }
  `;

  const body = `
    <div class="center"><strong>${escapeHtml(storeName)}</strong></div>
    ${storeNameAr && showBilingual ? `<div class="center store-ar">${escapeHtml(storeNameAr)}</div>` : ""}
    <div class="center" style="font-size:9px;margin:4px 0">فاتورة ضريبية مبسطة</div>
    <div class="center">${escapeHtml(sale.sale_number || "")} · ${formatDateTime(sale.created_at || new Date().toISOString())}</div>
    <table><tbody>${rows}</tbody></table>
    <div class="total"><span>Total (VAT ${vatPercent}%)</span><span>${formatCurrency(sale.total, currency)}</span></div>
    ${qrHtml}
    <div class="center" style="margin-top:6px;font-size:9px">${escapeHtml(footer)}</div>`;

  return wrapDocument({
    title: `Receipt ${sale.sale_number || ""}`,
    paperWidth,
    css,
    body,
  });
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
  const templateId = resolveTemplateId(settings);

  const qrHtml = await buildQrHtml(sale, settings, showQr);

  const ctx = {
    sale,
    items,
    settings,
    currency,
    storeName,
    storeNameAr,
    address,
    footer,
    footerAr,
    vatPercent,
    crNumber,
    vatRegistration,
    showBilingual,
    showTaxInfo,
    paperWidth,
    headerNote,
    qrHtml,
  };

  switch (templateId) {
    case "classic":
      return buildClassicReceipt(ctx);
    case "compact":
      return buildCompactReceipt(ctx);
    case "baqala":
    default:
      return buildBaqalaReceipt(ctx);
  }
}

/** Print receipt — works in Tauri webview via hidden iframe + explicit print(). */
export async function printReceipt({ sale, items, settings, currency }) {
  return new Promise((resolve) => {
    buildReceiptHtml({ sale, items, settings, currency })
      .then((html) => {
        printHtml(html).then(resolve);
      })
      .catch((err) => {
        console.error("Receipt build failed:", err);
        resolve();
      });
  });
}

/** Print arbitrary receipt HTML (used by Settings preview). */
export function printHtml(html) {
  return new Promise((resolve) => {
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
  });
}

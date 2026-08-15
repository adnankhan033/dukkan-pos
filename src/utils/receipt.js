import { formatCurrency, formatOrderDateTime } from "./format";
import { zatcaService } from "../services/ZatcaService";
import { ZATCA_PHASES, ZATCA_QUEUE_STATUS } from "../zatca/core/constants";
import { DEFAULT_RECEIPT_TEMPLATE, getReceiptTemplate } from "./receiptTemplates";
import { zatcaTlvBase64ToDataUrl, resolveZatcaQrTlv } from "./zatcaQr";
import {
  resolveBusinessTimezone,
  parseStoredTimestampToInstant,
} from "./timezones";

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

const PAYMENT_LABELS = {
  cash: { en: "Cash", ar: "كاش" },
  card: { en: "Card", ar: "بطاقة" },
  transfer: { en: "Transfer", ar: "تحويل" },
};

function formatPaymentMethod(method, bilingual) {
  const key = String(method || "cash").toLowerCase();
  const labels = PAYMENT_LABELS[key] || { en: key.toUpperCase(), ar: key };
  if (!bilingual) return labels.en;
  return `${labels.en} / ${labels.ar}`;
}

/** Thermal receipt amount — matches Saudi POS style (﷼ before value). */
function formatReceiptAmount(amount, currency = "SAR") {
  const value = (Number(amount) || 0).toFixed(2);
  if (currency === "SAR") {
    return `<span class="money"><span class="riyal" aria-hidden="true">&#65020;</span>${value}</span>`;
  }
  return `<span class="money">${escapeHtml(value)} ${escapeHtml(currency)}</span>`;
}

function buildMetaRow(enLabel, arLabel, value, showBilingual) {
  return `
    <div class="meta-row">
      <div class="meta-labels">
        <div>${escapeHtml(enLabel)}</div>
        ${showBilingual ? `<div class="ar">${escapeHtml(arLabel)}</div>` : ""}
      </div>
      <div class="meta-val">${value}</div>
    </div>`;
}

function buildBilingualTotalRow(enLabel, arLabel, amountHtml, showBilingual, extraClass = "") {
  return `
    <div class="total-row ${extraClass}">
      <div class="total-labels">
        <span>${escapeHtml(enLabel)}</span>
        ${showBilingual ? `<span class="ar">${escapeHtml(arLabel)}</span>` : ""}
      </div>
      <div class="total-val">${amountHtml}</div>
    </div>`;
}

/** Receipt-friendly timestamp: 2026-08-14, 07:04:02 PM */
function formatReceiptDateTime(dateStr, settings) {
  if (!dateStr) return "-";
  const tz = resolveBusinessTimezone(settings);
  const instant = parseStoredTimestampToInstant(dateStr, tz);
  if (!instant) return formatOrderDateTime(dateStr);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(instant);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}:${get("second")}${get("dayPeriod").toUpperCase()}`;
  return `${date}, ${time}`;
}

function calcTaxableTotal(sale) {
  const subtotal = Number(sale.subtotal) || 0;
  const discount = Number(sale.discount) || 0;
  return Math.max(0, subtotal - discount);
}

/** Per-line amounts with proportional order-level discount. Prices are excl. VAT. */
function calcLineAmounts(item, sale, vatPercent) {
  const subtotal = Number(sale.subtotal) || 0;
  const discount = Number(sale.discount) || 0;
  const lineSubtotal = Number(item.total) || 0;
  const qty = Number(item.quantity) || 0;

  const lineDiscount = subtotal > 0 ? (lineSubtotal / subtotal) * discount : 0;
  const taxableExcl = Math.max(0, lineSubtotal - lineDiscount);
  const lineVat = (taxableExcl * vatPercent) / 100;
  const totalIncl = taxableExcl + lineVat;
  const unitExcl = qty > 0 ? lineSubtotal / qty : 0;

  return { unitExcl, taxableExcl, lineVat, totalIncl };
}

function formatItemName(item, showBilingual, compact = false) {
  const nameEn = item.name || item.product_name || "";
  const nameAr = item.name_ar || "";
  if (!showBilingual || !nameAr) {
    return `<td class="desc">${escapeHtml(nameEn)}</td>`;
  }
  if (compact) {
    return `<td class="desc"><div>${escapeHtml(nameEn)}</div><div dir="rtl" class="item-ar">${escapeHtml(nameAr)}</div></td>`;
  }
  return `<td class="desc">
    <div>${escapeHtml(nameEn)}</div>
    <div dir="rtl" class="item-ar">${escapeHtml(nameAr)}</div>
  </td>`;
}

function buildZatcaItemRows(items, sale, currency, vatPercent, showBilingual, compact = false) {
  return (items || [])
    .map((item) => {
      const { taxableExcl, totalIncl } = calcLineAmounts(item, sale, vatPercent);
      return `
      <tr>
        ${formatItemName(item, showBilingual, compact)}
        <td class="num">${formatReceiptAmount(taxableExcl, currency)}</td>
        <td class="num qty">${item.quantity}</td>
        <td class="num">${formatReceiptAmount(totalIncl, currency)}</td>
      </tr>`;
    })
    .join("");
}

function buildClassicItemRows(items, currency, showBilingual) {
  return (items || [])
    .map(
      (item) => `
      <tr>
        ${formatItemName(item, showBilingual)}
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unit_price, currency)}</td>
        <td class="num">${formatCurrency(item.total, currency)}</td>
      </tr>`
    )
    .join("");
}

function buildSaudiTotalsBlock(sale, currency, vatPercent, showBilingual, showChange = true) {
  const taxable = calcTaxableTotal(sale);
  const vat = Number(sale.vat) || 0;
  const total = Number(sale.total) || 0;
  const discount = Number(sale.discount) || 0;

  const discountRow =
    discount > 0
      ? buildBilingualTotalRow(
          "Discount",
          "الخصم",
          formatReceiptAmount(discount, currency),
          showBilingual
        )
      : "";

  const changeBlock =
    showChange && sale.amount_received != null
      ? `${buildBilingualTotalRow(
          "Received",
          "المستلم",
          formatReceiptAmount(sale.amount_received, currency),
          showBilingual
        )}
         ${
           sale.balance_due > 0
             ? buildBilingualTotalRow(
                 "Balance Due",
                 "المتبقي",
                 formatReceiptAmount(sale.balance_due, currency),
                 showBilingual
               )
             : buildBilingualTotalRow(
                 "Change",
                 "الباقي",
                 formatReceiptAmount(sale.change_due || 0, currency),
                 showBilingual
               )
         }`
      : "";

  return `
    ${discountRow}
    ${buildBilingualTotalRow(
      "Total Taxable Amount",
      "الإجمالي الخاضع للضريبة",
      formatReceiptAmount(taxable, currency),
      showBilingual
    )}
    ${buildBilingualTotalRow(
      "VAT Added",
      "تمت إضافة ضريبة القيمة المضافة",
      formatReceiptAmount(vat, currency),
      showBilingual
    )}
    ${buildBilingualTotalRow(
      "Total Amount",
      "المبلغ الإجمالي",
      formatReceiptAmount(total, currency),
      showBilingual,
      "total-row--grand"
    )}
    ${changeBlock}`;
}

function buildClassicTotalsBlock(sale, currency, vatPercent, showChange = true) {
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

/**
 * Resolve receipt QR based on ZATCA mode:
 * - Disabled: no QR
 * - Phase 1 / Phase 2 (offline or pending sync): Phase 1 TLV (tags 1–5)
 * - Phase 2 synced: full signed QR (tags 1–9) from local queue
 */
async function resolveReceiptQr(sale, settings) {
  if (!zatcaService.canGenerateReceiptQr({ sale, settings })) {
    return { dataUrl: null, source: "none" };
  }

  const phase = zatcaService.getActivePhase(settings);

  if (phase === ZATCA_PHASES.PHASE2 && sale?.id) {
    try {
      const record = await zatcaService.getBySaleId(sale.id);
      if (record?.status === ZATCA_QUEUE_STATUS.SYNCED) {
        const tlv = resolveZatcaQrTlv(record);
        if (tlv) {
          const dataUrl = await zatcaTlvBase64ToDataUrl(tlv, 180);
          if (dataUrl) return { dataUrl, source: "phase2_signed" };
        }
      }
    } catch (err) {
      console.warn("Could not load synced ZATCA QR, falling back to Phase 1:", err);
    }
  }

  try {
    const dataUrl = await zatcaService.generateReceiptQr({ sale, settings });
    if (dataUrl) return { dataUrl, source: "phase1" };
  } catch (err) {
    console.error("ZATCA QR generation failed:", err);
  }

  return { dataUrl: null, source: "none" };
}

async function buildQrHtml(sale, settings, showQr) {
  if (!showQr) return "";

  const { dataUrl } = await resolveReceiptQr(sale, settings);
  if (!dataUrl) return "";

  return `
    <div class="qr-section">
      <img src="${dataUrl}" alt="ZATCA QR Code" width="160" height="160" />
    </div>`;
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
    @page { margin: 4mm; size: ${paperWidth}mm auto; }
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
    storePhone,
    footer,
    footerAr,
    vatPercent,
    vatRegistration,
    showBilingual,
    showTaxInfo,
    paperWidth,
    headerNote,
    branding,
    qrHtml,
  } = ctx;

  const rows = buildZatcaItemRows(items, sale, currency, vatPercent, showBilingual);
  const customerName = sale.customer_name?.trim() || "NA";
  const paymentLabel = formatPaymentMethod(sale.payment_method, false);
  const receiptDate = formatReceiptDateTime(sale.created_at || new Date().toISOString(), settings);
  const invoiceNumber = sale.sale_number ? `#${sale.sale_number}` : "";

  const css = `
    * { box-sizing: border-box; }
    body { font-family: Arial, "Segoe UI", Tahoma, sans-serif; font-size: 10px; margin: 0; padding: 6px 4px; color: #000; background: #fff; line-height: 1.35; }
    .receipt { width: 100%; }
    .head { text-align: center; padding-bottom: 8px; margin-bottom: 6px; border-bottom: 1px dashed #000; }
    .store-en { font-size: 13px; font-weight: 700; margin: 0 0 2px; }
    .store-ar { font-size: 14px; font-weight: 700; margin: 0 0 4px; direction: rtl; }
    .head-line { font-size: 10px; margin: 2px 0; }
    .divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .meta-grid { font-size: 10px; margin: 6px 0; }
    .meta-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 5px 0; }
    .meta-labels { flex: 1; line-height: 1.25; }
    .meta-labels .ar { direction: rtl; font-size: 9px; color: #222; margin-top: 1px; }
    .meta-val { font-weight: 700; text-align: right; white-space: nowrap; font-size: 10px; }
    .invoice-title { text-align: center; margin: 4px 0; line-height: 1.3; }
    .invoice-title .en { font-size: 11px; font-weight: 700; }
    .invoice-title .ar { font-size: 11px; font-weight: 700; direction: rtl; margin-top: 2px; }
    .note { font-size: 9px; text-align: center; color: #333; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; table-layout: fixed; }
    th { font-size: 8px; font-weight: 700; padding: 3px 2px 4px; border-bottom: 1px solid #000; vertical-align: bottom; line-height: 1.15; }
    th.desc { width: 42%; text-align: left; }
    th.num { width: 19%; text-align: right; }
    th .ar { display: block; direction: rtl; font-size: 8px; font-weight: 600; margin-top: 1px; }
    td { padding: 4px 2px; font-size: 9px; vertical-align: top; border-bottom: 1px dotted #ccc; }
    td.desc { word-break: break-word; padding-right: 4px; }
    td.num { text-align: right; white-space: nowrap; }
    td.qty { text-align: center; }
    .item-ar { font-size: 8px; color: #333; margin-top: 2px; direction: rtl; }
    .money { white-space: nowrap; }
    .riyal { font-family: Arial, sans-serif; margin-right: 1px; font-size: 9px; }
    .totals { margin-top: 4px; padding-top: 4px; border-top: 1px solid #000; }
    .total-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin: 4px 0; font-size: 9px; }
    .total-labels { flex: 1; line-height: 1.25; }
    .total-labels .ar { display: block; direction: rtl; font-size: 8px; margin-top: 1px; }
    .total-val { font-weight: 600; text-align: right; white-space: nowrap; }
    .total-row--grand .total-labels,
    .total-row--grand .total-val { font-weight: 700; font-size: 10px; }
    .payment-row { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 6px; font-size: 10px; font-weight: 700; padding-top: 4px; border-top: 1px dashed #000; }
    .qr-section { text-align: center; margin: 8px 0 4px; }
    .qr-section img { width: 150px; height: 150px; }
    .footer { text-align: center; margin-top: 10px; font-size: 11px; font-weight: 600; }
    .footer-ar { direction: rtl; margin-top: 3px; font-size: 10px; font-weight: 500; }
    .brand { text-align: center; font-size: 9px; color: #444; margin-top: 6px; }
  `;

  const vatLine =
    showTaxInfo && vatRegistration
      ? `<div class="head-line">VAT No.${escapeHtml(vatRegistration)}</div>`
      : "";
  const phoneLine = storePhone ? `<div class="head-line">PH No. ${escapeHtml(storePhone)}</div>` : "";
  const addressLine = address ? `<div class="head-line">${escapeHtml(address)}</div>` : "";

  const metaBlock = `
    <div class="meta-grid">
      ${buildMetaRow("Invoice No.", "فاتورة", escapeHtml(invoiceNumber), showBilingual)}
      ${buildMetaRow("Date & time", "التاريخ والوقت", escapeHtml(receiptDate), showBilingual)}
      ${buildMetaRow("Customer", "العميل", escapeHtml(customerName), showBilingual)}
    </div>`;

  const body = `
    <div class="receipt">
      <div class="head">
        <p class="store-en">${escapeHtml(storeName)}</p>
        ${storeNameAr && showBilingual ? `<p class="store-ar">${escapeHtml(storeNameAr)}</p>` : ""}
        ${vatLine}
        ${phoneLine}
        ${addressLine}
      </div>

      ${metaBlock}

      <hr class="divider" />

      <div class="invoice-title">
        <div class="en">Simplified Tax Invoice</div>
        ${showBilingual ? `<div class="ar">فاتورة ضريبية مبسطة</div>` : ""}
      </div>

      <hr class="divider" />

      ${headerNote ? `<p class="note">${escapeHtml(headerNote)}</p>` : ""}

      <table>
        <thead>
          <tr>
            <th class="desc">Description${showBilingual ? `<span class="ar">الوصف</span>` : ""}</th>
            <th class="num">Unit Price${showBilingual ? `<span class="ar">سعر الوحدة</span>` : ""}</th>
            <th class="num">Qty${showBilingual ? `<span class="ar">الكمية</span>` : ""}</th>
            <th class="num">Total${showBilingual ? `<span class="ar">إجمالي</span>` : ""}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">${buildSaudiTotalsBlock(sale, currency, vatPercent, showBilingual)}</div>

      <div class="payment-row">
        <span>${escapeHtml(paymentLabel)}</span>
        <span>${formatReceiptAmount(sale.total, currency)}</span>
      </div>

      ${qrHtml}

      <p class="footer">${escapeHtml(footer)}</p>
      ${footerAr && showBilingual ? `<p class="footer footer-ar">${escapeHtml(footerAr)}</p>` : ""}
      ${branding ? `<p class="brand">Powered by ${escapeHtml(branding)}</p>` : ""}
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

  const rows = buildClassicItemRows(items, currency, showBilingual);

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
    .qr-status { font-size: 9px; color: #555; margin: 4px 0 0; }
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
    <p>${formatReceiptDateTime(sale.created_at || new Date().toISOString(), settings)}</p>
    <p><strong>${escapeHtml(sale.sale_number || "")}</strong></p>
    <p>Customer: ${escapeHtml(sale.customer_name || "Walk-in")}</p>
    <p>Payment: ${escapeHtml(formatPaymentMethod(sale.payment_method, showBilingual))}</p>
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
    <div class="totals">${buildClassicTotalsBlock(sale, currency, vatPercent)}</div>
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
    <div class="center">${escapeHtml(sale.sale_number || "")} · ${formatOrderDateTime(sale.created_at || new Date().toISOString())}</div>
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
  const storeName = settings.store_name || "DukkanPOS";
  const storeNameAr = settings.store_name_ar || "";
  const address = settings.store_address || "";
  const storePhone = settings.store_phone || "";
  const footer = settings.receipt_footer || "Thank You";
  const footerAr = settings.receipt_footer_ar || "";
  const branding = settings.receipt_branding || "DukkanPOS";
  const vatPercent = Number(settings.vat_percent) || 0;
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
    storePhone,
    footer,
    footerAr,
    vatPercent,
    crNumber,
    vatRegistration,
    showBilingual,
    showTaxInfo,
    paperWidth,
    headerNote,
    branding,
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

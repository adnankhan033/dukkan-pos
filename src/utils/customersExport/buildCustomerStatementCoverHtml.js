function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label, value) {
  if (!value) return "";
  return `
    <div class="info-row">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(value)}</span>
    </div>`;
}

function kpiCard(label, value, tone = "default") {
  return `
    <div class="kpi-card kpi-card--${tone}">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
    </div>`;
}

export function buildCustomerStatementCoverHtml({
  company,
  customer,
  currency,
  summary,
  invoiceCount,
  paymentCount,
  includeFullDetail,
}) {
  const fullAddress = company.fullAddress || company.address || "—";

  return `
<div class="customer-statement-cover" dir="ltr">
<style>
  .customer-statement-cover {
    width: 1122px;
    direction: ltr;
    font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    box-sizing: border-box;
    overflow: hidden;
  }
  .customer-statement-cover * { box-sizing: border-box; }
  .report-banner {
    background: linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #059669 100%);
    padding: 22px 28px 18px;
    color: #fff;
  }
  .banner-top { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
  .store-block { display: flex; gap: 14px; align-items: center; flex: 1; min-width: 0; }
  .store-avatar {
    width: 48px; height: 48px; border-radius: 12px;
    background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; flex-shrink: 0;
  }
  .store-name { margin: 0; font-size: 22px; font-weight: 700; }
  .store-sub { margin: 3px 0 0; font-size: 12px; opacity: 0.85; }
  .report-title-block { text-align: right; flex-shrink: 0; max-width: 320px; }
  .report-title { font-size: 17px; font-weight: 700; }
  .report-subtitle { margin-top: 4px; font-size: 11px; opacity: 0.9; }
  .tax-badge {
    display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22);
    font-size: 10px; font-weight: 600;
  }
  .banner-meta {
    display: flex; justify-content: space-between; gap: 16px; margin-top: 14px;
    padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.18); font-size: 11px;
  }
  .report-body { padding: 18px 28px 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .info-card {
    border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc;
  }
  .info-card h3 {
    margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: #059669;
  }
  .info-card--customer { background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%); border-color: #bfdbfe; }
  .info-card--customer h3 { color: #1d4ed8; }
  .info-row {
    display: grid; grid-template-columns: 118px 1fr; gap: 10px; padding: 5px 0;
    border-bottom: 1px dashed #e2e8f0; font-size: 11px;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; font-weight: 500; }
  .info-value { font-weight: 600; color: #0f172a; word-break: break-word; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .kpi-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #fff;
    border-top: 3px solid #cbd5e1;
  }
  .kpi-card--emerald { border-top-color: #059669; }
  .kpi-card--navy { border-top-color: #0f172a; }
  .kpi-card--amber { border-top-color: #d97706; }
  .kpi-card--teal { border-top-color: #0d9488; }
  .kpi-label {
    font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px;
  }
  .kpi-value { font-size: 12px; font-weight: 700; color: #0f172a; }
  .detail-note {
    margin-top: 0;
    padding: 8px 12px;
    border-radius: 8px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    font-size: 11px;
    color: #065f46;
  }
</style>

  <div class="report-banner">
    <div class="banner-top">
      <div class="store-block">
        <div class="store-avatar">${escapeHtml(company.initial)}</div>
        <div>
          <h1 class="store-name">${escapeHtml(company.name)}</h1>
          ${company.phone ? `<p class="store-sub">${escapeHtml(company.phone)}</p>` : ""}
        </div>
      </div>
      <div class="report-title-block">
        <div class="report-title">Customer Account Statement</div>
        <div class="report-subtitle">Prepared for ${escapeHtml(customer.name)}</div>
        <div class="tax-badge">${invoiceCount} invoice(s) · ${paymentCount} payment(s)</div>
      </div>
    </div>
    <div class="banner-meta">
      <span>Currency: ${escapeHtml(currency)}</span>
      <span>Generated ${escapeHtml(company.generatedDate)}</span>
    </div>
  </div>

  <div class="report-body">
    <div class="info-grid">
      <div class="info-card info-card--customer">
        <h3>Customer</h3>
        ${row("Name", customer.name)}
        ${row("Phone", customer.phone)}
        ${row("Email", customer.email)}
        ${row("Address", customer.address)}
        ${row("Notes", customer.notes)}
      </div>
      <div class="info-card">
        <h3>Store Information</h3>
        ${row("Address", fullAddress)}
        ${row("Phone", company.phone)}
        ${row("CR Number", company.crNumber)}
        ${row("VAT Number", company.vatNumber)}
        ${row("Statement Date", company.generatedAt)}
      </div>
    </div>

    <div class="kpi-grid">
      ${kpiCard("Total Invoiced", summary.totalInvoicedFormatted, "emerald")}
      ${kpiCard("Total Paid", summary.totalPaidFormatted, "teal")}
      ${kpiCard("Balance Due", summary.balanceDueFormatted, "navy")}
      ${kpiCard("Invoices", String(invoiceCount), "amber")}
      ${kpiCard("Payments", String(paymentCount), "emerald")}
    </div>

    ${
      includeFullDetail
        ? `<div class="detail-note">Following pages: invoice summary, line items, and payment history.</div>`
        : `<div class="detail-note">Following pages: invoice summary and payment history.</div>`
    }
  </div>
</div>`;
}

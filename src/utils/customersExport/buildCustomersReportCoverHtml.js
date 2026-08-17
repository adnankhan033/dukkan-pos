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

export function buildCustomersReportCoverHtml({
  company,
  currency,
  reportTitle,
  reportSubtitle,
  scopeLabel,
  search = "",
  filterSummary = "",
  totals,
  customerCount,
  totalMatched,
  truncated,
}) {
  const fullAddress = company.fullAddress || company.address || "—";
  const filterText = filterSummary.trim()
    || (search.trim() ? `Search: "${search.trim()}"` : "All matching customers");
  const countLabel = truncated
    ? `${customerCount} of ${totalMatched} customers`
    : `${customerCount} customer(s)`;

  const kpiSection = totals.includesBalances
    ? `
    <div class="kpi-grid">
      ${kpiCard("Customers", String(totals.customerCount), "emerald")}
      ${kpiCard("With Balance", String(totals.withBalance), "amber")}
      ${kpiCard("Total Invoiced", totals.totalInvoicedFormatted, "emerald")}
      ${kpiCard("Total Collected", totals.totalPaidFormatted, "teal")}
      ${kpiCard("Balance Due", totals.balanceDueFormatted, "navy")}
      ${kpiCard("Unpaid Invoices", String(totals.unpaidInvoices), "amber")}
    </div>`
    : `
    <div class="kpi-grid kpi-grid--single">
      ${kpiCard("Total Customers", String(totals.customerCount), "emerald")}
    </div>`;

  return `
<div class="customers-report-cover" dir="ltr">
<style>
  .customers-report-cover {
    width: 1122px;
    direction: ltr;
    text-align: left;
    unicode-bidi: isolate;
    font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    box-sizing: border-box;
    overflow: hidden;
  }
  .customers-report-cover * { box-sizing: border-box; }
  .report-banner {
    background: linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #059669 100%);
    padding: 22px 28px 18px;
    color: #fff;
  }
  .banner-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  .store-block {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1;
  }
  .store-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255,255,255,0.15);
    border: 2px solid rgba(255,255,255,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .store-name {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
    word-break: break-word;
  }
  .store-sub {
    margin: 3px 0 0;
    font-size: 12px;
    opacity: 0.85;
  }
  .report-title-block {
    text-align: right;
    flex-shrink: 0;
    max-width: 300px;
  }
  .report-title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }
  .report-subtitle {
    margin-top: 4px;
    font-size: 11px;
    opacity: 0.9;
  }
  .tax-badge {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.22);
    font-size: 10px;
    font-weight: 600;
  }
  .banner-meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.18);
    font-size: 11px;
    opacity: 0.92;
  }
  .banner-meta span { min-width: 0; word-break: break-word; }
  .report-body { padding: 18px 28px 16px; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  .info-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    background: #f8fafc;
    min-width: 0;
  }
  .info-card h3 {
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #059669;
  }
  .info-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 10px;
    padding: 5px 0;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 11px;
    align-items: start;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; font-weight: 500; }
  .info-value {
    font-weight: 600;
    color: #0f172a;
    text-align: left;
    word-break: break-word;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .kpi-grid--single { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .kpi-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    background: #fff;
    border-top: 3px solid #cbd5e1;
    min-width: 0;
    overflow: hidden;
  }
  .kpi-card--emerald { border-top-color: #059669; }
  .kpi-card--navy { border-top-color: #0f172a; }
  .kpi-card--amber { border-top-color: #d97706; }
  .kpi-card--teal { border-top-color: #0d9488; }
  .kpi-label {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi-value {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
    word-break: break-word;
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
        <div class="report-title">${escapeHtml(reportTitle)}</div>
        <div class="report-subtitle">${escapeHtml(reportSubtitle)}</div>
        <div class="tax-badge">${escapeHtml(countLabel)}</div>
      </div>
    </div>
    <div class="banner-meta">
      <span>${escapeHtml(scopeLabel)}</span>
      <span>Generated ${escapeHtml(company.generatedDate)}</span>
    </div>
  </div>

  <div class="report-body">
    <div class="info-grid">
      <div class="info-card">
        <h3>Store Information</h3>
        ${row("Address", fullAddress)}
        ${row("City", company.city)}
        ${row("District", company.district)}
        ${row("Phone", company.phone)}
        ${row("CR Number", company.crNumber)}
        ${row("VAT Number", company.vatNumber)}
      </div>
      <div class="info-card">
        <h3>Report Details</h3>
        ${row("Report Type", scopeLabel)}
        ${row("Generated", company.generatedAt)}
        ${row("Filters", filterText)}
        ${row("Currency", currency)}
        ${row("Customers", truncated ? `${customerCount} / ${totalMatched}` : String(customerCount))}
        ${row("Document", "Customer Accounts · Dukkan POS")}
      </div>
    </div>

    ${kpiSection}
  </div>
</div>`;
}

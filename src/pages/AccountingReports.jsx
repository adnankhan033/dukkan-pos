import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { isAccountingEnabled } from "../utils/accounting";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import { Input } from "../components/common/Input";
import { LoadingSpinner, Alert } from "../components/common/Loading";
import AccountingGate from "../components/common/AccountingGate";
import { downloadTextFile } from "../utils/downloadText";
import { formatCurrency, todayISO } from "../utils/format";
import { getBusinessPeriodDateRange } from "../utils/businessDate";
import "./AccountingHub.css";

const REPORTS = [
  { id: "trial", label: "Trial balance" },
  { id: "pl", label: "Profit & loss" },
  { id: "bs", label: "Balance sheet" },
  { id: "cf", label: "Cash flow" },
];

export default function AccountingReports({ embedded = false }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const month = getBusinessPeriodDateRange("monthly", settings);
  const [report, setReport] = useState("trial");
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to || todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      let next = null;
      if (report === "trial") next = await accountingService.trialBalance({ from, to });
      else if (report === "pl") next = await accountingService.ledgerProfitAndLoss({ from, to });
      else if (report === "bs") next = await accountingService.balanceSheet({ asOf: to });
      else next = await accountingService.cashFlow({ from, to });
      setData({ kind: report, ...next });
    } catch (err) {
      setError(err.message || "Could not build report");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, report, from, to]);

  function selectReport(id) {
    if (id === report) return;
    setReport(id);
    setData(null);
    setError("");
    setLoading(true);
  }

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (report === "trial" && data?.items) {
      const rows = [["Code", "Account", "Debit", "Credit"]];
      for (const row of data.items) {
        rows.push([row.code, row.name, row.tb_debit, row.tb_credit]);
      }
      downloadTextFile(`trial-balance-${to}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
    }
  }

  const actions = enabled ? (
    <>
      <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer size={16} /> Print
      </Button>
    </>
  ) : null;

  const body = (
    <>
      {embedded && enabled ? <div className="acct-inline-actions">{actions}</div> : null}
      <div className="acct-subtabs">
        {REPORTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={report === item.id ? "active" : ""}
            onClick={() => selectReport(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="acct-filters">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {error ? <Alert type="error">{error}</Alert> : null}
      {loading || (!error && (!data || data.kind !== report)) ? (
        <LoadingSpinner message="Building report..." />
      ) : error || !data ? null : report === "trial" ? (
        <>
          <Alert type={data.balanced ? "success" : "error"}>
            {data.balanced
              ? `Balanced — debit ${formatCurrency(data.totalDebit, currency)} equals credit ${formatCurrency(data.totalCredit, currency)}`
              : `Out of balance — debit ${formatCurrency(data.totalDebit, currency)} / credit ${formatCurrency(data.totalCredit, currency)}`}
          </Alert>
          <Table
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Account" },
              { key: "tb_debit", label: "Debit", render: (r) => formatCurrency(r.tb_debit, currency) },
              { key: "tb_credit", label: "Credit", render: (r) => formatCurrency(r.tb_credit, currency) },
            ]}
            data={(data.items || []).filter((r) => r.tb_debit || r.tb_credit)}
            emptyMessage="No balances in this period."
          />
        </>
      ) : report === "pl" ? (
        <div className="acct-statement">
          <Row label="Sales" value={data.sales} currency={currency} />
          {data.otherIncome ? <Row label="Other income" value={data.otherIncome} currency={currency} /> : null}
          <Row label="Sales returns" value={-(data.salesReturns || 0)} currency={currency} />
          {data.discounts ? <Row label="Discounts" value={-(data.discounts || 0)} currency={currency} /> : null}
          <Row label="Net revenue" value={data.netRevenue} currency={currency} strong />
          <Row label="Cost of goods sold" value={-(data.cogs || 0)} currency={currency} />
          <Row label="Gross profit" value={data.grossProfit} currency={currency} strong />
          {(data.operatingExpenses || []).map((row) => (
            <Row key={row.id} label={row.name} value={-(row.balance || 0)} currency={currency} />
          ))}
          <Row label="Net profit" value={data.netProfit} currency={currency} strong />
        </div>
      ) : report === "bs" ? (
        <div className="acct-statement">
          <h3>Assets</h3>
          {(data.assets || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={`${row.code} ${row.name}`} value={row.balance} currency={currency} />
          ))}
          <Row label="Total assets" value={data.assetTotal} currency={currency} strong />
          <h3>Liabilities</h3>
          {(data.liabilities || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={`${row.code} ${row.name}`} value={row.balance} currency={currency} />
          ))}
          <Row label="Total liabilities" value={data.liabilityTotal} currency={currency} strong />
          <h3>Equity</h3>
          {(data.equity || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={`${row.code} ${row.name}`} value={row.balance} currency={currency} />
          ))}
          <Row label="Current profit / loss" value={data.netProfit} currency={currency} />
          <Row label="Total equity" value={data.equityTotal} currency={currency} strong />
          <Alert type={data.balanced ? "success" : "error"}>
            {data.balanced
              ? "Assets = Liabilities + Equity"
              : `Accounting equation is out of balance — assets ${formatCurrency(data.assetTotal, currency)} vs liabilities + equity ${formatCurrency(data.liabilityTotal + data.equityTotal, currency)}`}
          </Alert>
        </div>
      ) : report === "cf" ? (
        <div className="acct-statement">
          <Row label="Opening cash" value={data.opening} currency={currency} />
          <Row label="Operating" value={data.operating} currency={currency} />
          <Row label="Investing" value={data.investing} currency={currency} />
          <Row label="Financing" value={data.financing} currency={currency} />
          <Row label="Closing cash" value={data.closing} currency={currency} strong />
        </div>
      ) : null}
    </>
  );

  return (
    <div className={embedded ? "acct-statements" : "acct-hub"}>
      {embedded ? null : (
        <PageHeader
          title="Financial reports"
          subtitle="Trial balance, profit & loss, balance sheet, and cash flow from the same ledger."
          actions={actions}
        />
      )}
      {embedded ? body : <AccountingGate enabled={enabled}>{body}</AccountingGate>}
    </div>
  );
}

function Row({ label, value, currency, strong }) {
  return (
    <div className={`acct-row ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <span>{formatCurrency(value, currency)}</span>
    </div>
  );
}

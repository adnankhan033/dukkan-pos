import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { friendlyAccountLabel, isAccountingEnabled } from "../utils/accounting";
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
  { id: "pl", label: "Profit" },
  { id: "bs", label: "What we own" },
  { id: "cf", label: "Cash movement" },
  { id: "trial", label: "Accountant" },
];

function monthStartISO() {
  return todayISO().slice(0, 8) + "01";
}

function yearStartISO() {
  return `${todayISO().slice(0, 4)}-01-01`;
}

function periodPresetFor(from, to) {
  if (!from && !to) return "all";
  if (from === monthStartISO() && (to === todayISO() || !to)) return "month";
  if (from === yearStartISO() && (to === todayISO() || !to)) return "year";
  return "custom";
}

export default function AccountingReports({ embedded = false }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const month = getBusinessPeriodDateRange("monthly", settings);
  const [report, setReport] = useState("pl");
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
      if (report === "trial") next = await accountingService.trialBalance({ from: from || null, to });
      else if (report === "pl") next = await accountingService.ledgerProfitAndLoss({ from: from || null, to });
      else if (report === "bs") next = await accountingService.balanceSheet({ asOf: to });
      else next = await accountingService.cashFlow({ from: from || null, to });
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
      {report === "trial" ? (
        <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
      ) : null}
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
        {report !== "bs" ? (
          <>
            <div className="acct-period-chips">
              {["month", "year", "all"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={periodPresetFor(from, to) === preset ? "active" : ""}
                  onClick={() => {
                    if (preset === "month") {
                      setFrom(monthStartISO());
                      setTo(todayISO());
                    } else if (preset === "year") {
                      setFrom(yearStartISO());
                      setTo(todayISO());
                    } else {
                      setFrom("");
                      setTo(todayISO());
                    }
                  }}
                >
                  {preset === "month" ? "This month" : preset === "year" ? "This year" : "All dates"}
                </button>
              ))}
            </div>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </>
        ) : null}
        <Input
          label={report === "bs" ? "As of" : "To"}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {error ? <Alert type="error">{error}</Alert> : null}
      {loading || (!error && (!data || data.kind !== report)) ? (
        <LoadingSpinner message="Preparing a simple summary..." />
      ) : error || !data ? null : report === "trial" ? (
        <>
          <p className="acct-hint">Debit is مدين. Credit is دائن. For day-to-day, use Profit and What we own.</p>
          <Alert type={data.balanced ? "success" : "error"}>
            {data.balanced ? "Books match." : "Books need a check — totals do not match."}
          </Alert>
          <Table
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Account" },
              { key: "tb_debit", label: "Debit · مدين", render: (r) => formatCurrency(r.tb_debit, currency) },
              { key: "tb_credit", label: "Credit · دائن", render: (r) => formatCurrency(r.tb_credit, currency) },
            ]}
            data={data.items || []}
            emptyMessage="No accounts yet. Turn books on in Settings if you just cleared data."
          />
        </>
      ) : report === "pl" ? (
        <div className="acct-statement">
          <div className="acct-summary">
            <Hero label="You sold" value={data.netRevenue} currency={currency} />
            <Hero label="Profit left" value={data.netProfit} currency={currency} featured />
          </div>
          <p className="acct-hint">Sales minus product cost and shop expenses for this period. VAT is tax, not profit.</p>
          <Row label="Sales" value={data.sales} currency={currency} />
          {data.otherIncome ? <Row label="Other income" value={data.otherIncome} currency={currency} /> : null}
          {data.salesReturns ? <Row label="Returns" value={-(data.salesReturns || 0)} currency={currency} /> : null}
          {data.discounts ? <Row label="Discounts" value={-(data.discounts || 0)} currency={currency} /> : null}
          <Row label="Sales after returns" value={data.netRevenue} currency={currency} strong />
          <Row label="Product cost" value={-(data.cogs || 0)} currency={currency} />
          <Row label="Profit before expenses" value={data.grossProfit} currency={currency} strong />
          {(data.operatingExpenses || []).map((row) => (
            <Row
              key={row.id}
              label={friendlyAccountLabel(row)}
              value={-(row.balance || 0)}
              currency={currency}
            />
          ))}
          {data.inventoryAdjustments ? (
            <Row
              label="Stock correction"
              value={-(data.inventoryAdjustments || 0)}
              currency={currency}
            />
          ) : null}
          <Row label="Profit left" value={data.netProfit} currency={currency} strong />
        </div>
      ) : report === "bs" ? (
        <div className="acct-statement">
          <div className="acct-summary">
            <Hero label="We own" value={data.assetTotal} currency={currency} />
            <Hero label="We owe" value={data.liabilityTotal} currency={currency} />
            <Hero label="Left for owners" value={data.equityTotal} currency={currency} featured />
          </div>
          <h3>What we own</h3>
          {(data.assets || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={friendlyAccountLabel(row)} value={row.balance} currency={currency} />
          ))}
          <Row label="Total we own" value={data.assetTotal} currency={currency} strong />
          <h3>What we owe</h3>
          {(data.liabilities || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={friendlyAccountLabel(row)} value={row.balance} currency={currency} />
          ))}
          <Row label="Total we owe" value={data.liabilityTotal} currency={currency} strong />
          <h3>Left for owners</h3>
          <p className="acct-hint">
            Partner capital is what they put in. Opening difference is the leftover so cash, stock,
            and debts still add up. Profit is sales minus product cost and expenses.
          </p>
          {(data.equity || []).filter((r) => r.balance).map((row) => (
            <Row key={row.id} label={friendlyAccountLabel(row)} value={row.balance} currency={currency} />
          ))}
          <Row label="Profit so far" value={data.netProfit} currency={currency} />
          <Row label="Total left for owners" value={data.equityTotal} currency={currency} strong />
          <Alert type={data.balanced ? "success" : "error"}>
            {data.balanced
              ? "Books match — what we own equals what we owe plus the owners’ share."
              : "Books need a check — totals do not match yet."}
          </Alert>
        </div>
      ) : report === "cf" ? (
        <div className="acct-statement">
          <div className="acct-summary">
            <Hero label="Cash at start" value={data.opening} currency={currency} />
            <Hero label="Cash now" value={data.closing} currency={currency} featured />
          </div>
          <p className="acct-hint">How cash and bank moved in this period.</p>
          <Row label="Cash at start" value={data.opening} currency={currency} />
          <Row label="From shop work" value={data.operating} currency={currency} />
          <Row label="From stock / equipment" value={data.investing} currency={currency} />
          <Row label="From partners" value={data.financing} currency={currency} />
          <Row label="Cash now" value={data.closing} currency={currency} strong />
        </div>
      ) : null}
    </>
  );

  return (
    <div className={embedded ? "acct-statements" : "acct-hub"}>
      {embedded ? null : (
        <PageHeader
          title="Reports"
          subtitle="Simple picture of sales, profit, cash, and what the shop owns."
          actions={actions}
        />
      )}
      {embedded ? body : <AccountingGate enabled={enabled}>{body}</AccountingGate>}
    </div>
  );
}

function Hero({ label, value, currency, featured }) {
  const amount = Number(value) || 0;
  const tone = amount > 0.005 ? "in" : amount < -0.005 ? "out" : "zero";
  return (
    <div className={`acct-summary-card ${featured ? "featured" : ""}`}>
      <span>{label}</span>
      <strong className={`acct-money ${tone}`}>{formatCurrency(amount, currency)}</strong>
    </div>
  );
}

function Row({ label, value, currency, strong }) {
  const amount = Number(value) || 0;
  const tone = amount > 0.005 ? "in" : amount < -0.005 ? "out" : "zero";
  return (
    <div className={`acct-row ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <span className={`acct-money ${tone}`}>{formatCurrency(amount, currency)}</span>
    </div>
  );
}

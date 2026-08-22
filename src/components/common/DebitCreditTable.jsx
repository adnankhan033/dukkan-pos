import { formatCurrency, formatDate } from "../../utils/format";
import { CREDIT_LABEL, DEBIT_LABEL } from "../../utils/debitCredit";
import "./DebitCreditTable.css";

function Amount({ value, currency, tone }) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) < 0.005) return <span className="dc-empty">—</span>;
  return <span className={`dc-amount ${tone}`}>{formatCurrency(amount, currency)}</span>;
}

export default function DebitCreditTable({
  rows = [],
  currency = "SAR",
  hint = "",
  emptyMessage = "No debit or credit yet.",
}) {
  return (
    <div className="dc-wrap">
      <div className="dc-legend" aria-hidden="true">
        <span className="dc-pill debit">{DEBIT_LABEL}</span>
        <span className="dc-pill credit">{CREDIT_LABEL}</span>
      </div>
      {hint ? <p className="dc-hint">{hint}</p> : null}
      {!rows.length ? (
        <p className="dc-empty-msg">{emptyMessage}</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table dc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="dc-col debit">{DEBIT_LABEL}</th>
                <th className="dc-col credit">{CREDIT_LABEL}</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    <strong>{row.details}</strong>
                    {row.note ? <small className="dc-note">{row.note}</small> : null}
                  </td>
                  <td className="dc-col"><Amount value={row.debit} currency={currency} tone="debit" /></td>
                  <td className="dc-col"><Amount value={row.credit} currency={currency} tone="credit" /></td>
                  <td>
                    <strong className={Number(row.balance) > 0.005 ? "dc-amount due" : "dc-amount settled"}>
                      {formatCurrency(row.balance, currency)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

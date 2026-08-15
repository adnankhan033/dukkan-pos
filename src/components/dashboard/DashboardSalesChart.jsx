import { formatCurrency } from "../../utils/format";
import "./DashboardSalesChart.css";

function buildBars(data) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return data.map((d, i) => ({
    ...d,
    heightPct: Math.max(6, (d.total / max) * 100),
    isToday: i === data.length - 1,
  }));
}

export default function DashboardSalesChart({ data = [], currency = "SAR", compact = false }) {
  if (!data.length) return null;

  const bars = buildBars(data);
  const weekTotal = data.reduce((sum, d) => sum + d.total, 0);
  const bestDay = data.reduce((best, d) => (d.total > best.total ? d : best), data[0]);

  return (
    <section className={`dashboard-chart-card ${compact ? "dashboard-chart-compact" : ""}`}>
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-chart-title">7-Day Sales Pulse</h3>
          <p className="dashboard-chart-subtitle">Net revenue by business day</p>
        </div>
        <div className="dashboard-chart-summary">
          <span className="dashboard-chart-summary-label">Week total</span>
          <strong>{formatCurrency(weekTotal, currency)}</strong>
        </div>
      </div>

      <div className="dashboard-chart-bars" role="img" aria-label="Seven day sales chart">
        {bars.map((bar) => (
          <div key={bar.date} className="dashboard-chart-bar-col">
            <div className="dashboard-chart-bar-wrap">
              <div
                className={`dashboard-chart-bar ${bar.isToday ? "today" : ""}`}
                style={{ "--bar-h": `${bar.heightPct}%` }}
                title={`${bar.label}: ${formatCurrency(bar.total, currency)}`}
              >
                <span className="dashboard-chart-bar-tooltip">
                  {formatCurrency(bar.total, currency)}
                </span>
              </div>
            </div>
            <span className={`dashboard-chart-bar-label ${bar.isToday ? "today" : ""}`}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>

      <div className="dashboard-chart-footer">
        <span>
          Best day: <strong>{bestDay.label}</strong> · {formatCurrency(bestDay.total, currency)}
        </span>
      </div>
    </section>
  );
}

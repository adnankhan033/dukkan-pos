import { Activity, ShieldCheck, AlertCircle } from "lucide-react";
import "./DashboardHealthScore.css";

function computeScore(stats) {
  let score = 100;

  const lowRatio =
    stats.totalProducts > 0 ? stats.lowStockCount / stats.totalProducts : 0;
  score -= Math.min(35, lowRatio * 120);

  const returnRatio =
    stats.todayGrossSales > 0 ? stats.todayReturns / stats.todayGrossSales : 0;
  if (returnRatio > 0.15) score -= 25;
  else if (returnRatio > 0.08) score -= 12;
  else if (returnRatio > 0.03) score -= 5;

  if (stats.monthlyProfit < 0) score -= 20;
  else if (stats.monthlyProfit === 0 && stats.monthlyRevenue > 0) score -= 8;

  if (stats.todaySales <= 0 && stats.totalProducts > 0) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreMeta(score) {
  if (score >= 85) return { label: "Excellent", tone: "great", Icon: ShieldCheck };
  if (score >= 65) return { label: "Healthy", tone: "good", Icon: Activity };
  return { label: "Needs attention", tone: "warn", Icon: AlertCircle };
}

export default function DashboardHealthScore({ stats }) {
  const score = computeScore(stats);
  const { label, tone, Icon } = scoreMeta(score);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`dashboard-health dashboard-health-${tone}`}>
      <div className="dashboard-health-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle className="dashboard-health-ring-bg" cx="50" cy="50" r="42" />
          <circle
            className="dashboard-health-ring-fill"
            cx="50"
            cy="50"
            r="42"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="dashboard-health-score">{score}</div>
      </div>
      <div className="dashboard-health-body">
        <div className="dashboard-health-badge">
          <Icon size={14} />
          <span>Store health</span>
        </div>
        <strong className="dashboard-health-label">{label}</strong>
        <p className="dashboard-health-desc">
          Based on stock levels, returns, and monthly profitability.
        </p>
      </div>
    </div>
  );
}

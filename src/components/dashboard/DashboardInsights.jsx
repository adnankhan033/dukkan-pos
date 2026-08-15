import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Lightbulb,
  Package,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card } from "../common/Card";
import { formatCurrency } from "../../utils/format";
import "./DashboardInsights.css";

const ICONS = {
  warning: AlertTriangle,
  positive: TrendingUp,
  timing: CalendarDays,
  product: Trophy,
  inventory: Package,
  neutral: Lightbulb,
};

function InsightIcon({ type, id }) {
  if (id === "sales-down") return TrendingDown;
  if (id === "product-timing") return Clock;
  const Icon = ICONS[type] || Sparkles;
  return Icon;
}

export default function DashboardInsights({ insights = [], topProducts = [], currency = "SAR" }) {
  return (
    <div className="dashboard-insights-wrap">
      <Card className="dashboard-insights-card">
        <div className="dashboard-insights-head">
          <div className="dashboard-insights-head-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="card-title">Smart Insights</h3>
            <p>Actionable patterns from your real sales, stock, and timing data.</p>
          </div>
        </div>

        <ul className="dashboard-insights-list">
          {insights.map((insight) => {
            const Icon = InsightIcon({ type: insight.type, id: insight.id });
            return (
              <li key={insight.id} className={`dashboard-insight insight-${insight.type}`}>
                <div className="dashboard-insight-icon">
                  <Icon size={18} />
                </div>
                <div className="dashboard-insight-body">
                  <span className="dashboard-insight-title">{insight.title}</span>
                  <p className="dashboard-insight-message">{insight.message}</p>
                  {insight.detail && <span className="dashboard-insight-detail">{insight.detail}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {topProducts.length > 0 && (
        <Card className="dashboard-top-products-card">
          <div className="dashboard-insights-head compact">
            <div className="dashboard-insights-head-icon products">
              <Trophy size={18} />
            </div>
            <div>
              <h3 className="card-title">Best Sellers This Week</h3>
              <p>Most sold products in the last 7 days.</p>
            </div>
          </div>

          <ol className="dashboard-top-products-list">
            {topProducts.map((product, index) => (
              <li
                key={product.id}
                className={`dashboard-top-product-item ${index < 3 ? `rank-${index + 1}` : ""}`}
              >
                <span className="dashboard-top-product-rank">#{index + 1}</span>
                <div className="dashboard-top-product-info">
                  <strong>{product.name}</strong>
                  {product.nameAr && (
                    <span className="dashboard-top-product-ar" dir="rtl">
                      {product.nameAr}
                    </span>
                  )}
                </div>
                <div className="dashboard-top-product-stats">
                  <span>{product.unitsSold} sold</span>
                  <span>{formatCurrency(product.revenue, currency)}</span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

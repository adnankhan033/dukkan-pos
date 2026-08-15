import "./Card.css";
import AnimatedValue from "../dashboard/AnimatedValue";

function TrendBadge({ trend }) {
  if (trend == null || Number.isNaN(trend)) return null;
  const positive = trend >= 0;
  return (
    <span className={`stat-card-trend ${positive ? "up" : "down"}`}>
      {positive ? "▲" : "▼"} {Math.abs(trend)}%
    </span>
  );
}

export function Card({ children, className = "", style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  numericValue,
  currency,
  icon: Icon,
  variant = "primary",
  featured = false,
  trend,
  trendLabel = "vs 6-day avg",
  animate = true,
  delay = 0,
}) {
  const canAnimate =
    animate && numericValue != null && Number.isFinite(Number(numericValue));

  return (
    <Card
      className={`stat-card ${featured ? "stat-card-featured" : ""} stat-card-${variant}`}
      style={{ "--stat-delay": `${delay}ms` }}
    >
      <div className="stat-card-shine" aria-hidden="true" />
      <div className="stat-card-top">
        {Icon && (
          <div className={`stat-card-icon ${variant}`}>
            <Icon size={featured ? 22 : 20} />
          </div>
        )}
        <div className="stat-card-meta">
          <span className="stat-card-label">{label}</span>
          {trend != null && !featured ? (
            <span className="stat-card-trend-label">{trendLabel}</span>
          ) : null}
        </div>
        {featured && trend != null ? <TrendBadge trend={trend} /> : null}
      </div>
      <span className="stat-card-value">
        {canAnimate ? (
          <>
            <AnimatedValue value={numericValue} decimals={2} />
            {currency ? ` ${currency}` : ""}
          </>
        ) : (
          value
        )}
      </span>
      {featured && trend != null ? (
        <span className="stat-card-trend-note">{trendLabel}</span>
      ) : null}
      {!featured && trend != null ? <TrendBadge trend={trend} /> : null}
    </Card>
  );
}

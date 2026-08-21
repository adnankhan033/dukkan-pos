import { useNavigate } from "react-router-dom";
import { formatSignedCurrency } from "../../utils/format";

export default function DashboardMetricTiles({ tiles = [] }) {
  const navigate = useNavigate();

  if (!tiles.length) return null;

  return (
    <div className="dashboard-metric-tiles">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const Tag = tile.path ? "button" : "div";
        return (
          <Tag
            key={tile.label}
            type={tile.path ? "button" : undefined}
            className={`dashboard-metric-tile ${tile.tone || ""}`}
            onClick={tile.path ? () => navigate(tile.path) : undefined}
          >
            {Icon ? (
              <span className="dashboard-metric-tile-icon">
                <Icon size={18} />
              </span>
            ) : null}
            <span className="dashboard-metric-tile-label">{tile.label}</span>
            <strong className="dashboard-metric-tile-value">
              {typeof tile.value === "number" && tile.currency
                ? formatSignedCurrency(tile.value, tile.currency, tile.sign)
                : tile.value}
            </strong>
            {tile.hint ? <small className="dashboard-metric-tile-hint">{tile.hint}</small> : null}
          </Tag>
        );
      })}
    </div>
  );
}

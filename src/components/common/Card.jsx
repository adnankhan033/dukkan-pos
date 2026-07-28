import "./Card.css";

export function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function StatCard({ label, value, icon: Icon, variant = "primary" }) {
  return (
    <Card className="stat-card">
      {Icon && (
        <div className={`stat-card-icon ${variant}`}>
          <Icon size={20} />
        </div>
      )}
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
    </Card>
  );
}

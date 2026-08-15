export default function DashboardSectionTitle({ title, subtitle, action }) {
  return (
    <div className="dashboard-section-title-row">
      <div className="dashboard-section-title-main">
        <h2 className="dashboard-section-title">{title}</h2>
        {subtitle ? <p className="dashboard-section-title-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="dashboard-section-title-action">{action}</div> : null}
    </div>
  );
}

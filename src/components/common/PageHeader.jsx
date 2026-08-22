import PageBackButton from "./PageBackButton";
import "./PageHeader.css";

export default function PageHeader({ title, subtitle, actions, showBack = true }) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        {showBack ? <PageBackButton /> : null}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

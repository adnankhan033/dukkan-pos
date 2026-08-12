import appIcon from "../../../images/icon.svg";
import "./AuthShell.css";

const ACTIVATION_STEPS = [
  { id: 1, label: "Register" },
  { id: 2, label: "Activate" },
];

export default function AuthShell({
  formTitle,
  formSubtitle,
  step,
  wide = false,
  footer,
  children,
}) {
  return (
    <div className={`auth-shell${wide ? " auth-shell--wide" : ""}`}>
      <aside className="auth-hero" aria-hidden="false">
        <div className="auth-hero-bg">
          <div className="auth-hero-orb auth-hero-orb--cyan" />
          <div className="auth-hero-orb auth-hero-orb--emerald" />
          <div className="auth-hero-grid" />
        </div>

        <div className="auth-hero-content">
          <div className="auth-hero-icon-stage">
            <div className="auth-hero-icon-glow" />
            <div className="auth-hero-icon-ring">
              <img src={appIcon} alt="" className="auth-hero-icon" draggable={false} />
            </div>
          </div>

          <div className="auth-hero-brand">
            <h1 className="auth-hero-title">DukkanPOS</h1>
            <p className="auth-hero-tagline">
              Modern point of sale built for retail, speed, and daily store operations.
            </p>
          </div>

          <ul className="auth-hero-features">
            <li>Sales & inventory in one place</li>
            <li>Receipts, reports, and daily close</li>
            <li>Secure local-first desktop app</li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <div className={`auth-card${wide ? " activate-card" : ""}`}>
          {typeof step === "number" && (
            <ol className="auth-steps" aria-label="Activation progress">
              {ACTIVATION_STEPS.map(({ id, label }) => {
                const isComplete = step > id;
                const isActive = step === id;
                return (
                  <li
                    key={id}
                    className={[
                      "auth-step",
                      isComplete && "auth-step--complete",
                      isActive && "auth-step--active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="auth-step-marker">{isComplete ? "✓" : id}</span>
                    <span className="auth-step-label">{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <header className="auth-form-header">
            <h2>{formTitle}</h2>
            {formSubtitle && <p>{formSubtitle}</p>}
          </header>

          {children}

          {footer && <div className="auth-form-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

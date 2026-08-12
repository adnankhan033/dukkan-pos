import appIcon from "../../../images/icon.svg";
import "./AuthBrand.css";

const ACTIVATION_STEPS = [
  { id: 1, label: "Register" },
  { id: 2, label: "Activate" },
];

export default function AuthBrand({ title, subtitle, step }) {
  return (
    <div className="auth-brand-block">
      <div className="auth-brand-icon-wrap" aria-hidden="true">
        <div className="auth-brand-icon-glow" />
        <div className="auth-brand-icon-ring">
          <img src={appIcon} alt="" className="auth-brand-icon" draggable={false} />
        </div>
      </div>

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

      <div className="auth-brand-copy">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

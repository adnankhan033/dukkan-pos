import { Sparkles, Store, ShoppingCart, BarChart3, CheckCircle2 } from "lucide-react";
import appIcon from "../../../images/icon.svg";
import Button from "../common/Button";
import "./WelcomeModal.css";

export default function WelcomeModal({ open, userName, storeName, onContinue }) {
  if (!open) return null;

  const displayName = userName?.trim() || "there";
  const store = storeName?.trim() || "your store";

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-backdrop" aria-hidden="true">
        <span className="welcome-orb welcome-orb--1" />
        <span className="welcome-orb welcome-orb--2" />
        <span className="welcome-orb welcome-orb--3" />
        <span className="welcome-spark welcome-spark--1" />
        <span className="welcome-spark welcome-spark--2" />
        <span className="welcome-spark welcome-spark--3" />
        <span className="welcome-spark welcome-spark--4" />
      </div>

      <div className="welcome-card">
        <div className="welcome-card-hero">
          <div className="welcome-icon-wrap">
            <img src={appIcon} alt="" className="welcome-icon" draggable={false} />
          </div>
          <div className="welcome-badge">
            <CheckCircle2 size={16} strokeWidth={2.5} />
            <span>Setup complete</span>
          </div>
        </div>

        <div className="welcome-card-body">
          <p className="welcome-eyebrow">
            <Sparkles size={14} />
            Welcome to DukkanPOS
          </p>
          <h2 id="welcome-title" className="welcome-title">
            Hello, {displayName}!
          </h2>
          <p className="welcome-lead">
            Your system has been <strong>successfully configured</strong> and{" "}
            <strong>{store}</strong> is ready to go. You&apos;re all set to run your business
            from one powerful desktop app.
          </p>

          <ul className="welcome-features">
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--sales">
                <ShoppingCart size={18} />
              </span>
              <div>
                <strong>Start selling</strong>
                <span>Fast checkout and receipts at the counter</span>
              </div>
            </li>
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--store">
                <Store size={18} />
              </span>
              <div>
                <strong>Manage your store</strong>
                <span>Products, inventory, and daily operations</span>
              </div>
            </li>
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--reports">
                <BarChart3 size={18} />
              </span>
              <div>
                <strong>Track performance</strong>
                <span>Reports and insights to grow your business</span>
              </div>
            </li>
          </ul>

          <Button type="button" className="btn-lg welcome-cta" onClick={onContinue}>
            Get Started
          </Button>

          <p className="welcome-footer-note">
            Thank you for choosing DukkanPOS — we&apos;re glad to have you on board.
          </p>
        </div>
      </div>
    </div>
  );
}

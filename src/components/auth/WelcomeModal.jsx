import { Sparkles, Store, ShoppingCart, BarChart3, CheckCircle2, PartyPopper, Rocket } from "lucide-react";
import appIcon from "../../../images/icon.svg";
import Button from "../common/Button";
import "./WelcomeModal.css";

export default function WelcomeModal({ open, userName, storeName, onContinue }) {
  if (!open) return null;

  const displayName = userName?.trim() || "Admin";
  const store = storeName?.trim() || "your store";

  return (
    <div className="welcome-overlay welcome-overlay--full" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-backdrop" aria-hidden="true">
        <span className="welcome-orb welcome-orb--1" />
        <span className="welcome-orb welcome-orb--2" />
        <span className="welcome-orb welcome-orb--3" />
        <span className="welcome-confetti welcome-confetti--1" />
        <span className="welcome-confetti welcome-confetti--2" />
        <span className="welcome-confetti welcome-confetti--3" />
        <span className="welcome-confetti welcome-confetti--4" />
        <span className="welcome-confetti welcome-confetti--5" />
        <span className="welcome-spark welcome-spark--1" />
        <span className="welcome-spark welcome-spark--2" />
        <span className="welcome-spark welcome-spark--3" />
        <span className="welcome-spark welcome-spark--4" />
      </div>

      <div className="welcome-card welcome-card--celebrate welcome-card--full">
        <div className="welcome-card-hero welcome-card-hero--large">
          <div className="welcome-icon-wrap welcome-icon-wrap--large">
            <div className="welcome-icon-pulse" />
            <img src={appIcon} alt="" className="welcome-icon" draggable={false} />
          </div>
          <div className="welcome-badge welcome-badge--success">
            <PartyPopper size={18} strokeWidth={2.5} />
            <span>Congratulations!</span>
          </div>
        </div>

        <div className="welcome-card-body welcome-card-body--large">
          <p className="welcome-eyebrow">
            <Sparkles size={16} />
            Successfully configured
          </p>
          <h2 id="welcome-title" className="welcome-title welcome-title--gradient">
            Welcome, {displayName}!
          </h2>
          <p className="welcome-lead welcome-lead--large">
            You have <strong>successfully set up</strong>{" "}
            <strong className="welcome-store-name">{store}</strong>.
            <br />
            Your store is ready — start selling and managing everything from one place.
          </p>

          <div className="welcome-success-ring">
            <CheckCircle2 size={28} strokeWidth={2} />
            <span>Setup complete</span>
          </div>

          <ul className="welcome-features">
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--sales">
                <ShoppingCart size={20} />
              </span>
              <div>
                <strong>Start selling</strong>
                <span>Fast checkout and professional receipts</span>
              </div>
            </li>
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--store">
                <Store size={20} />
              </span>
              <div>
                <strong>Manage your store</strong>
                <span>Products, inventory, and daily operations</span>
              </div>
            </li>
            <li>
              <span className="welcome-feature-icon welcome-feature-icon--reports">
                <BarChart3 size={20} />
              </span>
              <div>
                <strong>Track performance</strong>
                <span>Reports and insights to grow your business</span>
              </div>
            </li>
          </ul>

          <Button type="button" className="btn-lg welcome-cta welcome-cta--glow" onClick={onContinue}>
            <Rocket size={18} />
            Open Dashboard
          </Button>

          <p className="welcome-footer-note">
            <CheckCircle2 size={14} /> Everything is ready. Enjoy using Nexttel POS!
          </p>
        </div>
      </div>
    </div>
  );
}

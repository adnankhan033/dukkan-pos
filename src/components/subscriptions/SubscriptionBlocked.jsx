import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../contexts/store";
import { getSubscriptionBlockMessage } from "../../utils/subscriptions";
import Button from "../common/Button";
import SubscriptionCard from "./SubscriptionCard";
import "./SubscriptionBlocked.css";

export default function SubscriptionBlocked({ subscription, user, onRefresh, checking = false }) {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/login", {
      replace: true,
      state: { message: getSubscriptionBlockMessage(subscription) },
    });
  }

  return (
    <div className="subscription-blocked-screen">
      <div className="subscription-blocked-card">
        <div className="subscription-blocked-icon">
          <AlertTriangle size={40} />
        </div>
        <h1>Subscription Required</h1>
        <p className="subscription-blocked-message">
          {getSubscriptionBlockMessage(subscription)}
        </p>
        <SubscriptionCard subscription={subscription} user={user} compact />
        <div className="subscription-blocked-actions">
          <Button variant="secondary" onClick={onRefresh} disabled={checking}>
            <RefreshCw size={16} /> {checking ? "Checking..." : "Check Again"}
          </Button>
          <Button onClick={handleSignOut}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

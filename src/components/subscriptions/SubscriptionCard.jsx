import { AlertTriangle, Calendar, Clock, ShieldCheck } from "lucide-react";
import Badge from "../common/Badge";
import { Card } from "../common/Card";
import { formatDate } from "../../utils/format";
import { SUBSCRIPTION_STATUS } from "../../utils/subscriptions";
import { isAdmin } from "../../utils/roles";
import "./SubscriptionCard.css";

function statusVariant(status) {
  switch (status) {
    case SUBSCRIPTION_STATUS.ACTIVE:
      return "success";
    case SUBSCRIPTION_STATUS.EXPIRING_SOON:
      return "warning";
    case SUBSCRIPTION_STATUS.EXPIRED:
      return "danger";
    case SUBSCRIPTION_STATUS.SUSPENDED:
      return "neutral";
    default:
      return "neutral";
  }
}

function statusDot(status) {
  switch (status) {
    case SUBSCRIPTION_STATUS.ACTIVE:
      return "dot-active";
    case SUBSCRIPTION_STATUS.EXPIRING_SOON:
      return "dot-expiring";
    case SUBSCRIPTION_STATUS.EXPIRED:
      return "dot-expired";
    case SUBSCRIPTION_STATUS.SUSPENDED:
      return "dot-suspended";
    default:
      return "dot-none";
  }
}

function reminderMessage(days) {
  if (days === 1) return "Your subscription expires tomorrow. Contact your administrator.";
  return `Your subscription expires in ${days} days. Contact your administrator to renew.`;
}

export default function SubscriptionCard({ subscription, user, compact = false }) {
  const adminUser = isAdmin(user);

  if (adminUser) {
    return (
      <Card className={`subscription-card subscription-card-admin ${compact ? "compact" : ""}`}>
        <div className="subscription-card-header">
          <div className="subscription-card-title-wrap">
            <ShieldCheck size={20} />
            <h3 className="subscription-card-title">Subscription Information</h3>
          </div>
          <Badge variant="info">Administrator</Badge>
        </div>
        <p className="subscription-admin-note">
          Administrator accounts are not restricted by subscriptions and can manage all user licenses.
        </p>
      </Card>
    );
  }

  if (!subscription?.hasSubscription) {
    return (
      <Card className={`subscription-card subscription-card-blocked ${compact ? "compact" : ""}`}>
        <div className="subscription-card-header">
          <div className="subscription-card-title-wrap">
            <AlertTriangle size={20} />
            <h3 className="subscription-card-title">Subscription Information</h3>
          </div>
          <Badge variant="danger">No Subscription</Badge>
        </div>
        <p className="subscription-expired-message">
          No active subscription is assigned to your account. Please contact your administrator.
        </p>
      </Card>
    );
  }

  const blocked =
    subscription.status === SUBSCRIPTION_STATUS.EXPIRED ||
    subscription.status === SUBSCRIPTION_STATUS.SUSPENDED;

  return (
    <Card className={`subscription-card ${blocked ? "subscription-card-blocked" : ""} ${compact ? "compact" : ""}`}>
      <div className="subscription-card-header">
        <div className="subscription-card-title-wrap">
          <Calendar size={20} />
          <h3 className="subscription-card-title">Subscription Information</h3>
        </div>
        <span className={`subscription-status-pill ${statusDot(subscription.status)}`}>
          <span className="subscription-status-dot" />
          {subscription.statusLabel}
        </span>
      </div>

      {subscription.status === SUBSCRIPTION_STATUS.EXPIRED && (
        <div className="subscription-alert subscription-alert-danger">
          Your subscription has expired. Please contact your administrator to renew your subscription.
        </div>
      )}

      {subscription.status === SUBSCRIPTION_STATUS.SUSPENDED && (
        <div className="subscription-alert subscription-alert-danger">
          Your subscription has been suspended. Please contact your administrator.
        </div>
      )}

      {subscription.reminders.map((days) => (
        <div
          key={days}
          className={`subscription-alert ${days <= 3 ? "subscription-alert-urgent" : "subscription-alert-warning"}`}
        >
          {reminderMessage(days)}
        </div>
      ))}

      <div className="subscription-summary-grid">
        <div className="subscription-summary-item">
          <span className="subscription-label">Current Plan</span>
          <strong>{subscription.planLabel}</strong>
        </div>
        <div className="subscription-summary-item">
          <span className="subscription-label">Status</span>
          <Badge variant={statusVariant(subscription.status)}>{subscription.statusLabel}</Badge>
        </div>
        <div className="subscription-summary-item">
          <span className="subscription-label">Start Date</span>
          <strong>{formatDate(subscription.startDate)}</strong>
        </div>
        <div className="subscription-summary-item">
          <span className="subscription-label">Expiration Date</span>
          <strong>{formatDate(subscription.expiresAt)}</strong>
        </div>
        <div className="subscription-summary-item">
          <span className="subscription-label">Remaining Days</span>
          <strong className="subscription-remaining">{subscription.remainingDays} Days</strong>
        </div>
        <div className="subscription-summary-item">
          <span className="subscription-label">Last Renewal</span>
          <strong>{formatDate(subscription.lastRenewedAt)}</strong>
        </div>
        {subscription.nextRenewalAt && (
          <div className="subscription-summary-item">
            <span className="subscription-label">Next Renewal</span>
            <strong>{formatDate(subscription.nextRenewalAt)}</strong>
          </div>
        )}
      </div>

      <div className="subscription-progress-section">
        <div className="subscription-progress-header">
          <span className="subscription-label">
            <Clock size={14} /> Time Remaining
          </span>
          <strong>{subscription.remainingDays} Days</strong>
        </div>
        <div className="subscription-progress-track">
          <div
            className={`subscription-progress-fill ${statusDot(subscription.status)}`}
            style={{ width: `${subscription.progressPercent}%` }}
          />
        </div>
        <div className="subscription-progress-meta">
          <span>{formatDate(subscription.startDate)}</span>
          <span>{subscription.progressPercent}%</span>
          <span>{formatDate(subscription.expiresAt)}</span>
        </div>
      </div>
    </Card>
  );
}

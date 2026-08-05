export const SUBSCRIPTION_PLANS = {
  monthly: { id: "monthly", label: "Monthly (1 Month Trial)", months: 1 },
  quarterly: { id: "quarterly", label: "Quarterly (3 Months)", months: 3 },
  half_yearly: { id: "half_yearly", label: "Half-Yearly (6 Months)", months: 6 },
  annual: { id: "annual", label: "Annual (12 Months)", months: 12 },
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
  NONE: "none",
};

export const SUBSCRIPTION_STATUS_LABELS = {
  [SUBSCRIPTION_STATUS.ACTIVE]: "Active",
  [SUBSCRIPTION_STATUS.EXPIRING_SOON]: "Expiring Soon",
  [SUBSCRIPTION_STATUS.EXPIRED]: "Expired",
  [SUBSCRIPTION_STATUS.SUSPENDED]: "Suspended",
  [SUBSCRIPTION_STATUS.NONE]: "No Subscription",
};

export const EXPIRING_SOON_DAYS = 30;
export const REMINDER_THRESHOLDS = [30, 15, 7, 3, 1];

export const SUBSCRIPTION_FILTER_OPTIONS = [
  { id: "all", label: "All Users" },
  { id: SUBSCRIPTION_STATUS.ACTIVE, label: "Active" },
  { id: SUBSCRIPTION_STATUS.EXPIRING_SOON, label: "Expiring Soon" },
  { id: SUBSCRIPTION_STATUS.EXPIRED, label: "Expired" },
  { id: SUBSCRIPTION_STATUS.SUSPENDED, label: "Suspended" },
  { id: SUBSCRIPTION_STATUS.NONE, label: "No Subscription" },
];

function parseIsoDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addMonthsToDate(isoDate, months) {
  const date = parseIsoDate(isoDate);
  date.setMonth(date.getMonth() + Number(months));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(fromIso, toIso) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

export function getPlanMonths(planId) {
  return SUBSCRIPTION_PLANS[planId]?.months ?? 0;
}

export function getPlanLabel(planId) {
  return SUBSCRIPTION_PLANS[planId]?.label ?? planId ?? "—";
}

export function calculateExpirationDate(startDate, planId) {
  const months = getPlanMonths(planId);
  if (!months) throw new Error("Invalid subscription plan");
  return addMonthsToDate(startDate, months);
}

export function computeSubscription(raw, referenceDate = todayISO()) {
  if (!raw) {
    return {
      hasSubscription: false,
      status: SUBSCRIPTION_STATUS.NONE,
      statusLabel: SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.NONE],
      plan: null,
      planLabel: "—",
      startDate: null,
      expiresAt: null,
      lastRenewedAt: null,
      nextRenewalAt: null,
      remainingDays: 0,
      totalDays: 0,
      progressPercent: 0,
      reminders: [],
      isSuspended: false,
      allowsAccess: false,
    };
  }

  const isSuspended = Boolean(raw.is_suspended);
  const startDate = raw.start_date?.slice(0, 10) || null;
  const expiresAt = raw.expires_at?.slice(0, 10) || null;
  const totalDays = startDate && expiresAt ? Math.max(1, daysBetween(startDate, expiresAt)) : 0;
  let remainingDays = expiresAt ? daysBetween(referenceDate, expiresAt) : 0;
  if (remainingDays < 0) remainingDays = 0;

  let status = SUBSCRIPTION_STATUS.ACTIVE;
  if (isSuspended) {
    status = SUBSCRIPTION_STATUS.SUSPENDED;
  } else if (!expiresAt || daysBetween(referenceDate, expiresAt) < 0) {
    status = SUBSCRIPTION_STATUS.EXPIRED;
  } else if (remainingDays <= EXPIRING_SOON_DAYS) {
    status = SUBSCRIPTION_STATUS.EXPIRING_SOON;
  }

  const progressPercent =
    totalDays > 0 ? Math.min(100, Math.max(0, Math.round((remainingDays / totalDays) * 100))) : 0;

  const reminders = isSuspended || status === SUBSCRIPTION_STATUS.EXPIRED
    ? []
    : REMINDER_THRESHOLDS.filter((threshold) => remainingDays > 0 && remainingDays <= threshold);

  const allowsAccess =
    !isSuspended && status !== SUBSCRIPTION_STATUS.EXPIRED && status !== SUBSCRIPTION_STATUS.NONE;

  return {
    hasSubscription: true,
    id: raw.id,
    userId: raw.user_id,
    status,
    statusLabel: SUBSCRIPTION_STATUS_LABELS[status],
    plan: raw.plan,
    planLabel: getPlanLabel(raw.plan),
    startDate,
    expiresAt,
    lastRenewedAt: raw.last_renewed_at?.slice(0, 10) || null,
    nextRenewalAt: raw.next_renewal_at?.slice(0, 10) || expiresAt,
    remainingDays,
    totalDays,
    progressPercent,
    reminders,
    isSuspended,
    allowsAccess,
    suspendedAt: raw.suspended_at?.slice(0, 10) || null,
    raw,
  };
}

export function subscriptionAllowsAppAccess(user, subscriptionView) {
  if (!user) return false;
  if (String(user.role).toLowerCase() === "admin") return true;
  return Boolean(subscriptionView?.allowsAccess);
}

export function getSubscriptionBlockMessage(subscription) {
  if (!subscription?.hasSubscription) {
    return "No active subscription is assigned to your account. Please contact your administrator to renew your subscription.";
  }

  switch (subscription.status) {
    case SUBSCRIPTION_STATUS.EXPIRED:
      return "Your subscription has expired. Please renew your subscription — contact your administrator.";
    case SUBSCRIPTION_STATUS.SUSPENDED:
      return "Your subscription has been suspended. Please contact your administrator to renew your subscription.";
    default:
      return "Your subscription is not active. Please contact your administrator to renew your subscription.";
  }
}

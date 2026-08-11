import { useCallback, useEffect, useState } from "react";
import {
  CalendarPlus,
  PauseCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { subscriptionService } from "../services/SubscriptionService";
import { useAuthStore } from "../contexts/store";
import { usePermissions } from "../hooks/usePermissions";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { ITEMS_PER_PAGE } from "../utils/constants";
import {
  SUBSCRIPTION_FILTER_OPTIONS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  EXTEND_MONTH_OPTIONS,
  todayISO,
  calculateExpirationDate,
  addMonthsToDate,
} from "../utils/subscriptions";
import { formatDate } from "../utils/format";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import Badge from "../components/common/Badge";
import { Card } from "../components/common/Card";
import { Select } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import SubscriptionCard from "../components/subscriptions/SubscriptionCard";
import SubscriptionDatePicker from "../components/subscriptions/SubscriptionDatePicker";
import "./Subscriptions.css";

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

const PLAN_OPTIONS = Object.values(SUBSCRIPTION_PLANS);

const EMPTY_FORM = {
  plan: "monthly",
  startDate: todayISO(),
  endDate: calculateExpirationDate(todayISO(), "monthly"),
  startUseCalendar: false,
  endUseCalendar: false,
  endDateTouched: false,
  extraMonths: "3",
};

export default function Subscriptions() {
  const user = useAuthStore((s) => s.user);
  const { isAdmin } = usePermissions();
  const { submitting, guard } = useSubmitGuard();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState("");
  const [mySubscription, setMySubscription] = useState(null);
  const [myLoading, setMyLoading] = useState(!isAdmin);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("assign");
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, summaryResult] = await Promise.all([
        subscriptionService.getAllWithUsers({
          page,
          limit: ITEMS_PER_PAGE,
          search,
          statusFilter,
        }),
        subscriptionService.getSummary(),
      ]);
      setItems(listResult.items);
      setTotal(listResult.total);
      setSummary(summaryResult);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const loadMine = useCallback(async () => {
    if (!user?.id) return;
    setMyLoading(true);
    try {
      const sub = await subscriptionService.getForUser(user.id);
      setMySubscription(sub);
    } finally {
      setMyLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAdmin) loadAdmin();
    else loadMine();
  }, [isAdmin, loadAdmin, loadMine]);

  function openModal(mode, row) {
    setModalMode(mode);
    setSelectedUser(row);
    const plan = row.subscription?.plan || "monthly";
    const existingStart = row.subscription?.startDate || todayISO();
    const existingEnd =
      row.subscription?.expiresAt || calculateExpirationDate(existingStart, plan);
    setForm({
      plan,
      startDate: existingStart,
      endDate: existingEnd,
      startUseCalendar: false,
      endUseCalendar: false,
      endDateTouched: Boolean(row.subscription?.expiresAt),
      extraMonths: "3",
    });
    setModalOpen(true);
  }

  function updatePlan(plan) {
    setForm((prev) => ({
      ...prev,
      plan,
      endDate: prev.endDateTouched ? prev.endDate : calculateExpirationDate(prev.startDate, plan),
    }));
  }

  function updateStartDate(startDate) {
    setForm((prev) => ({
      ...prev,
      startDate,
      endDate: prev.endDateTouched ? prev.endDate : calculateExpirationDate(startDate, prev.plan),
    }));
  }

  function updateEndDate(endDate) {
    setForm((prev) => ({ ...prev, endDate, endDateTouched: true }));
  }

  function previewExpiryDate() {
    try {
      if (modalMode === "extend") {
        const baseDate = selectedUser?.subscription?.expiresAt || todayISO();
        return addMonthsToDate(baseDate, Number(form.extraMonths) || 0);
      }
      if (modalMode === "renew") {
        const today = todayISO();
        const currentExpiry = selectedUser?.subscription?.expiresAt;
        const baseDate =
          currentExpiry && daysBetweenSafe(today, currentExpiry) >= 0 ? currentExpiry : today;
        return addMonthsToDate(baseDate, SUBSCRIPTION_PLANS[form.plan]?.months ?? 1);
      }
      return calculateExpirationDate(form.startDate, form.plan);
    } catch {
      return null;
    }
  }

  function daysBetweenSafe(fromIso, toIso) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return Math.round((to - from) / 86400000);
  }

  async function runAction(action) {
    if (!selectedUser) return;
    setAlert("");
    if (
      (action === "assign" || action === "update") &&
      daysBetweenSafe(form.startDate, form.endDate) < 0
    ) {
      setAlert("End date must be on or after the start date");
      return;
    }
    try {
      await guard(async () => {
        switch (action) {
          case "assign":
            await subscriptionService.assign({
              userId: selectedUser.id,
              plan: form.plan,
              startDate: form.startDate,
              expiresAt: form.endDate,
            });
            break;
          case "renew":
            await subscriptionService.renew(selectedUser.id, form.plan);
            break;
          case "extend":
            await subscriptionService.extend(selectedUser.id, Number(form.extraMonths));
            break;
          case "update":
            await subscriptionService.changePlan(selectedUser.id, form.plan, {
              startDate: form.startDate,
              expiresAt: form.endDate,
            });
            break;
          case "suspend":
            await subscriptionService.suspend(selectedUser.id);
            break;
          case "reactivate":
            await subscriptionService.reactivate(selectedUser.id);
            break;
          default:
            break;
        }
        setModalOpen(false);
        setAlert("Subscription updated successfully");
        loadAdmin();
      });
    } catch (err) {
      setAlert(err.message || "Action failed");
    }
  }

  async function handleQuickAction(row, action) {
    setSelectedUser(row);
    if (action === "suspend" || action === "reactivate") {
      if (!confirm(`${action === "suspend" ? "Suspend" : "Reactivate"} subscription for ${row.username}?`)) {
        return;
      }
      setAlert("");
      try {
        await guard(async () => {
          if (action === "suspend") await subscriptionService.suspend(row.id);
          else await subscriptionService.reactivate(row.id);
          setAlert("Subscription updated successfully");
          loadAdmin();
        });
      } catch (err) {
        setAlert(err.message || "Action failed");
      }
      return;
    }
    openModal(action, row);
  }

  const modalTitle = {
    assign: "Start Subscription",
    update: "Update Subscription",
    renew: "Renew Subscription",
    extend: "Extend Subscription",
  }[modalMode];

  const modalSaveLabel = {
    assign: "Start Subscription",
    update: "Save Changes",
    renew: "Renew Now",
    extend: "Extend Subscription",
  }[modalMode];

  const expiryPreview = previewExpiryDate();

  const columns = [
    { key: "username", label: "Username" },
    { key: "full_name", label: "Full Name", render: (r) => r.full_name || "—" },
    {
      key: "plan",
      label: "Plan",
      render: (r) => r.subscription?.planLabel || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge variant={statusVariant(r.subscription?.status)}>
          {r.subscription?.statusLabel || "—"}
        </Badge>
      ),
    },
    {
      key: "expires_at",
      label: "Expires",
      render: (r) => formatDate(r.subscription?.expiresAt) || "—",
    },
    {
      key: "remaining",
      label: "Remaining",
      render: (r) =>
        r.subscription?.hasSubscription ? `${r.subscription.remainingDays} days` : "—",
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const sub = row.subscription;
        const hasSub = sub?.hasSubscription;
        const suspended = sub?.isSuspended;

        return (
          <div className="table-actions subscription-actions">
            {!hasSub ? (
              <Button variant="ghost" size="sm" title="Create subscription" onClick={() => handleQuickAction(row, "assign")}>
                <UserPlus size={16} />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" title="Update subscription" onClick={() => handleQuickAction(row, "update")}>
                  <Pencil size={16} />
                </Button>
                <Button variant="ghost" size="sm" title="Renew" onClick={() => handleQuickAction(row, "renew")}>
                  <RefreshCw size={16} />
                </Button>
                <Button variant="ghost" size="sm" title="Extend" onClick={() => handleQuickAction(row, "extend")}>
                  <CalendarPlus size={16} />
                </Button>
                {suspended ? (
                  <Button variant="ghost" size="sm" title="Reactivate" onClick={() => handleQuickAction(row, "reactivate")}>
                    <PlayCircle size={16} />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" title="Suspend" onClick={() => handleQuickAction(row, "suspend")}>
                    <PauseCircle size={16} />
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          title="My Subscription"
          subtitle="View your current plan, expiration date, and renewal status."
        />
        {myLoading ? (
          <LoadingSpinner />
        ) : (
          <SubscriptionCard subscription={mySubscription} user={user} />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage cashier subscription plans, renewals, and access."
      />

      {alert && <Alert type={alert.includes("failed") ? "error" : "success"}>{alert}</Alert>}

      {summary && (
        <div className="subscription-summary-grid">
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">Total Users</span>
            <strong>{summary.total}</strong>
          </Card>
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">Active</span>
            <strong className="text-success">{summary.active}</strong>
          </Card>
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">Expiring Soon</span>
            <strong className="text-warning">{summary.expiringSoon}</strong>
          </Card>
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">Expired</span>
            <strong className="text-danger">{summary.expired}</strong>
          </Card>
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">Suspended</span>
            <strong>{summary.suspended}</strong>
          </Card>
          <Card className="subscription-summary-card">
            <span className="subscription-summary-label">No Subscription</span>
            <strong>{summary.none}</strong>
          </Card>
        </div>
      )}

      <div className="subscription-filters">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search users..."
        />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
        >
          {SUBSCRIPTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Table columns={columns} data={items} emptyMessage="No users found" />
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={modalTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => runAction(modalMode)} disabled={submitting}>
              {submitting ? "Saving..." : modalSaveLabel}
            </Button>
          </>
        }
      >
        <p className="subscription-modal-user">
          User: <strong>{selectedUser?.username}</strong>
          {selectedUser?.full_name ? ` (${selectedUser.full_name})` : ""}
        </p>

        {(modalMode === "assign" || modalMode === "update" || modalMode === "renew") && (
          <>
            <Select
              label="Plan"
              value={form.plan}
              onChange={(e) => updatePlan(e.target.value)}
            >
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.label}</option>
              ))}
            </Select>

            {(modalMode === "assign" || modalMode === "update") && (
              <div className="subscription-date-sections">
                <SubscriptionDatePicker
                  label="Start date"
                  value={form.startDate}
                  useCalendar={form.startUseCalendar}
                  onChange={updateStartDate}
                  onModeChange={(useCalendar) =>
                    setForm((prev) => ({ ...prev, startUseCalendar: useCalendar }))
                  }
                />
                <SubscriptionDatePicker
                  label="End date"
                  value={form.endDate}
                  useCalendar={form.endUseCalendar}
                  onChange={updateEndDate}
                  onModeChange={(useCalendar) =>
                    setForm((prev) => ({ ...prev, endUseCalendar: useCalendar }))
                  }
                />
                {!form.endDateTouched && (
                  <p className="subscription-modal-note">
                    End date updates automatically from the plan until you change it.
                  </p>
                )}
              </div>
            )}

            {modalMode === "renew" && selectedUser?.subscription?.expiresAt && (
              <p className="subscription-modal-note">
                Renews from {formatDate(selectedUser.subscription.expiresAt)} if still active, otherwise from today.
              </p>
            )}
          </>
        )}

        {modalMode === "extend" && (
          <Select
            label="Extend by"
            value={form.extraMonths}
            onChange={(e) => setForm({ ...form, extraMonths: e.target.value })}
          >
            {EXTEND_MONTH_OPTIONS.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.label}</option>
            ))}
          </Select>
        )}

        {(modalMode === "extend" || modalMode === "renew") && expiryPreview && (
          <div className="subscription-expiry-preview">
            <span>{modalMode === "extend" ? "New end date" : "Expires on"}</span>
            <strong>{formatDate(expiryPreview)}</strong>
          </div>
        )}

        {(modalMode === "assign" || modalMode === "update") && (
          <div className="subscription-expiry-preview">
            <span>Subscription period</span>
            <strong>
              {formatDate(form.startDate)} → {formatDate(form.endDate)}
            </strong>
          </div>
        )}
      </Modal>
    </div>
  );
}

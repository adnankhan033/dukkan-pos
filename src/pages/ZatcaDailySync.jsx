import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  CloudUpload,
  History,
  Loader2,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { zatcaService } from "../services/ZatcaService";
import { zatcaSyncService } from "../zatca/sync/ZatcaSyncService";
import { resolveActivePhase, buildSyncEnabledSettings } from "../zatca/core/config";
import { ZATCA_QUEUE_STATUS, ZATCA_PHASES, ZATCA_SYNC_SETTINGS } from "../zatca/core/constants";
import { useSettingsStore } from "../contexts/store";
import { getBusinessDateISO } from "../utils/businessDate";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card, StatCard } from "../components/common/Card";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import ZatcaSyncInvoiceCard, { filterSyncItems } from "../components/zatca/ZatcaSyncInvoiceCard";
import "./ZatcaDailySync.css";

const VIEW_TABS = [
  { id: "outstanding", label: "Needs sync" },
  { id: "today", label: "Today" },
  { id: "all", label: "All records" },
];

const STATUS_FILTERS = [
  { id: "all", label: "All statuses" },
  { id: "action", label: "Unsynced only" },
  { id: ZATCA_QUEUE_STATUS.PENDING, label: "Pending" },
  { id: ZATCA_QUEUE_STATUS.FAILED, label: "Failed" },
  { id: ZATCA_QUEUE_STATUS.SYNCED, label: "Synced" },
];

export default function ZatcaDailySync() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const syncSettings = useMemo(() => buildSyncEnabledSettings(settings), [settings]);
  const activePhase = resolveActivePhase(settings);
  const businessDate = useMemo(() => getBusinessDateISO(settings), [settings]);
  const autoSyncOn = settings[ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED] === "1";

  const [pageData, setPageData] = useState(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncingIds, setSyncingIds] = useState([]);
  const [view, setView] = useState("outstanding");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, queueStats] = await Promise.all([
        zatcaService.getSyncPageDashboard(businessDate),
        zatcaService.getQueueStats(),
      ]);
      setPageData(data);
      setOnline(Boolean(queueStats?.online));
    } catch (err) {
      setError(err.message || "Failed to load sync data.");
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = zatcaService.subscribeSyncEvents(load);
    return unsubscribe;
  }, [load]);

  const viewItems = useMemo(() => {
    if (!pageData) return [];
    if (view === "outstanding") return pageData.outstanding.items;
    if (view === "today") return pageData.today.items;
    return pageData.allItems;
  }, [pageData, view]);

  const filteredItems = useMemo(
    () => filterSyncItems(viewItems, statusFilter),
    [viewItems, statusFilter]
  );

  const lineItemsBySaleId = pageData?.lineItemsBySaleId ?? {};
  const outstandingIds = useMemo(
    () => (pageData?.outstanding.items ?? []).map((item) => item.id),
    [pageData]
  );
  const todayActionIds = useMemo(
    () =>
      (pageData?.today.items ?? [])
        .filter((item) => item.status !== ZATCA_QUEUE_STATUS.SYNCED)
        .map((item) => item.id),
    [pageData]
  );

  async function syncRow(id) {
    setSyncingIds((prev) => [...prev, id]);
    setBusy(true);
    setMessage("");
    setError("");
    try {
      zatcaSyncService.setOfflineSimulation(false);
      const result = await zatcaService.syncInvoiceById(id, syncSettings, { force: true });
      if (result.success) {
        setMessage(`Synced — ${result.saleNumber || id}`);
      } else if (!result.skipped) {
        setError(result.error || "Sync failed.");
      }
      await load();
    } catch (err) {
      setError(err.message || "Sync failed.");
    } finally {
      setSyncingIds((prev) => prev.filter((rowId) => rowId !== id));
      setBusy(false);
    }
  }

  async function syncIds(ids, label) {
    if (!ids.length) {
      setMessage(`Nothing to sync in ${label}.`);
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      zatcaSyncService.setOfflineSimulation(false);
      const result = await zatcaService.syncSelected(ids, syncSettings);
      if (result.success) {
        setMessage(
          `Synced ${result.synced ?? 0} of ${ids.length} invoice(s).${result.failed ? ` ${result.failed} failed.` : ""}`
        );
      } else {
        setError(result.error || "Sync failed.");
      }
      await load();
    } catch (err) {
      setError(err.message || "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  if (activePhase !== ZATCA_PHASES.PHASE2) {
    return (
      <div className="zatca-daily-page">
        <PageHeader title="ZATCA Sync" subtitle="Phase 2 is not enabled." />
        <Alert>Enable ZATCA Phase 2 in Settings to queue invoices after each sale.</Alert>
      </div>
    );
  }

  const global = pageData?.global ?? {};
  const todayStats = pageData?.today?.stats ?? {};
  const outstandingCount = pageData?.outstanding?.count ?? 0;

  return (
    <div className="zatca-daily-page">
      <PageHeader
        title="ZATCA Sync"
        subtitle="Sales are saved locally first. Sync to ZATCA manually when you are ready (Settings → disable auto-sync)."
        actions={
          <div className="zatca-daily-actions">
            <Button variant="secondary" onClick={load} disabled={loading || busy}>
              <RefreshCw size={16} /> Refresh
            </Button>
            {outstandingIds.length > 0 && (
              <Button onClick={() => syncIds(outstandingIds, "outstanding")} disabled={busy}>
                <Send size={16} /> Sync all waiting ({outstandingIds.length})
              </Button>
            )}
            {todayActionIds.length > 0 && view === "today" && (
              <Button variant="secondary" onClick={() => syncIds(todayActionIds, "today")} disabled={busy}>
                <Send size={16} /> Sync today ({todayActionIds.length})
              </Button>
            )}
          </div>
        }
      />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      {!autoSyncOn && (
        <Alert type="success">
          Manual sync mode — invoices stay in the queue until you press Sync. Enable auto-sync in Settings → ZATCA if needed.
        </Alert>
      )}

      {outstandingCount > 0 && view !== "outstanding" && (
        <Alert type="warning">
          {outstandingCount} invoice(s) from previous day(s) still need sync.{" "}
          <button type="button" className="zatca-daily-link-btn" onClick={() => setView("outstanding")}>
            View waiting invoices →
          </button>
        </Alert>
      )}

      <div className="zatca-daily-stats">
        <StatCard
          label="Waiting to sync"
          value={String(global.needsAction ?? 0)}
          icon={Clock}
          variant={global.needsAction ? "warning" : "success"}
        />
        <StatCard label="Today" value={String(todayStats.total ?? 0)} icon={CloudUpload} variant="primary" />
        <StatCard label="Synced (all)" value={String(global.synced ?? 0)} icon={CheckCircle2} variant="success" />
        <StatCard label="Failed (all)" value={String(global.failed ?? 0)} icon={XCircle} variant="danger" />
      </div>

      <Card className="zatca-daily-toolbar">
        <div className="zatca-daily-view-tabs">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`zatca-daily-view-tab ${view === tab.id ? "active" : ""}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
              {tab.id === "outstanding" && outstandingCount > 0 && (
                <span className="zatca-daily-tab-count">{outstandingCount}</span>
              )}
              {tab.id === "today" && todayStats.total > 0 && (
                <span className="zatca-daily-tab-count">{todayStats.total}</span>
              )}
            </button>
          ))}
        </div>
        <div className="zatca-daily-filters">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`zatca-daily-filter ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="zatca-daily-online">
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? "Online" : "Offline — queue saved locally"}
          <span className="zatca-daily-worker">
            · {autoSyncOn ? "Auto-sync on" : "Manual sync only"}
            {autoSyncOn && zatcaSyncService.isRunning ? " · Worker running" : ""}
          </span>
          <span className="zatca-daily-business-date">
            <History size={12} /> Business date: {businessDate}
          </span>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner message="Loading invoices..." />
      ) : filteredItems.length === 0 ? (
        <Card>
          <p className="zatca-daily-empty">
            {view === "outstanding"
              ? "No invoices waiting — all caught up."
              : view === "today"
                ? `No ZATCA invoices for ${businessDate}. Complete a sale on POS to queue one.`
                : "No invoices match this filter."}
          </p>
        </Card>
      ) : (
        <ul className="zatca-daily-list">
          {filteredItems.map((row) => (
            <ZatcaSyncInvoiceCard
              key={row.id}
              row={row}
              lineItems={lineItemsBySaleId[row.sale_id] || []}
              currency={currency}
              businessDate={businessDate}
              isSyncing={syncingIds.includes(row.id) || row.status === ZATCA_QUEUE_STATUS.SENDING}
              busy={busy}
              onSync={syncRow}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

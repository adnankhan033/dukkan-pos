import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  CloudUpload,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { zatcaService } from "../services/ZatcaService";
import { zatcaSyncService } from "../zatca/sync/ZatcaSyncService";
import { buildSyncEnabledSettings } from "../zatca/core/config";
import { useSettingsStore } from "../contexts/store";
import {
  ZATCA_QUEUE_STATUS,
  ZATCA_QUEUE_STATUS_LABELS,
  ZATCA_PHASES,
  ZATCA_SYNC_INTERVAL_MS,
} from "../zatca/core/constants";
import { resolveActivePhase } from "../zatca/ZatcaServiceFactory";
import { formatRetryWait } from "../zatca/sync/retryBackoff";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatDateTime } from "../utils/format";
import "./ZatcaQueue.css";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: ZATCA_QUEUE_STATUS.PENDING, label: "Pending" },
  { id: ZATCA_QUEUE_STATUS.SENDING, label: "Sending" },
  { id: ZATCA_QUEUE_STATUS.SYNCED, label: "Synced" },
  { id: ZATCA_QUEUE_STATUS.FAILED, label: "Failed" },
];

function statusIcon(status) {
  switch (status) {
    case ZATCA_QUEUE_STATUS.SYNCED:
      return <CheckCircle2 size={18} className="zatca-queue-icon synced" />;
    case ZATCA_QUEUE_STATUS.FAILED:
      return <XCircle size={18} className="zatca-queue-icon failed" />;
    case ZATCA_QUEUE_STATUS.SENDING:
      return <Loader2 size={18} className="zatca-queue-icon sending spin" />;
    default:
      return <Clock size={18} className="zatca-queue-icon pending" />;
  }
}

function statusBadge(status) {
  switch (status) {
    case ZATCA_QUEUE_STATUS.SYNCED:
      return <Badge variant="success">{ZATCA_QUEUE_STATUS_LABELS[status]}</Badge>;
    case ZATCA_QUEUE_STATUS.FAILED:
      return <Badge variant="danger">{ZATCA_QUEUE_STATUS_LABELS[status]}</Badge>;
    case ZATCA_QUEUE_STATUS.SENDING:
      return <Badge variant="info">{ZATCA_QUEUE_STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge variant="warning">{ZATCA_QUEUE_STATUS_LABELS[status] || status}</Badge>;
  }
}

export default function ZatcaQueue() {
  const settings = useSettingsStore((s) => s.settings);
  const syncSettings = useMemo(() => buildSyncEnabledSettings(settings), [settings]);
  const activePhase = resolveActivePhase(settings);

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncingIds, setSyncingIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [queueItems, queueStats] = await Promise.all([
        zatcaService.getQueueItems({
          status: statusFilter === "all" ? null : statusFilter,
        }),
        zatcaService.getQueueStats(),
      ]);
      setItems(queueItems);
      setStats(queueStats);
      setSelectedIds((prev) => prev.filter((id) => queueItems.some((item) => item.id === id)));
    } catch (err) {
      setError(err.message || "Failed to load ZATCA queue.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const unsubscribe = zatcaService.subscribeSyncEvents(() => {
      loadQueue();
    });
    return unsubscribe;
  }, [loadQueue]);

  const selectableIds = useMemo(
    () =>
      items
        .filter((item) => item.status !== ZATCA_QUEUE_STATUS.SYNCED)
        .map((item) => item.id),
    [items]
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : [...selectableIds]);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  async function runAction(action) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await action();
      if (result?.error && result.success === false) {
        setError(result.error);
      } else if (result?.message) {
        setMessage(result.message);
      } else if (result?.success !== false) {
        const synced = result?.synced ?? 0;
        const failed = result?.failed ?? 0;
        if (result?.total != null) {
          setMessage(`Sync finished — ${synced} synced, ${failed} failed.`);
        } else {
          setMessage("Queue updated.");
        }
      }
      await loadQueue();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function syncOneRow(rowId, saleNumber) {
    setSyncingIds((prev) => [...prev, rowId]);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      zatcaSyncService.setOfflineSimulation(false);
      const result = await zatcaSyncService.syncInvoiceById(rowId, syncSettings, { force: true });
      if (result.success) {
        setMessage(`${saleNumber} synced with ZATCA successfully.`);
      } else {
        setError(result.error || `${saleNumber} sync failed.`);
      }
      await loadQueue();
    } catch (err) {
      setError(err.message || "Sync failed.");
    } finally {
      setSyncingIds((prev) => prev.filter((id) => id !== rowId));
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleSelectAll}
          aria-label="Select all invoices"
        />
      ),
      stopPropagation: true,
      render: (row) =>
        row.status === ZATCA_QUEUE_STATUS.SYNCED ? null : (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            onChange={() => toggleSelect(row.id)}
            aria-label={`Select ${row.sale_number}`}
          />
        ),
    },
    { key: "sale_number", label: "Invoice #" },
    {
      key: "customer_name",
      label: "Customer",
      render: (row) => row.customer_name || "Walk-in",
    },
    {
      key: "sale_date",
      label: "Date",
      render: (row) => formatDateTime(row.sale_date || row.created_at),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => statusBadge(row.status),
    },
    {
      key: "synced_at",
      label: "Synced at",
      render: (row) => (row.synced_at ? formatDateTime(row.synced_at) : "—"),
    },
    {
      key: "retry_count",
      label: "Retries",
      render: (row) => row.retry_count ?? 0,
    },
    {
      key: "next_retry",
      label: "Retry after",
      render: (row) => formatRetryWait(row.next_retry_at) || "—",
    },
    {
      key: "actions",
      label: "Action",
      stopPropagation: true,
      render: (row) =>
        row.status !== ZATCA_QUEUE_STATUS.SYNCED ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || syncingIds.includes(row.id)}
            onClick={() => syncOneRow(row.id, row.sale_number)}
          >
            <Send size={14} /> Sync
          </Button>
        ) : (
          "—"
        ),
    },
    {
      key: "error_message",
      label: "Error",
      render: (row) => (
        <span className="zatca-queue-error" title={row.error_message || ""}>
          {row.error_message || "—"}
        </span>
      ),
    },
  ];

  if (activePhase !== ZATCA_PHASES.PHASE2) {
    return (
      <div>
        <PageHeader
          title="ZATCA Queue"
          subtitle="Offline invoice queue and synchronization for Phase 2."
        />
        <Alert>
          ZATCA Phase 2 is not active. Enable Phase 2 in{" "}
          <Link to="/settings">Settings → ZATCA</Link> to queue and sync invoices automatically.
        </Alert>
      </div>
    );
  }

  return (
    <div className="zatca-queue-page">
      <PageHeader
        title="ZATCA Invoice Queue"
        subtitle="Offline-first: every sale is saved locally, then synced to ZATCA automatically when online."
        actions={
          <div className="zatca-queue-actions">
            <Button
              variant="secondary"
              onClick={() => runAction(() => loadQueue())}
              disabled={busy}
            >
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction(() => zatcaService.retryFailed(selectedIds.length ? selectedIds : null, settings))
              }
              disabled={busy}
            >
              <RotateCcw size={16} /> Retry Failed
            </Button>
            <Button
              variant="secondary"
              onClick={() => runAction(() => zatcaService.syncSelected(selectedIds, settings))}
              disabled={busy || selectedIds.length === 0}
            >
              <Send size={16} /> Sync Selected
            </Button>
            <Button onClick={() => runAction(() => zatcaService.syncAll(settings))} disabled={busy}>
              <CloudUpload size={16} /> Sync All
            </Button>
          </div>
        }
      />

      <Alert type="info">
        <strong>How it works:</strong> Sale → saved locally → queued as Pending → background worker
        (every {Math.round(ZATCA_SYNC_INTERVAL_MS / 1000)}s) sends to ZATCA when internet is back.
        Failed invoices retry automatically after 1 → 5 → 15 → 30 → 60 minutes.
      </Alert>

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <div className="zatca-queue-stats">
        <StatCard label="Pending" value={stats?.pending ?? 0} icon={Clock} variant="warning" />
        <StatCard label="Synced" value={stats?.synced ?? 0} icon={CheckCircle2} variant="success" />
        <StatCard label="Failed" value={stats?.failed ?? 0} icon={XCircle} variant="danger" />
        <StatCard
          label="Internet"
          value={stats?.online ? "Online" : "Offline"}
          icon={stats?.online ? Wifi : WifiOff}
          variant={stats?.online ? "success" : "warning"}
        />
      </div>

      <Card>
        <div className="zatca-queue-meta">
          <span>
            Last sync: {stats?.lastSyncAt ? formatDateTime(stats.lastSyncAt) : "Never"} · Auto-sync:{" "}
            {zatcaSyncService.isRunning ? "On" : "Off"}
          </span>
          <div className="zatca-queue-filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`zatca-queue-filter ${statusFilter === filter.id ? "active" : ""}`}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading queue..." />
        ) : items.length === 0 ? (
          <p className="zatca-queue-empty">
            No invoices in queue yet. Complete a Phase 2 sale — it will appear here as Pending.
          </p>
        ) : (
          <>
            <ul className="zatca-queue-cards">
              {items.slice(0, 12).map((row) => (
                <li key={row.id} className={`zatca-queue-card status-${row.status}`}>
                  {statusIcon(row.status)}
                  <div className="zatca-queue-card-body">
                    <strong>Invoice #{row.sale_number}</strong>
                    <span>{ZATCA_QUEUE_STATUS_LABELS[row.status] || row.status}</span>
                    {row.synced_at && (
                      <small>Synced {formatDateTime(row.synced_at)}</small>
                    )}
                    {row.status === ZATCA_QUEUE_STATUS.FAILED && row.error_message && (
                      <small className="zatca-queue-card-error">{row.error_message}</small>
                    )}
                    {row.status === ZATCA_QUEUE_STATUS.FAILED && row.next_retry_at && (
                      <small>Auto-retry in {formatRetryWait(row.next_retry_at)}</small>
                    )}
                  </div>
                  {row.status !== ZATCA_QUEUE_STATUS.SYNCED && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || syncingIds.includes(row.id)}
                      onClick={() => syncOneRow(row.id, row.sale_number)}
                    >
                      Sync
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Table columns={columns} data={items} keyField="id" />
          </>
        )}
      </Card>
    </div>
  );
}

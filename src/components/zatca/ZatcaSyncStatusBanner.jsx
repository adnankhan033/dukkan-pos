import Badge from "../common/Badge";
import { Alert } from "../common/Loading";
import { formatDateTime } from "../../utils/format";
import { ZATCA_ENVIRONMENT_LABELS } from "../../zatca/core/constants";

function envBadgeVariant(context) {
  if (context?.isSimulation) return "warning";
  if (context?.isSandbox) return "info";
  if (context?.isProduction) return "success";
  return "secondary";
}

export default function ZatcaSyncStatusBanner({ context, queueStats, lastSyncAt }) {
  if (!context) return null;

  const envLabel =
    context.environmentLabel ||
    ZATCA_ENVIRONMENT_LABELS[context.environment] ||
    context.environment ||
    "—";

  return (
    <div className="zatca-sync-status-banner">
      <div className="zatca-sync-status-head">
        <Badge variant={envBadgeVariant(context)}>{envLabel}</Badge>
        {context.isSandbox && (
          <Badge variant="info">Sends to ZATCA Sandbox</Badge>
        )}
        {context.isProduction && (
          <Badge variant="success">Sends to ZATCA Production</Badge>
        )}
        {context.isSimulation && (
          <Badge variant="warning">Local only — no ZATCA HTTP</Badge>
        )}
        <Badge variant={context.ready ? "success" : "danger"}>
          {context.ready ? "Ready" : "Not ready"}
        </Badge>
      </div>

      <p className="zatca-sync-status-dest">
        <strong>Destination:</strong> {context.destinationSummary || "—"}
      </p>
      {context.route?.label && (
        <p className="zatca-sync-status-meta">
          <strong>API:</strong> {context.route.label}
          {context.targetApiPath ? ` · ${context.targetApiPath}` : ""}
        </p>
      )}
      {context.targetApiUrl && (
        <p className="zatca-sync-status-url">
          <code>{context.targetApiUrl}</code>
        </p>
      )}

      <Alert type={context.ready ? "success" : "error"}>{context.message}</Alert>

      {(queueStats || lastSyncAt) && (
        <div className="zatca-sync-status-stats">
          {queueStats && (
            <span>
              Queue: {queueStats.pending ?? 0} pending · {queueStats.synced ?? 0} synced ·{" "}
              {queueStats.failed ?? 0} failed ({queueStats.total ?? 0} total)
            </span>
          )}
          {lastSyncAt && (
            <span>Last sync attempt: {formatDateTime(lastSyncAt)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function SyncActionResultPanel({ result }) {
  if (!result) return null;
  const ok = result.passed ?? result.success;

  return (
    <div className="zatca-sync-action-result">
      <Alert type={ok ? "success" : "error"}>
        <strong>{result.summary}</strong>
        {result.detail && <div className="zatca-sync-action-detail">{result.detail}</div>}
      </Alert>
      {result.results?.length > 0 && (
        <ul className="zatca-test-sync-results">
          {result.results.map((r) => (
            <li key={r.id} className={r.success ? "pass" : r.skipped ? "skip" : "fail"}>
              <span className="zatca-sync-result-main">
                {r.saleNumber || `#${r.id}`} —{" "}
                {r.success
                  ? "Synced"
                  : r.skipped
                    ? `Skipped (${r.error || "max retries"})`
                    : r.error || "Failed"}
                {r.httpStatus ? ` · HTTP ${r.httpStatus}` : ""}
              </span>
              {(r.syncedAt || r.lastAttemptAt) && (
                <span className="zatca-sync-result-dates">
                  {r.lastAttemptAt && `Attempt: ${formatDateTime(r.lastAttemptAt)}`}
                  {r.syncedAt && ` · Synced: ${formatDateTime(r.syncedAt)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

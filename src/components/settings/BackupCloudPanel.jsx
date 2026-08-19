import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudUpload, FolderOpen, Mail, RefreshCw } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { backupService } from "../../services/BackupService";
import { backupSyncService } from "../../services/BackupSyncService";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import {
  BACKUP_SETTING_KEYS,
  DEFAULT_BACKUP_DAILY_TIME,
  backupTypeLabel,
  formatBackupFileSize,
  isBackupEmailEnabled,
} from "../../utils/backupSettings";
import { formatDateTime } from "../../utils/format";
import { APP_SLUG, backupFolderHint } from "../../utils/appIdentity";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { Card } from "../common/Card";
import { Input } from "../common/Input";
import { Alert } from "../common/Loading";
import "./BackupCloudPanel.css";

function statusBadge(status) {
  if (status === "success") return <Badge variant="success">Sent</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function applySettingsToForm(settings) {
  return {
    gmail: settings[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim() || "",
    recipient: settings[BACKUP_SETTING_KEYS.GMAIL_RECIPIENT]?.trim() || "",
    dailyTime: settings[BACKUP_SETTING_KEYS.DAILY_TIME]?.trim() || DEFAULT_BACKUP_DAILY_TIME,
    enabled: isBackupEmailEnabled(settings),
    hasStoredPassword: Boolean(settings[BACKUP_SETTING_KEYS.GMAIL_APP_PASSWORD]),
  };
}

export default function BackupCloudPanel({ busy, onBusyChange, onNotify }) {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const [gmail, setGmail] = useState("");
  const [recipient, setRecipient] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [dailyTime, setDailyTime] = useState(DEFAULT_BACKUP_DAILY_TIME);
  const [enabled, setEnabled] = useState(false);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, successCount: 0, failedCount: 0, lastSuccessAt: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [localFolder, setLocalFolder] = useState("");

  const loadSavedSettings = useCallback(async () => {
    const saved = await settingsService.getAll();
    const form = applySettingsToForm(saved);
    setGmail(form.gmail);
    setRecipient(form.recipient);
    setDailyTime(form.dailyTime);
    setEnabled(form.enabled);
    setHasStoredPassword(form.hasStoredPassword);
    setSettings(saved);
    return saved;
  }, [setSettings]);

  async function refreshHistory() {
    const [nextLogs, nextStats] = await Promise.all([
      backupService.getBackupLogs({ limit: 30 }),
      backupService.getBackupStats(),
    ]);
    setLogs(nextLogs);
    setStats(nextStats);
    return nextStats;
  }

  useEffect(() => {
    loadSavedSettings().catch(() => {
      const form = applySettingsToForm(settings);
      setGmail(form.gmail);
      setRecipient(form.recipient);
      setDailyTime(form.dailyTime);
      setEnabled(form.enabled);
      setHasStoredPassword(form.hasStoredPassword);
    });
    refreshHistory().catch(() => {
      setLogs([]);
      setStats({ total: 0, successCount: 0, failedCount: 0, lastSuccessAt: null });
    });
    backupService.getLocalBackupFolder().then(setLocalFolder).catch(() => setLocalFolder(""));
  }, [loadSavedSettings]);

  useEffect(() => {
    refreshHistory().catch(() => {});
  }, [busy, sending]);

  async function saveCredentials({ passwordOverride = null } = {}) {
    if (!gmail.trim()) return;
    await backupService.saveGmailConfig({
      enabled,
      gmail,
      appPassword: passwordOverride ?? appPassword,
      recipient: recipient || gmail,
      dailyTime,
    });
    await loadSavedSettings();
    if (passwordOverride || appPassword.trim()) {
      setAppPassword("");
    }
  }

  async function handleFieldBlur() {
    if (!gmail.trim()) return;
    try {
      await saveCredentials();
      setMessage("Gmail saved.");
      setError("");
    } catch (err) {
      setError(err.message || "Could not save Gmail.");
    }
  }

  async function handleSendFullBackup() {
    setSending(true);
    onBusyChange?.(true);
    setMessage("");
    setError("");
    try {
      const result = await backupService.syncToGmail({
        enabled,
        gmail,
        appPassword,
        recipient: recipient || gmail,
        dailyTime,
      });

      await loadSavedSettings();
      const nextStats = await refreshHistory();
      backupSyncService.restartBackgroundSync();
      setAppPassword("");
      setMessage(`Full backup sent to ${result.recipient}. Check your Gmail inbox.`);

      onNotify?.({
        title: "Full Backup Sent",
        icon: "success",
        body: (
          <>
            <p>Complete database backup emailed as JSON attachment.</p>
            <ul className="confirm-list">
              <li>Recipient: {result.recipient}</li>
              <li>{result.tableCount} tables · {result.filename}</li>
              <li>Sent: {new Date(result.exported_at).toLocaleString()}</li>
            </ul>
            {nextStats.successCount >= 1 && (
              <p>You can send again anytime to replace with a fresh full backup, or enable daily auto backup below.</p>
            )}
          </>
        ),
      });
    } catch (err) {
      await refreshHistory();
      setError(err.message || "Could not send backup to Gmail.");
      onNotify?.({
        title: "Send Failed",
        icon: "error",
        body: <p>{err.message || "Could not send backup to Gmail."}</p>,
      });
    } finally {
      setSending(false);
      onBusyChange?.(false);
    }
  }

  async function handleDailyToggle(checked) {
    setEnabled(checked);
    if (!gmail.trim()) return;
    try {
      await backupService.saveGmailConfig({
        enabled: checked,
        gmail,
        appPassword,
        recipient: recipient || gmail,
        dailyTime,
      });
      await loadSavedSettings();
      backupSyncService.restartBackgroundSync();
      setMessage(checked ? "Daily automatic backup enabled." : "Daily automatic backup turned off.");
      setError("");
    } catch (err) {
      setError(err.message || "Could not save daily setting.");
      setEnabled(!checked);
    }
  }

  async function handleDailyTimeBlur() {
    if (!gmail.trim() || !enabled) return;
    try {
      await saveCredentials();
      setMessage("Daily backup time saved.");
    } catch (err) {
      setError(err.message || "Could not save daily time.");
    }
  }

  async function handleOpenLocalFolder() {
    try {
      const folder = localFolder || (await backupService.getLocalBackupFolder());
      if (!folder) return;
      setLocalFolder(folder);
      await openPath(folder);
    } catch (err) {
      setError(err.message || "Could not open backup folder.");
    }
  }

  const canSend = gmail.trim() && (hasStoredPassword || appPassword.trim());
  const savedEmail = settings[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim();
  const hasSentBefore = stats.successCount > 0;
  const showDailySection = hasSentBefore;

  return (
    <>
      <Card className="settings-card">
        <h3 className="settings-section-title">
          <CloudUpload size={18} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
          Send Full Backup to Gmail
        </h3>
        <p className="settings-section-desc">
          Email a complete copy of your store (products, sales, settings — everything) as one JSON file.
          Click send again anytime to replace with a fresh full backup.
        </p>

        {savedEmail && (
          <div className="backup-cloud-saved">
            <CheckCircle2 size={16} />
            <span>
              Saved Gmail: <strong>{savedEmail}</strong>
              {hasStoredPassword ? " · Password stored" : ""}
            </span>
          </div>
        )}

        <div className="backup-cloud-form">
          <div className="backup-cloud-row">
            <Input
              label="Gmail Address"
              type="email"
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="yourstore@gmail.com"
              required
            />
            <Input
              label="Gmail App Password"
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              onBlur={handleFieldBlur}
              placeholder={hasStoredPassword ? "Saved — enter only to change" : "16 characters (App Password)"}
            />
          </div>

          <Input
            label="Send To (optional)"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Leave empty to send to your Gmail above"
          />

          <div className="backup-cloud-help">
            <strong>Gmail App Password (not your normal password)</strong>
            <ol>
              <li>Google Account → Security → 2-Step Verification ON</li>
              <li>App passwords → Mail → copy 16 characters</li>
            </ol>
          </div>

          {message && <Alert type="success">{message}</Alert>}
          {error && <Alert type="error">{error}</Alert>}

          <div className="backup-cloud-actions">
            <Button
              type="button"
              disabled={busy || sending || !canSend}
              onClick={handleSendFullBackup}
            >
              <Mail size={16} />
              {sending
                ? "Sending full backup…"
                : hasSentBefore
                  ? "Send New Full Backup"
                  : "Send Full Backup to Gmail"}
            </Button>
          </div>
        </div>
      </Card>

      {showDailySection && (
        <Card className="settings-card backup-daily-card">
          <h3 className="settings-section-title">Daily End-of-Day Backup</h3>
          <p className="settings-section-desc">
            When the business day is complete, automatically save a full backup to your computer
            <strong> and </strong>
            send it to Gmail — once per day.
          </p>

          <label className="backup-cloud-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleDailyToggle(e.target.checked)}
            />
            Enable daily backup (local + Gmail)
          </label>

          {enabled && (
            <div className="backup-cloud-row" style={{ marginTop: "0.875rem" }}>
              <Input
                label="End of Day Time"
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                onBlur={handleDailyTimeBlur}
              />
            </div>
          )}

          <div className="backup-local-folder">
            <div>
              <strong>Local backup folder</strong>
              <p>{localFolder || backupFolderHint()}</p>
              <span>Daily files: {APP_SLUG}-daily-YYYY-MM-DD.json</span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleOpenLocalFolder}>
              <FolderOpen size={14} /> Open Folder
            </Button>
          </div>

          <p className="backup-cloud-next">
            {enabled
              ? <>Runs at <strong>{dailyTime}</strong> (store timezone) while the app is open — saves locally first, then Gmail.</>
              : <>Daily backup is off — use the button above to send manually to Gmail.</>}
            {enabled && settings[BACKUP_SETTING_KEYS.LAST_AUTO_DATE] ? (
              <> Last run: <strong>{settings[BACKUP_SETTING_KEYS.LAST_AUTO_DATE]}</strong></>
            ) : null}
          </p>
        </Card>
      )}

      <Card className="settings-card">
        <div className="backup-cloud-grid">
          <div className="backup-cloud-stat">
            <span className="backup-cloud-stat-label">Total Sent</span>
            <span className="backup-cloud-stat-value">{stats.total}</span>
          </div>
          <div className="backup-cloud-stat">
            <span className="backup-cloud-stat-label">Successful</span>
            <span className="backup-cloud-stat-value">{stats.successCount}</span>
          </div>
          <div className="backup-cloud-stat">
            <span className="backup-cloud-stat-label">Failed</span>
            <span className="backup-cloud-stat-value">{stats.failedCount}</span>
          </div>
          <div className="backup-cloud-stat">
            <span className="backup-cloud-stat-label">Last Sent</span>
            <span className="backup-cloud-stat-value" style={{ fontSize: "0.875rem" }}>
              {stats.lastSuccessAt ? formatDateTime(stats.lastSuccessAt) : "—"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
          <div>
            <h3 className="settings-section-title">Backup History</h3>
            <p className="settings-section-desc">
              Every full backup sent to Gmail or downloaded locally.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => refreshHistory()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        <div className="backup-history-table-wrap">
          {logs.length === 0 ? (
            <div className="backup-history-empty">
              No backups yet. Enter Gmail above and click Send Full Backup to Gmail.
            </div>
          ) : (
            <table className="backup-history-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Destination</th>
                  <th>Size</th>
                  <th>Tables</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>{backupTypeLabel(row.backup_type)}</td>
                    <td>{row.destination}</td>
                    <td>{formatBackupFileSize(row.file_size_bytes)}</td>
                    <td>{row.table_count ?? "—"}</td>
                    <td>
                      {statusBadge(row.status)}
                      {row.error_message ? (
                        <div className="backup-history-error" title={row.error_message}>
                          {row.error_message}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}

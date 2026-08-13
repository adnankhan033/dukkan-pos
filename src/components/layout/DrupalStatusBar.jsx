import { Cloud, Monitor } from "lucide-react";
import { useAuthStore, useSettingsStore } from "../../contexts/store";
import { normalizeApiBaseUrl, resolveApiBaseUrl } from "../../api/apiConfig";
import { ROLE_LABELS, normalizeRole } from "../../utils/roles";
import "./DrupalStatusBar.css";

function shortUrl(url) {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) return "";
  try {
    const { hostname } = new URL(normalized);
    return hostname;
  } catch {
    return normalized.slice(0, 32);
  }
}

export default function DrupalStatusBar() {
  const drupalConnected = useAuthStore((s) => s.drupalConnected);
  const user = useAuthStore((s) => s.user);
  const terminal = useAuthStore((s) => s.terminal);
  const settings = useSettingsStore((s) => s.settings);

  if (!drupalConnected) return null;

  const roleLabel = ROLE_LABELS[normalizeRole(user?.role)] || user?.role || "User";
  const host = shortUrl(resolveApiBaseUrl(settings));

  return (
    <div className="drupal-status-bar" role="status" aria-live="polite">
      <div className="drupal-status-main">
        <Cloud size={16} className="drupal-status-icon" aria-hidden />
        <strong>Live from Drupal</strong>
        <span className="drupal-status-sep">·</span>
        <span>
          {user?.full_name || user?.username}
          <span className="drupal-status-muted"> ({roleLabel})</span>
        </span>
        {terminal?.code && (
          <>
            <span className="drupal-status-sep">·</span>
            <span className="drupal-status-terminal">
              <Monitor size={14} aria-hidden />
              {terminal.name || terminal.code}
            </span>
          </>
        )}
      </div>
      <div className="drupal-status-meta">
        {settings.store_name && <span>{settings.store_name}</span>}
        {host && <span className="drupal-status-host">{host}</span>}
      </div>
    </div>
  );
}

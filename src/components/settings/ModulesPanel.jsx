import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Lock,
  Puzzle,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { moduleService, ModuleLifecycleError } from "../../services/ModuleService";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import { usePermissions } from "../../hooks/usePermissions";
import { useConfirm } from "../../hooks/useConfirm";
import { Card } from "../common/Card";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { Alert, LoadingSpinner } from "../common/Loading";
import { notify } from "../../utils/notify";
import { MODULE_LIFECYCLE, MODULE_STATUS } from "../../modules/catalog";
import "./ModulesPanel.css";

function statusBadge(mod) {
  if (mod.status === MODULE_STATUS.ARCHIVED) return { label: "Archived", variant: "neutral" };
  if (!mod.installed) return { label: "Available", variant: "info" };
  if (mod.enabled) return { label: "Enabled", variant: "success" };
  return { label: "Disabled", variant: "warning" };
}

function configBadge(mod) {
  if (!mod.installed) return null;
  if (mod.configured) return { label: "Configured", variant: "success" };
  return { label: "Setup needed", variant: "warning" };
}

export default function ModulesPanel({ onOpenTab }) {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { canPerformAction, isAdmin } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const canInstall = isAdmin || canPerformAction("modules_install");
  const canEnable = isAdmin || canPerformAction("modules_enable");
  const canDisable = isAdmin || canPerformAction("modules_disable");
  const canUninstall = isAdmin || canPerformAction("modules_uninstall");
  const canConfigure = isAdmin || canPerformAction("modules_configure");

  const reload = useCallback(async () => {
    const list = await moduleService.list();
    setModules(list);
    setSettings(await settingsService.getAll());
  }, [setSettings]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (mounted) setError(err.message || "Could not load modules");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reload]);

  const visible = useMemo(() => {
    if (filter === "installed") return modules.filter((mod) => mod.installed);
    if (filter === "available") return modules.filter((mod) => !mod.installed);
    return modules;
  }, [modules, filter]);

  async function runAction(moduleId, action) {
    setBusyId(moduleId);
    setError("");
    try {
      await action();
      await reload();
    } catch (err) {
      const message = err instanceof ModuleLifecycleError ? err.message : err.message || "Module action failed";
      setError(message);
      notify.error(message, { title: "Modules" });
    } finally {
      setBusyId("");
    }
  }

  async function handleInstall(mod) {
    const ok = await confirm({
      title: `Install ${mod.name}?`,
      confirmLabel: "Install",
      cancelLabel: "Cancel",
      variant: "primary",
      children: (
        <div className="modules-confirm">
          <p>
            {mod.name} {mod.version} will be installed. Dependencies:
          </p>
          <ul>
            {mod.dependencies.length
              ? mod.dependencies.map((dep) => (
                  <li key={dep.id}>
                    {dep.name} — {dep.installed ? "installed" : "missing"}
                  </li>
                ))
              : <li>Core</li>}
          </ul>
          <p>If installation fails, it will be rolled back and the module will stay available.</p>
        </div>
      ),
    });
    if (!ok) return;
    await runAction(mod.id, async () => {
      const result = await moduleService.install(mod.id);
      notify.success(`${mod.name} installed.`, { title: "Modules" });
      if (result.configureAfterInstall && result.settingsTab && onOpenTab) {
        onOpenTab(result.settingsTab);
      }
    });
  }

  async function handleEnable(mod) {
    await runAction(mod.id, async () => {
      await moduleService.enable(mod.id);
      notify.success(`${mod.name} enabled.`, { title: "Modules" });
    });
  }

  async function handleDisable(mod) {
    const ok = await confirm({
      title: `Disable ${mod.name}?`,
      confirmLabel: "Disable",
      cancelLabel: "Cancel",
      variant: "danger",
      children: (
        <div className="modules-confirm">
          <p>Navigation and module operations will be hidden. Existing data and tables are kept.</p>
        </div>
      ),
    });
    if (!ok) return;
    await runAction(mod.id, async () => {
      await moduleService.disable(mod.id);
      notify.success(`${mod.name} disabled. Data was kept.`, { title: "Modules" });
    });
  }

  async function handleUninstall(mod) {
    const preview = await moduleService.getUninstallPreview(mod.id);
    if (preview.preferArchive || !preview.uninstallable) {
      const message =
        preview.blockedReason ||
        `Cannot uninstall ${preview.name}. Archive / Disable it instead of deleting financial data.`;
      setError(message);
      notify.error(message, { title: "Cannot uninstall" });
      return;
    }

    const ok = await confirm({
      title: `Uninstall ${preview.name}?`,
      confirmLabel: "Uninstall",
      cancelLabel: "Cancel",
      variant: "danger",
      children: (
        <div className="modules-confirm">
          <p>
            {preview.name} {preview.version} will be archived. Tables and records stay on disk; the module is removed
            from the live application.
          </p>
          <ul>
            <li>Dependencies: {preview.dependencies.join(", ") || "Core"}</li>
            <li>Stored rows: {preview.totalRecords.toLocaleString()}</li>
          </ul>
        </div>
      ),
    });
    if (!ok) return;
    await runAction(mod.id, async () => {
      await moduleService.uninstall(mod.id);
      notify.success(`${mod.name} uninstalled. Data was archived, not deleted.`, { title: "Modules" });
    });
  }

  if (loading) {
    return (
      <Card className="settings-card">
        <LoadingSpinner />
      </Card>
    );
  }

  return (
    <div className="modules-panel">
      {confirmDialog}
      <Card className="settings-card modules-hero">
        <Puzzle size={22} />
        <div>
          <h3 className="settings-section-title">Modules / Applications</h3>
          <p className="settings-section-desc">
            Install, configure, and enable ERP modules without replacing the existing POS. Disabling a module hides it
            and stops new operations; it never deletes historical data.
          </p>
        </div>
      </Card>

      {error ? (
        <Alert type="error" title="Module manager" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <div className="modules-filters">
        {[
          { id: "all", label: "All" },
          { id: "installed", label: "Installed" },
          { id: "available", label: "Available" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`modules-filter ${filter === item.id ? "active" : ""}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="modules-grid">
        {visible.map((mod) => {
          const status = statusBadge(mod);
          const config = configBadge(mod);
          const busy = busyId === mod.id;
          return (
            <Card key={mod.id} className="settings-card module-card">
              <div className="module-card-head">
                <div>
                  <h3>{mod.name}</h3>
                  <p className="module-version">Version {mod.version}</p>
                </div>
                <div className="module-badges">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {mod.installed ? <Badge variant="info">Installed</Badge> : null}
                  {config ? <Badge variant={config.variant}>{config.label}</Badge> : null}
                  {mod.lifecycle === MODULE_LIFECYCLE.BUNDLED ? (
                    <Badge variant="neutral">POS</Badge>
                  ) : null}
                  {mod.hasFinancialData ? <Badge variant="warning">Financial</Badge> : null}
                </div>
              </div>
              <p className="settings-section-desc">{mod.description}</p>
              <dl className="module-meta">
                <div>
                  <dt>Dependencies</dt>
                  <dd>{mod.dependencies.length ? mod.dependencies.map((dep) => dep.name).join(", ") : "Core"}</dd>
                </div>
                <div>
                  <dt>Migration</dt>
                  <dd>{mod.migrationStatus}</dd>
                </div>
              </dl>
              {mod.configureAfterInstall ? (
                <p className="module-setup-hint">
                  <TriangleAlert size={14} /> Installed. Complete accounting setup before posting journals.
                </p>
              ) : null}
              {mod.errorMessage ? <p className="module-error">{mod.errorMessage}</p> : null}
              <div className="module-actions">
                {!mod.installed ? (
                  <Button type="button" disabled={busy || !canInstall} onClick={() => handleInstall(mod)}>
                    {busy ? "Installing…" : "Install"}
                  </Button>
                ) : null}
                {mod.installed && !mod.enabled && mod.disableable ? (
                  <Button type="button" disabled={busy || !canEnable} onClick={() => handleEnable(mod)}>
                    Enable
                  </Button>
                ) : null}
                {mod.installed && mod.enabled && mod.disableable ? (
                  <Button type="button" variant="secondary" disabled={busy || !canDisable} onClick={() => handleDisable(mod)}>
                    Disable
                  </Button>
                ) : null}
                {mod.settingsTab && canConfigure ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onOpenTab?.(mod.settingsTab)}
                  >
                    <Settings2 size={14} /> Configure
                  </Button>
                ) : null}
                {mod.installed && mod.uninstallable ? (
                  <Button type="button" variant="danger" disabled={busy || !canUninstall} onClick={() => handleUninstall(mod)}>
                    Uninstall
                  </Button>
                ) : null}
                {mod.installed && !mod.uninstallable && mod.hasFinancialData ? (
                  <span className="module-lock">
                    <Lock size={13} /> Archive / Disable instead of delete
                  </span>
                ) : null}
                {mod.lifecycle === MODULE_LIFECYCLE.BUNDLED ? (
                  <span className="module-lock">
                    <Boxes size={13} /> Bundled with POS
                  </span>
                ) : null}
                {mod.installed && mod.enabled && mod.configured ? (
                  <span className="module-ok">
                    <CheckCircle2 size={13} /> Ready
                  </span>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

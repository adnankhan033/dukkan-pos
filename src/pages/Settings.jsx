import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Download, RotateCcw, Trash2 } from "lucide-react";
import { settingsService } from "../services/SettingsService";
import { backupService } from "../services/BackupService";
import { useSettingsStore, useAuthStore } from "../contexts/store";
import { useConfirm } from "../hooks/useConfirm";
import { MODULES, ADMIN_MODULES, moduleSettingKey, roleModuleSettingKey } from "../utils/modules";
import { ROLES, ROLE_LABELS } from "../utils/roles";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import { Card } from "../components/common/Card";
import { Input, Textarea, Select } from "../components/common/Input";
import { Alert } from "../components/common/Loading";
import "./Settings.css";

const TABS = [
  { id: "store", label: "Store" },
  { id: "receipt", label: "Receipt" },
  { id: "modules", label: "Modules" },
  { id: "dashboard", label: "Dashboard" },
  { id: "backup", label: "Backup" },
];

function settingBool(value) {
  return value !== "0" && value !== "false";
}

function buildFormFromSettings(settings) {
  const form = {
    store_name: settings.store_name || "",
    store_name_ar: settings.store_name_ar || "",
    store_address: settings.store_address || "",
    cr_number: settings.cr_number || "",
    vat_registration: settings.vat_registration || "",
    vat_percent: settings.vat_percent || "15",
    currency: settings.currency || "SAR",
    receipt_footer: settings.receipt_footer || "",
    receipt_footer_ar: settings.receipt_footer_ar || "",
    receipt_show_qr: settingBool(settings.receipt_show_qr),
    receipt_show_bilingual: settingBool(settings.receipt_show_bilingual),
    receipt_show_tax_info: settingBool(settings.receipt_show_tax_info),
    receipt_paper_width: settings.receipt_paper_width || "80",
    receipt_header_note: settings.receipt_header_note || "",
    dashboard_admin_show_profit: settingBool(settings.dashboard_admin_show_profit),
    dashboard_admin_show_purchases: settingBool(settings.dashboard_admin_show_purchases),
    dashboard_cashier_show_recent: settingBool(settings.dashboard_cashier_show_recent),
  };

  for (const mod of MODULES) {
    form[moduleSettingKey(mod.id)] = settingBool(settings[moduleSettingKey(mod.id)]);
  }

  for (const mod of [...MODULES, ...ADMIN_MODULES]) {
    form[roleModuleSettingKey(ROLES.ADMIN, mod.id)] = settingBool(
      settings[roleModuleSettingKey(ROLES.ADMIN, mod.id)] ??
        (mod.id === "users" || mod.id === "settings" ? "1" : "1")
    );
    form[roleModuleSettingKey(ROLES.CASHIER, mod.id)] = settingBool(
      settings[roleModuleSettingKey(ROLES.CASHIER, mod.id)] ??
        (["dashboard", "sales"].includes(mod.id) ? "1" : "0")
    );
  }

  return form;
}

function formToSettings(form) {
  const payload = {
    store_name: form.store_name,
    store_name_ar: form.store_name_ar,
    store_address: form.store_address,
    cr_number: form.cr_number,
    vat_registration: form.vat_registration,
    vat_percent: form.vat_percent,
    currency: form.currency,
    receipt_footer: form.receipt_footer,
    receipt_footer_ar: form.receipt_footer_ar,
    receipt_show_qr: form.receipt_show_qr ? "1" : "0",
    receipt_show_bilingual: form.receipt_show_bilingual ? "1" : "0",
    receipt_show_tax_info: form.receipt_show_tax_info ? "1" : "0",
    receipt_paper_width: form.receipt_paper_width,
    receipt_header_note: form.receipt_header_note,
    dashboard_admin_show_profit: form.dashboard_admin_show_profit ? "1" : "0",
    dashboard_admin_show_purchases: form.dashboard_admin_show_purchases ? "1" : "0",
    dashboard_cashier_show_recent: form.dashboard_cashier_show_recent ? "1" : "0",
  };

  for (const mod of MODULES) {
    const key = moduleSettingKey(mod.id);
    payload[key] = form[key] ? "1" : "0";
  }

  for (const mod of [...MODULES, ...ADMIN_MODULES]) {
    payload[roleModuleSettingKey(ROLES.ADMIN, mod.id)] = form[roleModuleSettingKey(ROLES.ADMIN, mod.id)]
      ? "1"
      : "0";
    payload[roleModuleSettingKey(ROLES.CASHIER, mod.id)] =
      mod.id === "users" || mod.id === "settings"
        ? "0"
        : form[roleModuleSettingKey(ROLES.CASHIER, mod.id)]
          ? "1"
          : "0";
  }

  return payload;
}

export default function Settings() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [tab, setTab] = useState("store");
  const [form, setForm] = useState(() => buildFormFromSettings(settings));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const restoreInputRef = useRef(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const payload = formToSettings(form);
      const updated = await settingsService.updateMany(payload);
      setSettings(updated);
      setMessage("Settings saved successfully");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBackupClick() {
    const ok = await confirm({
      title: "Download Backup",
      size: "lg",
      variant: "primary",
      confirmLabel: "Download Backup",
      cancelLabel: "Cancel",
      children: (
        <>
          <p>Export all store data to a JSON file on your computer.</p>
          <ul className="confirm-list">
            <li>Products, categories, and units</li>
            <li>Sales, orders, purchases, and inventory</li>
            <li>Customers, suppliers, and expenses</li>
            <li>Users and settings</li>
          </ul>
          <div className="confirm-note">Keep this file safe — you can restore it later if needed.</div>
        </>
      ),
    });
    if (!ok) return;

    setBackupBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await backupService.createBackupDownload();
      setFeedbackModal({
        title: "Backup Downloaded",
        icon: "download",
        body: (
          <>
            <p>Your backup was saved successfully.</p>
            <ul className="confirm-list">
              <li>{result.tableCount} data tables exported</li>
              <li>Created: {new Date(result.exported_at).toLocaleString()}</li>
            </ul>
          </>
        ),
      });
    } catch (err) {
      setFeedbackModal({
        title: "Backup Failed",
        icon: "error",
        body: <p>{err.message || "Could not create backup file."}</p>,
      });
    } finally {
      setBackupBusy(false);
    }
  }

  function handleRestoreClick() {
    restoreInputRef.current?.click();
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ok = await confirm({
      title: "Restore Backup",
      size: "lg",
      variant: "danger",
      confirmLabel: "Restore Backup",
      cancelLabel: "Cancel",
      children: (
        <>
          <p>This will replace all current data with the backup file:</p>
          <p className="confirm-file-name">{file.name}</p>
          <ul className="confirm-list">
            <li>All existing products, sales, and records will be overwritten</li>
            <li>Current settings will be replaced</li>
          </ul>
          <div className="confirm-note confirm-note-danger">
            This action cannot be undone unless you have another backup.
          </div>
        </>
      ),
    });
    if (!ok) return;

    setBackupBusy(true);
    setError("");
    setMessage("");
    try {
      const text = await file.text();
      const data = backupService.parseBackupFile(text);
      await backupService.restoreFromBackup(data);
      const updated = await settingsService.getAll();
      setSettings(updated);
      setForm(buildFormFromSettings(updated));
      setFeedbackModal({
        title: "Backup Restored",
        icon: "restore",
        body: (
          <>
            <p>Data from <strong>{file.name}</strong> was restored successfully.</p>
            <div className="confirm-note">
              Refresh the app or navigate to other pages to see updated data.
            </div>
          </>
        ),
      });
    } catch (err) {
      setFeedbackModal({
        title: "Restore Failed",
        icon: "error",
        body: <p>{err.message || "Could not restore backup file."}</p>,
      });
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleClearDataClick() {
    const ok = await confirm({
      title: "Clear All Data",
      size: "lg",
      variant: "danger",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
      children: (
        <>
          <p>Permanently delete all business data from this device:</p>
          <ul className="confirm-list">
            <li>Products, sales, orders, purchases, inventory</li>
            <li>Customers, suppliers, expenses</li>
            <li>Custom settings (store name, VAT, modules)</li>
          </ul>
          <div className="confirm-note confirm-note-danger">
            This cannot be undone. Download a backup first if you need to keep your data.
          </div>
        </>
      ),
    });
    if (!ok) return;

    const finalOk = await confirm({
      title: "Final Confirmation",
      variant: "danger",
      confirmLabel: "Clear Database",
      cancelLabel: "Go Back",
      children: (
        <>
          <p>Are you absolutely sure you want to reset the database?</p>
          <p>Default accounts will be restored:</p>
          <ul className="confirm-list">
            <li>Administrator — <strong>admin</strong> / admin123</li>
            <li>Cashier — <strong>cashier</strong> / cashier123</li>
          </ul>
          <p>You will be signed out and must log in again.</p>
        </>
      ),
    });
    if (!finalOk) return;

    setBackupBusy(true);
    setError("");
    setMessage("");
    try {
      await backupService.clearAllData();
      logout();
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Database cleared successfully. Sign in with admin / admin123 or cashier / cashier123.",
        },
      });
    } catch (err) {
      setBackupBusy(false);
      setFeedbackModal({
        title: "Clear Failed",
        icon: "error",
        body: <p>{err.message || "Could not clear the database."}</p>,
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Store configuration, modules, receipts, dashboards, and backups."
      />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`settings-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {tab === "store" && (
          <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Store Information</h3>
              <Input label="Store Name (English)" value={form.store_name} onChange={(e) => updateField("store_name", e.target.value)} />
              <div style={{ marginTop: "1rem" }}>
                <Input label="Store Name (Arabic)" value={form.store_name_ar} onChange={(e) => updateField("store_name_ar", e.target.value)} dir="rtl" />
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Textarea label="Store Address" value={form.store_address} onChange={(e) => updateField("store_address", e.target.value)} />
              </div>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <Input label="VAT %" type="number" step="0.01" value={form.vat_percent} onChange={(e) => updateField("vat_percent", e.target.value)} />
                <Input label="Currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)} />
              </div>
            </Card>
            <Card className="settings-card">
              <h3 className="settings-section-title">Saudi Arabia — Tax & Compliance</h3>
              <Input label="CR Number" value={form.cr_number} onChange={(e) => updateField("cr_number", e.target.value)} />
              <div style={{ marginTop: "1rem" }}>
                <Input label="VAT Registration Number" value={form.vat_registration} onChange={(e) => updateField("vat_registration", e.target.value)} />
              </div>
            </Card>
          </>
        )}

        {tab === "receipt" && (
          <Card className="settings-card">
            <h3 className="settings-section-title">Receipt Template</h3>
            <div className="settings-check-list">
              <label className="settings-check">
                <input type="checkbox" checked={form.receipt_show_qr} onChange={(e) => updateField("receipt_show_qr", e.target.checked)} />
                Show ZATCA QR code
              </label>
              <label className="settings-check">
                <input type="checkbox" checked={form.receipt_show_bilingual} onChange={(e) => updateField("receipt_show_bilingual", e.target.checked)} />
                Show bilingual product names (EN + AR)
              </label>
              <label className="settings-check">
                <input type="checkbox" checked={form.receipt_show_tax_info} onChange={(e) => updateField("receipt_show_tax_info", e.target.checked)} />
                Show CR & VAT numbers on receipt
              </label>
            </div>
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <Select label="Paper Width" value={form.receipt_paper_width} onChange={(e) => updateField("receipt_paper_width", e.target.value)}>
                <option value="58">58mm</option>
                <option value="80">80mm</option>
              </Select>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Input label="Header Note (optional)" value={form.receipt_header_note} onChange={(e) => updateField("receipt_header_note", e.target.value)} placeholder="e.g. Exchange within 7 days with receipt" />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Textarea label="Footer (English)" value={form.receipt_footer} onChange={(e) => updateField("receipt_footer", e.target.value)} />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Textarea label="Footer (Arabic)" value={form.receipt_footer_ar} onChange={(e) => updateField("receipt_footer_ar", e.target.value)} dir="rtl" />
            </div>
          </Card>
        )}

        {tab === "modules" && (
          <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Store Modules (Global)</h3>
              <p className="settings-section-desc">
                Turn modules on or off for the whole store. Disabled modules are hidden from every user.
              </p>
              <div className="settings-check-list">
                {MODULES.map((mod) => {
                  const key = moduleSettingKey(mod.id);
                  return (
                    <label key={mod.id} className="settings-check settings-check-block">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => updateField(key, e.target.checked)}
                      />
                      <span>
                        <strong>{mod.label}</strong>
                        <small>{mod.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Card>

            <Card className="settings-card">
              <h3 className="settings-section-title">{ROLE_LABELS[ROLES.ADMIN]} — Menu Access</h3>
              <p className="settings-section-desc">
                Choose which menus administrators can see (when the module is enabled globally).
              </p>
              <div className="settings-check-list">
                {[...MODULES, ...ADMIN_MODULES].map((mod) => {
                  const key = roleModuleSettingKey(ROLES.ADMIN, mod.id);
                  return (
                    <label key={key} className="settings-check settings-check-block">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => updateField(key, e.target.checked)}
                      />
                      <span>
                        <strong>{mod.label}</strong>
                        <small>{mod.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Card>

            <Card className="settings-card">
              <h3 className="settings-section-title">{ROLE_LABELS[ROLES.CASHIER]} — Menu Access</h3>
              <p className="settings-section-desc">
                Choose which menus cashiers can see. User Management and Settings are always admin-only.
              </p>
              <div className="settings-check-list">
                {MODULES.map((mod) => {
                  const key = roleModuleSettingKey(ROLES.CASHIER, mod.id);
                  return (
                    <label key={key} className="settings-check settings-check-block">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => updateField(key, e.target.checked)}
                      />
                      <span>
                        <strong>{mod.label}</strong>
                        <small>{mod.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {tab === "dashboard" && (
          <Card className="settings-card">
            <h3 className="settings-section-title">Dashboard Customization</h3>
            <p className="settings-section-title" style={{ fontSize: "0.9375rem" }}>Administrator Dashboard</p>
            <div className="settings-check-list">
              <label className="settings-check">
                <input type="checkbox" checked={form.dashboard_admin_show_profit} onChange={(e) => updateField("dashboard_admin_show_profit", e.target.checked)} />
                Show monthly profit
              </label>
              <label className="settings-check">
                <input type="checkbox" checked={form.dashboard_admin_show_purchases} onChange={(e) => updateField("dashboard_admin_show_purchases", e.target.checked)} />
                Show today's purchases
              </label>
            </div>
            <p className="settings-section-title" style={{ fontSize: "0.9375rem", marginTop: "1.25rem" }}>Cashier Dashboard</p>
            <div className="settings-check-list">
              <label className="settings-check">
                <input type="checkbox" checked={form.dashboard_cashier_show_recent} onChange={(e) => updateField("dashboard_cashier_show_recent", e.target.checked)} />
                Show recent sales list
              </label>
            </div>
          </Card>
        )}

        {tab === "backup" && (
          <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Database Backup</h3>
              <p className="settings-section-desc">
                Export or restore all store data including products, sales, users, and settings.
              </p>
              <div className="settings-backup-actions">
                <Button type="button" variant="secondary" onClick={handleBackupClick} disabled={backupBusy}>
                  {backupBusy ? "Working..." : "Download Backup"}
                </Button>
                <Button type="button" onClick={handleRestoreClick} disabled={backupBusy}>
                  Restore from File
                </Button>
                <input ref={restoreInputRef} type="file" accept=".json,application/json" hidden onChange={handleRestoreFile} />
              </div>
            </Card>

            <Card className="settings-card settings-danger-card">
              <h3 className="settings-section-title settings-danger-title">Clear Database</h3>
              <p className="settings-section-desc">
                Remove all business data and reset to factory defaults. This cannot be undone.
                Download a backup first if you need to keep your data.
              </p>
              <ul className="settings-danger-list">
                <li>Products, sales, orders, purchases, inventory</li>
                <li>Customers, suppliers, expenses</li>
                <li>Custom settings (store name, VAT, modules)</li>
              </ul>
              <p className="settings-section-desc">
                Restored after clear: default admin (<strong>admin</strong> / admin123) and cashier (<strong>cashier</strong> / cashier123).
              </p>
              <Button type="button" variant="danger" onClick={handleClearDataClick} disabled={backupBusy}>
                {backupBusy ? "Clearing..." : "Clear All Data"}
              </Button>
            </Card>
          </>
        )}

        {tab !== "backup" && (
          <Button type="submit" style={{ marginTop: "0.5rem" }}>Save Settings</Button>
        )}
      </form>

      {confirmDialog}

      <Modal
        isOpen={Boolean(feedbackModal)}
        onClose={() => setFeedbackModal(null)}
        title={feedbackModal?.title || ""}
        footer={
          <Button onClick={() => setFeedbackModal(null)}>OK</Button>
        }
      >
        {feedbackModal && (
          <div className="settings-feedback-modal">
            <div className={`settings-feedback-icon ${feedbackModal.icon === "error" ? "error" : "success"}`}>
              {feedbackModal.icon === "error" ? (
                <Trash2 size={28} />
              ) : feedbackModal.icon === "restore" ? (
                <RotateCcw size={28} />
              ) : feedbackModal.icon === "download" ? (
                <Download size={28} />
              ) : (
                <CheckCircle2 size={28} />
              )}
            </div>
            <div className="settings-feedback-body">{feedbackModal.body}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

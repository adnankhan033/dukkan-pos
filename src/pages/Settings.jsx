import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Download, RotateCcw, Trash2, ShieldAlert } from "lucide-react";
import { settingsService } from "../services/SettingsService";
import { backupService } from "../services/BackupService";
import { zatcaService } from "../services/ZatcaService";
import { useSettingsStore, useAuthStore } from "../contexts/store";
import { useConfirm } from "../hooks/useConfirm";
import { usePermissions } from "../hooks/usePermissions";
import {
  MODULES,
  ADMIN_MODULES,
  moduleSettingKey,
  roleModuleSettingKey,
  menuItemSettingKey,
  roleMenuItemSettingKey,
  getMenuPermissionGroupsByModule,
  MENU_ITEMS,
} from "../utils/modules";
import { ROLES, ROLE_LABELS } from "../utils/roles";
import MenuPermissionTree from "../components/settings/MenuPermissionTree";
import { DATA_CLEAR_SECTIONS } from "../utils/dataClearSections.js";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import { Card } from "../components/common/Card";
import { Input, Textarea, Select } from "../components/common/Input";
import { Alert } from "../components/common/Loading";
import ReceiptPreview from "../components/settings/ReceiptPreview";
import ZatcaSettingsPanel from "../components/settings/ZatcaSettingsPanel";
import { DEFAULT_RECEIPT_TEMPLATE } from "../utils/receiptTemplates";
import { DEFAULT_BUSINESS_TIMEZONE, BUSINESS_TIMEZONES } from "../utils/timezones";
import { getBusinessDateTimeLabelFromForm } from "../utils/businessDate";
import { getZatcaDefaultSettings } from "../zatca/core/config";
import { ZATCA_PHASES, ZATCA_SETTING_KEYS as ZK } from "../zatca/core/constants";
import "./Settings.css";

const ZATCA_DEFAULTS = getZatcaDefaultSettings();

const TABS = [
  { id: "store", label: "Store" },
  { id: "receipt", label: "Receipt" },
  { id: "zatca", label: "ZATCA" },
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
    store_phone: settings.store_phone || "",
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
    receipt_template: settings.receipt_template || DEFAULT_RECEIPT_TEMPLATE,
    business_timezone: settings.business_timezone || DEFAULT_BUSINESS_TIMEZONE,
    business_date_override: settings.business_date_override || "",
    business_time_override: settings.business_time_override || "",
    dashboard_admin_show_profit: settingBool(settings.dashboard_admin_show_profit),
    dashboard_admin_show_purchases: settingBool(settings.dashboard_admin_show_purchases),
    dashboard_cashier_show_recent: settingBool(settings.dashboard_cashier_show_recent),
  };

  for (const [key, defaultVal] of Object.entries(ZATCA_DEFAULTS)) {
    form[key] = settings[key] ?? defaultVal;
  }

  for (const mod of MODULES) {
    form[moduleSettingKey(mod.id)] = settingBool(settings[moduleSettingKey(mod.id)]);
  }

  for (const item of MENU_ITEMS) {
    form[menuItemSettingKey(item.id)] = settingBool(settings[menuItemSettingKey(item.id)]);
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

  for (const item of MENU_ITEMS) {
    form[roleMenuItemSettingKey(ROLES.ADMIN, item.id)] = settingBool(
      settings[roleMenuItemSettingKey(ROLES.ADMIN, item.id)] ?? "1"
    );
    form[roleMenuItemSettingKey(ROLES.CASHIER, item.id)] = settingBool(
      settings[roleMenuItemSettingKey(ROLES.CASHIER, item.id)] ??
        (ADMIN_MODULES.some((mod) => mod.id === item.module) ? "0" : "1")
    );
  }

  return form;
}

function formToSettings(form) {
  const payload = {
    store_name: form.store_name,
    store_name_ar: form.store_name_ar,
    store_address: form.store_address,
    store_phone: form.store_phone,
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
    receipt_template: form.receipt_template || DEFAULT_RECEIPT_TEMPLATE,
    business_timezone: form.business_timezone || DEFAULT_BUSINESS_TIMEZONE,
    business_date_override: form.business_date_override || "",
    business_time_override: form.business_time_override || "",
    dashboard_admin_show_profit: form.dashboard_admin_show_profit ? "1" : "0",
    dashboard_admin_show_purchases: form.dashboard_admin_show_purchases ? "1" : "0",
    dashboard_cashier_show_recent: form.dashboard_cashier_show_recent ? "1" : "0",
  };

  for (const key of Object.keys(ZATCA_DEFAULTS)) {
    payload[key] = form[key] ?? "";
  }
  payload[ZK.ENABLED] =
    payload[ZK.ACTIVE_PHASE] !== ZATCA_PHASES.DISABLED ? "1" : "0";

  for (const mod of MODULES) {
    const key = moduleSettingKey(mod.id);
    payload[key] = form[key] ? "1" : "0";
  }

  for (const item of MENU_ITEMS) {
    payload[menuItemSettingKey(item.id)] = form[menuItemSettingKey(item.id)] ? "1" : "0";
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

  for (const item of MENU_ITEMS) {
    payload[roleMenuItemSettingKey(ROLES.ADMIN, item.id)] = form[roleMenuItemSettingKey(ROLES.ADMIN, item.id)]
      ? "1"
      : "0";
    payload[roleMenuItemSettingKey(ROLES.CASHIER, item.id)] =
      ADMIN_MODULES.some((mod) => mod.id === item.module)
        ? "0"
        : form[roleMenuItemSettingKey(ROLES.CASHIER, item.id)]
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
  const { isAdmin } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [tab, setTab] = useState("store");
  const [form, setForm] = useState(() => buildFormFromSettings(settings));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [sectionCounts, setSectionCounts] = useState({});
  const [feedbackModal, setFeedbackModal] = useState(null);
  const restoreInputRef = useRef(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const businessTimePreview = getBusinessDateTimeLabelFromForm(form);
  void clockTick;

  useEffect(() => {
    if (tab !== "backup" || !isAdmin) return undefined;
    let cancelled = false;
    backupService
      .getSectionRowCounts()
      .then((counts) => {
        if (!cancelled) setSectionCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setSectionCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [tab, isAdmin, backupBusy]);

  async function refreshSectionCounts() {
    if (!isAdmin) return;
    try {
      const counts = await backupService.getSectionRowCounts();
      setSectionCounts(counts);
    } catch {
      setSectionCounts({});
    }
  }

  async function persistForm(mergedForm) {
    const payload = formToSettings(mergedForm ?? form);
    const updated = await settingsService.updateMany(payload);
    setSettings(updated);
    setForm(buildFormFromSettings(updated));
    zatcaService.restartBackgroundSync();
    return updated;
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const updated = await persistForm(form);
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
      zatcaService.restartBackgroundSync();
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

  async function handleClearSectionClick(section) {
    const count = sectionCounts[section.id] ?? 0;
    const ok = await confirm({
      title: `Clear ${section.label}`,
      size: "lg",
      variant: "danger",
      confirmLabel: "Delete Section Data",
      cancelLabel: "Cancel",
      children: (
        <>
          <p>{section.description}</p>
          <p>
            <strong>{count.toLocaleString()}</strong> record{count === 1 ? "" : "s"} will be
            permanently deleted.
          </p>
          <div className="confirm-note confirm-note-danger">
            This cannot be undone. Download a backup first if you need to keep this data.
          </div>
        </>
      ),
    });
    if (!ok) return;

    setBackupBusy(true);
    setError("");
    setMessage("");
    try {
      await backupService.clearSection(section.id);
      await refreshSectionCounts();
      setMessage(`${section.label} data cleared successfully.`);
    } catch (err) {
      setFeedbackModal({
        title: "Clear Failed",
        icon: "error",
        body: <p>{err.message || `Could not clear ${section.label.toLowerCase()}.`}</p>,
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

      {tab === "backup" ? (
        <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Database Backup</h3>
              <p className="settings-section-desc">
                Export or restore all store data including products, sales, users, and settings.
                For Gmail cloud backup, use <strong>Backup → Gmail Backup</strong> in the sidebar.
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

            {isAdmin && (
              <Card className="settings-card settings-danger-card">
                <h3 className="settings-section-title settings-danger-title">
                  <ShieldAlert size={18} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
                  Clear Data by Section
                </h3>
                <p className="settings-section-desc">
                  Administrator only. Delete one part of the database without wiping everything.
                  Users and store settings are kept unless you use Clear All Data below.
                </p>
                <div className="settings-clear-sections">
                  {DATA_CLEAR_SECTIONS.map((section) => {
                    const count = sectionCounts[section.id] ?? 0;
                    return (
                      <div key={section.id} className="settings-clear-section">
                        <div className="settings-clear-section-body">
                          <strong>{section.label}</strong>
                          <span className="settings-clear-section-desc">{section.description}</span>
                          <span className="settings-clear-section-count">
                            {count.toLocaleString()} record{count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={backupBusy || count === 0}
                          onClick={() => handleClearSectionClick(section)}
                        >
                          Clear
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {isAdmin && (
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
            )}
        </>
      ) : (
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
              <div style={{ marginTop: "1rem" }}>
                <Input
                  label="Store Phone"
                  value={form.store_phone}
                  onChange={(e) => updateField("store_phone", e.target.value)}
                  placeholder="e.g. +966-530096993"
                />
              </div>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <Input label="VAT %" type="number" step="0.01" value={form.vat_percent} onChange={(e) => updateField("vat_percent", e.target.value)} />
                <Input label="Currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)} />
              </div>
            </Card>
            <Card className="settings-card">
              <h3 className="settings-section-title">Business Region & Time</h3>
              <p className="settings-section-desc">
                Select your store region. Accounting filters (Today, Week, Month) and default expense dates
                use this timezone automatically — no toggle needed.
              </p>
              <Select
                label="Region / timezone"
                value={form.business_timezone}
                onChange={(e) => updateField("business_timezone", e.target.value)}
              >
                {BUSINESS_TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                    {tz.default ? " (Default)" : ""}
                  </option>
                ))}
              </Select>
              <div className="business-time-live">
                <div className="business-time-live-label">Current business time</div>
                <div className="business-time-live-value">{businessTimePreview.datetime}</div>
                <div className="business-time-live-region" dir="rtl">
                  {businessTimePreview.regionAr}
                </div>
                {businessTimePreview.isOverride && (
                  <div className="business-time-live-note">Using fixed date below (not live clock)</div>
                )}
              </div>
              <p className="settings-section-desc" style={{ marginTop: "1rem" }}>
                Optional: set a fixed date/time for new expense records (leave empty to always use live region time).
              </p>
              <div className="form-row">
                <Input
                  label="Fixed date (optional)"
                  type="date"
                  value={form.business_date_override}
                  onChange={(e) => updateField("business_date_override", e.target.value)}
                />
                <Input
                  label="Fixed time (optional)"
                  type="time"
                  value={form.business_time_override}
                  onChange={(e) => updateField("business_time_override", e.target.value)}
                />
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
          <div className="settings-receipt-layout">
            <Card className="settings-card settings-receipt-form">
              <h3 className="settings-section-title">Receipt Template</h3>
              <p className="settings-section-desc">
                Choose a Saudi-style invoice layout for your baqala. Use preview and test print before saving.
              </p>

              <Select
                label="Default template"
                value={form.receipt_template}
                onChange={(e) => updateField("receipt_template", e.target.value)}
              >
                <option value="baqala">Saudi Baqala (recommended)</option>
                <option value="classic">Classic Thermal</option>
                <option value="compact">Compact 58mm</option>
              </Select>

              <div className="settings-check-list" style={{ marginTop: "1rem" }}>
                <label className="settings-check">
                  <input type="checkbox" checked={form.receipt_show_qr} onChange={(e) => updateField("receipt_show_qr", e.target.checked)} />
                  Show ZATCA QR code
                </label>
                <label className="settings-check">
                  <input type="checkbox" checked={form.receipt_show_bilingual} onChange={(e) => updateField("receipt_show_bilingual", e.target.checked)} />
                  Show bilingual names (EN + AR)
                </label>
                <label className="settings-check">
                  <input type="checkbox" checked={form.receipt_show_tax_info} onChange={(e) => updateField("receipt_show_tax_info", e.target.checked)} />
                  Show CR & VAT numbers on receipt
                </label>
              </div>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <Select label="Paper width" value={form.receipt_paper_width} onChange={(e) => updateField("receipt_paper_width", e.target.value)}>
                  <option value="58">58mm (small thermal)</option>
                  <option value="80">80mm (standard thermal)</option>
                </Select>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Input
                  label="Header note (optional)"
                  value={form.receipt_header_note}
                  onChange={(e) => updateField("receipt_header_note", e.target.value)}
                  placeholder="e.g. Exchange within 7 days with receipt"
                />
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Textarea label="Footer (English)" value={form.receipt_footer} onChange={(e) => updateField("receipt_footer", e.target.value)} />
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Textarea label="Footer (Arabic)" value={form.receipt_footer_ar} onChange={(e) => updateField("receipt_footer_ar", e.target.value)} dir="rtl" />
              </div>
              <p className="settings-section-desc" style={{ marginTop: "1rem" }}>
                Store name, address, CR, and VAT are taken from the <strong>Store</strong> tab.
              </p>
            </Card>

            <ReceiptPreview
              form={form}
              onSelectTemplate={(id) => updateField("receipt_template", id)}
            />
          </div>
        )}

        {tab === "zatca" && (
          <ZatcaSettingsPanel
            form={form}
            updateField={updateField}
            baseSettings={settings}
            saveForm={persistForm}
          />
        )}

        {tab === "modules" && (
          <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Store Modules (Global)</h3>
              <p className="settings-section-desc">
                Turn modules and individual menu items on or off for the whole store. Disabled items are hidden from every user.
              </p>
              <MenuPermissionTree
                groups={getMenuPermissionGroupsByModule()}
                form={form}
                updateField={updateField}
                scope="global"
              />
            </Card>

            <Card className="settings-card">
              <h3 className="settings-section-title">{ROLE_LABELS[ROLES.ADMIN]} — Menu Access</h3>
              <p className="settings-section-desc">
                Choose which modules and menu items administrators can see (when enabled globally).
              </p>
              <MenuPermissionTree
                groups={getMenuPermissionGroupsByModule({ includeAdmin: true })}
                form={form}
                updateField={updateField}
                scope="role"
                role={ROLES.ADMIN}
              />
            </Card>

            <Card className="settings-card">
              <h3 className="settings-section-title">{ROLE_LABELS[ROLES.CASHIER]} — Menu Access</h3>
              <p className="settings-section-desc">
                Choose which modules and menu items cashiers can see. User Management and Settings are always admin-only.
              </p>
              <MenuPermissionTree
                groups={getMenuPermissionGroupsByModule()}
                form={form}
                updateField={updateField}
                scope="role"
                role={ROLES.CASHIER}
              />
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

        <Button type="submit" style={{ marginTop: "0.5rem" }}>Save Settings</Button>
      </form>
      )}

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

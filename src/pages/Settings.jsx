import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Download, RotateCcw, Trash2, ShieldAlert } from "lucide-react";
import { settingsService } from "../services/SettingsService";
import { activationService } from "../services/ActivationService";
import { backupService } from "../services/BackupService";
import { zatcaService } from "../services/ZatcaService";
import { useSettingsStore, useAuthStore } from "../contexts/store";
import { useConfirm } from "../hooks/useConfirm";
import { usePermissions } from "../hooks/usePermissions";
import { DATA_CLEAR_SECTIONS } from "../utils/dataClearSections.js";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import { Card } from "../components/common/Card";
import { Input, Textarea, Select } from "../components/common/Input";
import { Alert } from "../components/common/Loading";
import ReceiptPreview from "../components/settings/ReceiptPreview";
import ZatcaSettingsPanel from "../components/settings/ZatcaSettingsPanel";
import VendorBrandingPanel from "../components/settings/VendorBrandingPanel";
import { VENDOR_SETTING_KEY_LIST } from "../config/softwareVendor";
import { DEFAULT_RECEIPT_TEMPLATE } from "../utils/receiptTemplates";
import {
  RECEIPT_SECTION_DEFAULTS,
  RECEIPT_SECTION_TOGGLES,
} from "../utils/receiptSections";
import { DEFAULT_BUSINESS_TIMEZONE, BUSINESS_TIMEZONES } from "../utils/timezones";
import { getBusinessDateTimeLabelFromForm } from "../utils/businessDate";
import { getZatcaDefaultSettings } from "../zatca/core/config";
import { ZATCA_PHASES, ZATCA_SETTING_KEYS as ZK } from "../zatca/core/constants";
import { mirrorStoreFields } from "../utils/settingsSync";
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from "../utils/activationConfig";
import { notify } from "../utils/notify";
import { getAllPermissionSettingKeys } from "../utils/actions";
import "./Settings.css";

const ZATCA_DEFAULTS = getZatcaDefaultSettings();

const TABS = [
  { id: "store", label: "Store" },
  { id: "permissions", label: "Permissions", adminOnly: true },
  { id: "receipt", label: "Receipt" },
  { id: "zatca", label: "ZATCA" },
  { id: "dashboard", label: "Dashboard" },
  { id: "vendor", label: "Vendor", adminOnly: true },
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
    receipt_branding: settings.receipt_branding || "DukkanPOS",
    receipt_show_qr: settingBool(settings.receipt_show_qr),
    receipt_show_bilingual: settingBool(settings.receipt_show_bilingual),
    receipt_show_tax_info: settingBool(settings.receipt_show_tax_info),
    ...Object.fromEntries(
      Object.entries(RECEIPT_SECTION_DEFAULTS).map(([key, defaultVal]) => [
        key,
        settingBool(settings[key] ?? defaultVal),
      ])
    ),
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

  for (const key of getAllPermissionSettingKeys()) {
    form[key] = settingBool(settings[key]);
  }

  for (const key of VENDOR_SETTING_KEY_LIST) {
    form[key] = settings[key] ?? "";
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
    receipt_branding: form.receipt_branding,
    receipt_show_qr: form.receipt_show_qr ? "1" : "0",
    receipt_show_bilingual: form.receipt_show_bilingual ? "1" : "0",
    receipt_show_tax_info: form.receipt_show_tax_info ? "1" : "0",
    ...Object.fromEntries(
      Object.keys(RECEIPT_SECTION_DEFAULTS).map((key) => [key, form[key] ? "1" : "0"])
    ),
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

  for (const key of getAllPermissionSettingKeys()) {
    if (form[key] !== undefined) {
      payload[key] = form[key] ? "1" : "0";
    }
  }

  for (const key of VENDOR_SETTING_KEY_LIST) {
    if (form[key] !== undefined) {
      payload[key] = String(form[key] ?? "");
    }
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
  const [backupBusy, setBackupBusy] = useState(false);
  const [sectionCounts, setSectionCounts] = useState({});
  const [feedbackModal, setFeedbackModal] = useState(null);
  const restoreInputRef = useRef(null);
  const formDirtyRef = useRef(false);

  function updateField(key, value) {
    formDirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateFields(patch) {
    formDirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    if (formDirtyRef.current) return;
    setForm(buildFormFromSettings(settings));
  }, [settings]);

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
    const payload = mirrorStoreFields(formToSettings(mergedForm ?? form));
    const updated = await settingsService.updateMany(payload);

    setSettings(updated);
    setForm(buildFormFromSettings(updated));
    formDirtyRef.current = false;
    zatcaService.restartBackgroundSync();
    return updated;
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      await persistForm(form);
      const savedLabel =
        tab === "permissions"
          ? "Role and menu permissions were saved."
          : tab === "vendor"
            ? "Software vendor branding was saved."
            : "Your store configuration was saved.";
      notify.success(savedLabel, {
        title:
          tab === "permissions"
            ? "Permissions saved"
            : tab === "vendor"
              ? "Vendor branding saved"
              : "Settings saved",
      });
    } catch (err) {
      notify.error(err.message, { title: "Could not save settings" });
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
    try {
      const result = await backupService.createBackupDownload();
      notify.success("Your backup file was downloaded.", { title: "Backup ready" });
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
    try {
      const text = await file.text();
      const data = backupService.parseBackupFile(text);
      await backupService.restoreFromBackup(data);
      const updated = await settingsService.getAll();
      setSettings(updated);
      setForm(buildFormFromSettings(updated));
      zatcaService.restartBackgroundSync();
      notify.success(`Data from ${file.name} was restored.`, { title: "Backup restored" });
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
    try {
      await backupService.clearSection(section.id);
      await refreshSectionCounts();
      notify.success(`${section.label} data was cleared.`, { title: "Section cleared" });
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

  async function handleResetSetupClick() {
    const ok = await confirm({
      title: "Reset Store Setup",
      size: "lg",
      variant: "danger",
      confirmLabel: "Reset Setup",
      cancelLabel: "Cancel",
      children: (
        <>
          <p>Start the store setup wizard again from step 1 (store details and activation).</p>
          <ul className="confirm-list">
            <li>Activation key and registration status will be cleared</li>
            <li>You will be signed out and sent to the setup screen</li>
          </ul>
          <div className="confirm-note">
            Your products, sales, orders, and other store data are kept.
          </div>
        </>
      ),
    });
    if (!ok) return;

    setBackupBusy(true);
    try {
      const updated = await activationService.resetInstallationSetup();
      setSettings(updated);
      logout();
      navigate("/setup", { replace: true });
    } catch (err) {
      setBackupBusy(false);
      setFeedbackModal({
        title: "Reset Failed",
        icon: "error",
        body: <p>{err.message || "Could not reset store setup."}</p>,
      });
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
            <li>Custom settings (store name, VAT)</li>
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
            <li>Administrator — <strong>{DEFAULT_ADMIN_USERNAME}</strong> / {DEFAULT_ADMIN_PASSWORD}</li>
            <li>Cashier — <strong>cashier</strong> / cashier123</li>
          </ul>
          <p>You will be signed out and must log in again.</p>
        </>
      ),
    });
    if (!finalOk) return;

    setBackupBusy(true);
    try {
      await backupService.clearAllData();
      logout();
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Database cleared successfully. Sign in with admin / "
            + DEFAULT_ADMIN_PASSWORD
            + " or cashier / cashier123.",
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
        subtitle="Store configuration, receipts, dashboards, and backups."
      />

      <div className="settings-tabs">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
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
                  <RotateCcw size={18} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
                  Reset Store Setup
                </h3>
                <p className="settings-section-desc">
                  Start configuration from step 1 again — store details, activation email, and
                  activation key. Use this when you need to re-register the store.
                </p>
                <ul className="settings-danger-list">
                  <li>Clears activation and registration status</li>
                  <li>Keeps products, sales, orders, and users</li>
                </ul>
                <Button type="button" variant="danger" onClick={handleResetSetupClick} disabled={backupBusy}>
                  {backupBusy ? "Resetting..." : "Reset Setup from Step 1"}
                </Button>
              </Card>
            )}

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
                <li>Custom settings (store name, VAT)</li>
              </ul>
              <p className="settings-section-desc">
                Restored after clear: default admin (<strong>{DEFAULT_ADMIN_USERNAME}</strong> / {DEFAULT_ADMIN_PASSWORD}) and cashier (<strong>cashier</strong> / cashier123).
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
                Select your store region (default: Saudi Arabia — Riyadh). Receipts, invoices, and order
                filters use this timezone automatically.
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
                Optional: set a fixed date/time for new sales, expenses, and reports (leave empty to use live Saudi/business time).
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

        {tab === "permissions" && isAdmin && (
          <PermissionsPanel
            form={form}
            updateField={updateField}
            updateFields={updateFields}
            onResetRole={(role) =>
              notify.info(`${role === "admin" ? "Administrator" : "Cashier"} menu defaults restored. Click Save Settings to apply.`, {
                title: "Defaults loaded",
              })
            }
          />
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

              <div className="settings-check-list" style={{ marginTop: "1.25rem" }}>
                <h4 className="settings-subsection-title">Invoice sections</h4>
                <p className="settings-section-desc" style={{ marginBottom: "0.75rem" }}>
                  Choose which parts appear on printed receipts and invoices.
                </p>
                {RECEIPT_SECTION_TOGGLES.map((toggle) => (
                  <label key={toggle.key} className="settings-check settings-check--stacked">
                    <span className="settings-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(form[toggle.key])}
                        onChange={(e) => updateField(toggle.key, e.target.checked)}
                      />
                      {toggle.label}
                    </span>
                    {toggle.hint && <small className="settings-check-hint">{toggle.hint}</small>}
                  </label>
                ))}
                <label className="settings-check settings-check--stacked" style={{ marginTop: "0.75rem" }}>
                  <span className="settings-check-row">
                    <input
                      type="checkbox"
                      checked={form.receipt_show_bilingual}
                      onChange={(e) => updateField("receipt_show_bilingual", e.target.checked)}
                    />
                    Bilingual labels (EN + AR)
                  </span>
                  <small className="settings-check-hint">
                    Adds Arabic labels and names alongside English across visible sections
                  </small>
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
              <div style={{ marginTop: "1rem" }}>
                <Input
                  label="Powered by (receipt branding)"
                  value={form.receipt_branding}
                  onChange={(e) => updateField("receipt_branding", e.target.value)}
                  placeholder="DukkanPOS"
                />
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

        {tab === "vendor" && isAdmin && (
          <Card className="settings-card">
            <h3 className="settings-section-title">Software Vendor Branding</h3>
            <VendorBrandingPanel
              form={form}
              onChange={(next) => {
                formDirtyRef.current = true;
                setForm(next);
              }}
            />
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

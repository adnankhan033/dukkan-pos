import { useRef, useState, useEffect, lazy, Suspense } from "react";
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
import { Alert, LoadingSpinner } from "../components/common/Loading";
import ReceiptPreview, { ReceiptTemplatePicker } from "../components/settings/ReceiptPreview";
import ZatcaSettingsPanel from "../components/settings/ZatcaSettingsPanel";
import VendorBrandingPanel from "../components/settings/VendorBrandingPanel";
import SettingsTabToolbar from "../components/settings/SettingsTabToolbar";
import SettingsTabView from "../components/settings/SettingsTabView";
import PaymentMethodsPanel from "../components/settings/PaymentMethodsPanel";
import { VENDOR_SETTING_KEY_LIST, VENDOR_SETTING_KEYS } from "../config/softwareVendor";
import { DEFAULT_RECEIPT_TEMPLATE } from "../utils/receiptTemplates";
import { currencyOptions, DEFAULT_CURRENCY } from "../utils/currencies";
import { PHONE_PLACEHOLDER } from "../utils/constants";
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
  ACTIVATION_SETTING_KEYS,
} from "../utils/activationConfig";
import { notify } from "../utils/notify";
import { getAllPermissionSettingKeys } from "../utils/actions";
import { formatDbError } from "../utils/format";
import { required, email, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import "./Settings.css";

const PermissionsPanel = lazy(() => import("../components/settings/PermissionsPanel"));

const ZATCA_DEFAULTS = getZatcaDefaultSettings();

const TABS = [
  { id: "store", label: "Store" },
  { id: "permissions", label: "Permissions", adminOnly: true },
  { id: "payments", label: "Payments", adminOnly: true },
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
    vat_included: settingBool(settings.vat_included ?? "1"),
    tax_enabled: settingBool(settings.tax_enabled ?? "1"),
    currency: settings.currency || DEFAULT_CURRENCY,
    receipt_footer: settings.receipt_footer || "",
    receipt_footer_ar: settings.receipt_footer_ar || "",
    receipt_branding: settings.receipt_branding || "Nexttel POS",
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
    receipt_print_on_complete: settingBool(settings.receipt_print_on_complete ?? "1"),
    invoice_update_existing: settingBool(settings.invoice_update_existing),
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
    vat_included: form.vat_included ? "1" : "0",
    tax_enabled: form.tax_enabled ? "1" : "0",
    currency: form.currency || DEFAULT_CURRENCY,
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
    receipt_print_on_complete: form.receipt_print_on_complete ? "1" : "0",
    invoice_update_existing: form.invoice_update_existing ? "1" : "0",
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

const STORE_SAVE_KEYS = [
  "store_name",
  "store_name_ar",
  "store_address",
  "store_phone",
  "cr_number",
  "vat_registration",
  "vat_percent",
  "vat_included",
  "tax_enabled",
  "currency",
  "business_timezone",
  "business_date_override",
  "business_time_override",
  ZK.COMPANY_NAME,
  ZK.COMPANY_NAME_AR,
  ZK.CR_NUMBER,
  ZK.VAT_NUMBER,
  ZK.COMPANY_ADDRESS,
  ACTIVATION_SETTING_KEYS.CUSTOMER_STORE,
  ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS,
  ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE,
];

const RECEIPT_SAVE_KEYS = [
  "receipt_footer",
  "receipt_footer_ar",
  "receipt_branding",
  "receipt_show_qr",
  "receipt_show_bilingual",
  "receipt_show_tax_info",
  ...Object.keys(RECEIPT_SECTION_DEFAULTS),
  "receipt_paper_width",
  "receipt_header_note",
  "receipt_template",
  "receipt_print_on_complete",
  "invoice_update_existing",
];

const DASHBOARD_SAVE_KEYS = [
  "dashboard_admin_show_profit",
  "dashboard_admin_show_purchases",
  "dashboard_cashier_show_recent",
];

function pickPayload(payload, keys) {
  const picked = {};
  for (const key of keys) {
    if (payload[key] !== undefined) picked[key] = payload[key];
  }
  return picked;
}

function payloadForTab(payload, tab) {
  if (tab === "store") return pickPayload(payload, STORE_SAVE_KEYS);
  if (tab === "receipt") return pickPayload(payload, RECEIPT_SAVE_KEYS);
  if (tab === "dashboard") return pickPayload(payload, DASHBOARD_SAVE_KEYS);
  if (tab === "permissions") return pickPayload(payload, getAllPermissionSettingKeys());
  if (tab === "vendor") return pickPayload(payload, VENDOR_SETTING_KEY_LIST);
  if (tab === "zatca") return pickPayload(payload, [...Object.keys(ZATCA_DEFAULTS), ZK.ENABLED, ...STORE_SAVE_KEYS]);
  return payload;
}

function validateVatPercent(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "VAT % is required";
  }
  const num = Number(value);
  if (Number.isNaN(num) || num < 0 || num > 100) {
    return "VAT % must be between 0 and 100";
  }
  return null;
}

function validatePhone(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^[+\d][\d\s-]{6,18}$/.test(text)) {
    return "Enter a valid phone number";
  }
  return null;
}

function validateSettingsForm(form, tab) {
  const rules = {};
  if (tab === "store") {
    rules.store_name = required(form.store_name, "Store name");
    if (form.tax_enabled) {
      rules.vat_percent = validateVatPercent(form.vat_percent);
    }
    rules.currency = required(form.currency, "Currency");
    rules.store_phone = validatePhone(form.store_phone);
  }
  if (tab === "receipt") {
    if (!["58", "80"].includes(String(form.receipt_paper_width))) {
      rules.receipt_paper_width = "Choose 58mm or 80mm paper";
    }
  }
  if (tab === "vendor") {
    rules[VENDOR_SETTING_KEYS.COMPANY_NAME] = required(
      form[VENDOR_SETTING_KEYS.COMPANY_NAME],
      "Company name"
    );
    rules[VENDOR_SETTING_KEYS.EMAIL] = email(form[VENDOR_SETTING_KEYS.EMAIL]);
  }
  return runFormValidation(rules);
}

export default function Settings() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { isAdmin, canPerformAction } = usePermissions();
  const canUpdateInvoices = canPerformAction("invoices_update");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [tab, setTab] = useState("store");
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => buildFormFromSettings(settings));
  const [backupBusy, setBackupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [sectionCounts, setSectionCounts] = useState({});
  const [feedbackModal, setFeedbackModal] = useState(null);
  const restoreInputRef = useRef(null);
  const formDirtyRef = useRef(false);

  function switchTab(nextTab) {
    setTab(nextTab);
    setIsEditing(false);
    formDirtyRef.current = false;
    setErrors({});
    setFeedback(null);
    setForm(buildFormFromSettings(settings));
  }

  function startEditing() {
    setIsEditing(true);
    setErrors({});
    setFeedback(null);
  }

  function cancelEditing() {
    if (saving) return;
    setIsEditing(false);
    formDirtyRef.current = false;
    setErrors({});
    setFeedback(null);
    setForm(buildFormFromSettings(settings));
  }

  function updateField(key, value) {
    formDirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
    setErrors((prev) => {
      if (!prev[key] && !prev.form) return prev;
      const next = { ...prev };
      delete next[key];
      if (Object.keys(next).filter((field) => field !== "form").length === 0) return {};
      delete next.form;
      return next;
    });
  }

  function updateFields(patch) {
    formDirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function confirmUpdateExistingInvoices() {
    return confirm({
      title: "Update created invoices",
      message: "Are you sure you want to update invoices already created?",
      confirmLabel: "Update invoices",
      cancelLabel: "Cancel",
      variant: "danger",
    });
  }

  async function handleSelectReceiptTemplate(id) {
    if (!id || saving) return;

    if (isEditing) {
      updateField("receipt_template", id);
      return;
    }

    if (form.receipt_template === id) return;

    if (form.invoice_update_existing) {
      const ok = await confirmUpdateExistingInvoices();
      if (!ok) return;
    }

    const previous = form.receipt_template;
    setForm((prev) => ({ ...prev, receipt_template: id }));
    setSaving(true);
    setFeedback(null);
    try {
      await settingsService.set("receipt_template", id);
      const updated = await settingsService.getAll();
      setSettings(updated);
      formDirtyRef.current = false;
      const message = "Printed invoices will use this layout.";
      setFeedback({ type: "success", title: "Receipt template updated", message });
      notify.success(message, { title: "Receipt template updated" });
    } catch (err) {
      setForm((prev) => ({ ...prev, receipt_template: previous }));
      const message = formatDbError(err) || "Could not save the receipt template.";
      setFeedback({ type: "error", title: "Could not save template", message });
      notify.error(message, { title: "Could not save template" });
    } finally {
      setSaving(false);
    }
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

  const businessTimePreview =
    tab === "store" ? getBusinessDateTimeLabelFromForm(form) : null;
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
    const source = mergedForm ?? form;
    const payload = payloadForTab(mirrorStoreFields(formToSettings(source)), tab);
    if (!canUpdateInvoices) {
      delete payload.invoice_update_existing;
    }
    const updated = await settingsService.updateMany(payload);

    setSettings(updated);
    setForm(buildFormFromSettings(updated));
    formDirtyRef.current = false;
    try {
      zatcaService.restartBackgroundSync();
    } catch {
      /* background sync must not fail a successful save */
    }
    return updated;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;

    const validation = validateSettingsForm(form, tab);
    if (!validation.isValid) {
      setErrors(validation.errors);
      notify.error(validation.errors.form || "Please fix the highlighted fields.", {
        title: "Check the form",
      });
      return;
    }

    const applyingToExistingInvoices =
      tab === "receipt" && Boolean(form.invoice_update_existing);
    if (applyingToExistingInvoices) {
      const ok = await confirmUpdateExistingInvoices();
      if (!ok) return;
    }

    setErrors({});
    setSaving(true);
    setFeedback(null);
    try {
      await persistForm(form);
      setIsEditing(false);
      const savedLabel =
        tab === "permissions"
          ? "Role and menu permissions were saved."
          : tab === "vendor"
            ? "Software vendor branding was saved."
            : tab === "receipt"
              ? "Receipt settings were saved."
              : tab === "dashboard"
                ? "Dashboard settings were saved."
                : "Your store configuration was saved.";
      const savedTitle =
        tab === "permissions"
          ? "Permissions saved"
          : tab === "vendor"
            ? "Vendor branding saved"
            : "Settings saved";
      setFeedback({ type: "success", title: savedTitle, message: savedLabel });
      notify.success(savedLabel, { title: savedTitle });
    } catch (err) {
      const message = formatDbError(err) || "Could not save settings. Try again.";
      setFeedback({ type: "error", title: "Could not save settings", message });
      notify.error(message, { title: "Could not save settings" });
    } finally {
      setSaving(false);
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
            aria-current={tab === t.id ? "page" : undefined}
            disabled={saving}
            onClick={() => switchTab(t.id)}
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
                For Gmail cloud backup, use <strong>Administration → Gmail Backup</strong> in the sidebar.
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
      ) : tab === "payments" && isAdmin ? (
        <PaymentMethodsPanel />
      ) : !isEditing ? (
        <>
          <SettingsTabToolbar isEditing={false} onEdit={startEditing} />
          {feedback ? (
            <Alert type={feedback.type} title={feedback.title} onDismiss={() => setFeedback(null)}>
              {feedback.message}
            </Alert>
          ) : null}
          <SettingsTabView
            tab={tab}
            form={form}
            isAdmin={isAdmin}
            canUpdateInvoices={canUpdateInvoices}
            onSelectTemplate={handleSelectReceiptTemplate}
            saving={saving}
          />
        </>
      ) : (
      <form id="settings-edit-form" onSubmit={handleSave}>
        <SettingsTabToolbar
          isEditing
          saving={saving}
          onCancel={cancelEditing}
          onSave={() => document.getElementById("settings-edit-form")?.requestSubmit()}
          saveLabel={
            tab === "permissions"
              ? "Save Permissions"
              : tab === "vendor"
                ? "Save Vendor Branding"
                : "Save Settings"
          }
        />
        <FormValidationAlert errors={errors} />
        {feedback ? (
          <Alert type={feedback.type} title={feedback.title} onDismiss={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        ) : null}
        {tab === "store" && (
          <>
            <Card className="settings-card">
              <h3 className="settings-section-title">Store Information</h3>
              <Input label="Store Name (English)" value={form.store_name} error={errors.store_name} onChange={(e) => updateField("store_name", e.target.value)} />
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
                  error={errors.store_phone}
                  onChange={(e) => updateField("store_phone", e.target.value)}
                  placeholder={PHONE_PLACEHOLDER}
                />
              </div>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <Select
                  label="Currency"
                  value={form.currency}
                  error={errors.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                >
                  {currencyOptions(form.currency).map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} — {item.name}
                      {item.code === DEFAULT_CURRENCY ? " (Default)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="settings-check settings-check-block" style={{ marginTop: "1rem" }}>
                <input
                  type="checkbox"
                  checked={form.tax_enabled}
                  onChange={(e) => updateField("tax_enabled", e.target.checked)}
                />
                <span>
                  <strong>Enable tax (VAT)</strong>
                  <small>When off, VAT is hidden on products and sales.</small>
                </span>
              </label>
              {form.tax_enabled ? (
                <>
                  <div className="form-row" style={{ marginTop: "1rem" }}>
                    <Input
                      label="VAT %"
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={form.vat_percent}
                      error={errors.vat_percent}
                      onChange={(e) => updateField("vat_percent", e.target.value)}
                    />
                  </div>
                  <label className="settings-check" style={{ marginTop: "1rem" }}>
                    <input
                      type="checkbox"
                      checked={form.vat_included}
                      onChange={(e) => updateField("vat_included", e.target.checked)}
                    />
                    Prices include tax (VAT)
                  </label>
                  <p className="settings-section-desc" style={{ marginTop: "0.35rem" }}>
                    When enabled, selling prices are what customers pay. Tax is extracted from the
                    price, e.g. 11.50 at 15% → 10.00 net + 1.50 tax.
                  </p>
                </>
              ) : null}
            </Card>
            <Card className="settings-card">
              <h3 className="settings-section-title">Business Region & Time</h3>
              <p className="settings-section-desc">
                Select your store region. Receipts, invoices, and order
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
                Optional: set a fixed date/time for new sales, expenses, and reports (leave empty to use the live clock).
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
              <h3 className="settings-section-title">Tax & Registration</h3>
              <Input label="CR Number" value={form.cr_number} onChange={(e) => updateField("cr_number", e.target.value)} />
              <div style={{ marginTop: "1rem" }}>
                <Input label="VAT Registration Number" value={form.vat_registration} onChange={(e) => updateField("vat_registration", e.target.value)} />
              </div>
            </Card>
          </>
        )}

        {tab === "permissions" && isAdmin && (
          <Suspense fallback={<LoadingSpinner message="Loading permissions…" />}>
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
          </Suspense>
        )}

        {tab === "receipt" && (
          <div className="settings-receipt-layout">
            <Card className="settings-card settings-receipt-form">
              <h3 className="settings-section-title">Receipt Template</h3>
              <p className="settings-section-desc">
                Choose an invoice layout. The live preview updates as you tap a template.
                Click Save Settings to keep it.
              </p>

              <ReceiptTemplatePicker
                value={form.receipt_template}
                onSelect={handleSelectReceiptTemplate}
                disabled={saving}
                storeName={form.store_name}
                storeNameAr={form.store_name_ar}
              />

              <div style={{ marginTop: "1.25rem" }}>
                <Select
                  label="Print invoice after sale"
                  value={form.receipt_print_on_complete ? "1" : "0"}
                  onChange={(e) => updateField("receipt_print_on_complete", e.target.value === "1")}
                >
                  <option value="1">Yes — print automatically</option>
                  <option value="0">No — save only, do not print</option>
                </Select>
                <p className="settings-section-desc" style={{ marginTop: "0.5rem" }}>
                  Default for the Print invoice checkbox on the complete-sale popup. Cashiers can still
                  change it for a single sale. The order is always saved either way.
                </p>
              </div>

              {canUpdateInvoices && (
                <label className="settings-check settings-check--stacked" style={{ marginTop: "1.25rem" }}>
                  <span className="settings-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(form.invoice_update_existing)}
                      onChange={(e) => updateField("invoice_update_existing", e.target.checked)}
                    />
                    Update invoices already created
                  </span>
                  <small className="settings-check-hint">
                    When on, reprints of older invoices use the current receipt layout instead of the
                    layout saved with each sale.
                  </small>
                </label>
              )}

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
                <Select label="Paper width" value={form.receipt_paper_width} error={errors.receipt_paper_width} onChange={(e) => updateField("receipt_paper_width", e.target.value)}>
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
                  placeholder="Nexttel POS"
                />
              </div>
              <p className="settings-section-desc" style={{ marginTop: "1rem" }}>
                Store name, address, CR, and VAT are taken from the <strong>Store</strong> tab.
              </p>
            </Card>

            <ReceiptPreview form={form} />
          </div>
        )}

        {tab === "zatca" && (
          <ZatcaSettingsPanel
            form={form}
            updateField={updateField}
            baseSettings={settings}
            saveForm={async (merged) => {
              setSaving(true);
              setFeedback(null);
              try {
                return await persistForm(merged);
              } catch (err) {
                const message = formatDbError(err) || "Could not save settings. Try again.";
                setFeedback({ type: "error", title: "Could not save settings", message });
                notify.error(message, { title: "Could not save settings" });
                throw err;
              } finally {
                setSaving(false);
              }
            }}
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
              errors={errors}
              onChange={(next) => {
                formDirtyRef.current = true;
                setForm(next);
                setFeedback(null);
                setErrors({});
              }}
            />
          </Card>
        )}

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

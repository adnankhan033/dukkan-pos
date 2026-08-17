import { Card } from "../common/Card";
import ReceiptPreview from "./ReceiptPreview";
import { BUSINESS_TIMEZONES } from "../../utils/timezones";
import { getBusinessDateTimeLabelFromForm } from "../../utils/businessDate";
import { RECEIPT_SECTION_TOGGLES } from "../../utils/receiptSections";
import {
  ZATCA_ENVIRONMENT_LABELS,
  ZATCA_PHASE_LABELS,
  ZATCA_SETTING_KEYS as ZK,
  ZATCA_SYNC_SETTINGS,
} from "../../zatca/core/constants";
import { VENDOR_SETTING_KEYS } from "../../config/softwareVendor";
import { getMenuPermissionGroups, menuItemSettingKey, moduleSettingKey } from "../../utils/modules";

const RECEIPT_TEMPLATE_LABELS = {
  baqala: "Saudi Baqala (recommended)",
  classic: "Classic Thermal",
  compact: "Compact 58mm",
};

function boolLabel(on) {
  return on ? "Yes" : "No";
}

function ViewRow({ label, value, dir }) {
  const display = value == null || value === "" ? "—" : value;
  return (
    <div className="settings-view-row">
      <span className="settings-view-label">{label}</span>
      <span className="settings-view-value" dir={dir}>
        {display}
      </span>
    </div>
  );
}

function ViewCard({ title, desc, children, className = "" }) {
  return (
    <Card className={`settings-card ${className}`.trim()}>
      {title ? <h3 className="settings-section-title">{title}</h3> : null}
      {desc ? <p className="settings-section-desc">{desc}</p> : null}
      <div className="settings-view-grid">{children}</div>
    </Card>
  );
}

function timezoneLabel(id) {
  return BUSINESS_TIMEZONES.find((tz) => tz.id === id)?.label || id || "—";
}

function StoreTabView({ form }) {
  const businessTime = getBusinessDateTimeLabelFromForm(form);

  return (
    <>
      <ViewCard title="Store Information">
        <ViewRow label="Store name (English)" value={form.store_name} />
        <ViewRow label="Store name (Arabic)" value={form.store_name_ar} dir="rtl" />
        <ViewRow label="Address" value={form.store_address} />
        <ViewRow label="Phone" value={form.store_phone} />
        <ViewRow label="VAT %" value={form.vat_percent} />
        <ViewRow label="Currency" value={form.currency} />
        <ViewRow label="Prices include VAT" value={boolLabel(form.vat_included)} />
      </ViewCard>
      <ViewCard title="Business Region & Time">
        <ViewRow label="Region / timezone" value={timezoneLabel(form.business_timezone)} />
        <ViewRow label="Current business time" value={businessTime.datetime} />
        <ViewRow label="Fixed date" value={form.business_date_override || "Live clock"} />
        <ViewRow label="Fixed time" value={form.business_time_override || "Live clock"} />
      </ViewCard>
      <ViewCard title="Saudi Arabia — Tax & Compliance">
        <ViewRow label="CR number" value={form.cr_number} />
        <ViewRow label="VAT registration" value={form.vat_registration} />
      </ViewCard>
    </>
  );
}

function PermissionsTabView({ form }) {
  const groups = getMenuPermissionGroups({ includeAdmin: true });
  const disabledModules = groups.filter((g) => form[moduleSettingKey(g.module)] === false);
  const disabledItems = groups.flatMap((g) =>
    (g.items || [])
      .filter((item) => form[menuItemSettingKey(item.id)] === false)
      .map((item) => `${g.label} → ${item.label}`)
  );

  return (
    <>
      <ViewCard
        title="Menu visibility"
        desc="Store-wide module and page access. Disabled items are hidden from all roles."
      >
        <ViewRow label="Modules turned off" value={String(disabledModules.length)} />
        {disabledModules.length > 0 ? (
          <ViewRow
            label="Disabled modules"
            value={disabledModules.map((g) => g.label).join(", ")}
          />
        ) : null}
        {disabledItems.length > 0 ? (
          <ViewRow label="Disabled pages" value={disabledItems.join(" · ")} />
        ) : null}
      </ViewCard>
      <ViewCard title="Role permissions" desc="Administrator and Cashier menu overrides are configured in edit mode.">
        <ViewRow label="Status" value="Custom role permissions saved" />
      </ViewCard>
    </>
  );
}

function ReceiptTabView({ form }) {
  const enabledSections = RECEIPT_SECTION_TOGGLES.filter((t) => form[t.key]).map((t) => t.label);

  return (
    <div className="settings-receipt-layout">
      <ViewCard title="Receipt template" className="settings-receipt-form">
        <ViewRow
          label="Template"
          value={RECEIPT_TEMPLATE_LABELS[form.receipt_template] || form.receipt_template}
        />
        <ViewRow label="Paper width" value={form.receipt_paper_width === "58" ? "58mm" : "80mm"} />
        <ViewRow label="Header note" value={form.receipt_header_note} />
        <ViewRow label="Footer (English)" value={form.receipt_footer} />
        <ViewRow label="Footer (Arabic)" value={form.receipt_footer_ar} dir="rtl" />
        <ViewRow label="Powered by" value={form.receipt_branding} />
        <ViewRow label="Bilingual (EN + AR)" value={boolLabel(form.receipt_show_bilingual)} />
        <ViewRow
          label="Visible sections"
          value={enabledSections.length ? enabledSections.join(", ") : "None selected"}
        />
      </ViewCard>
      <ReceiptPreview form={form} readOnly />
    </div>
  );
}

function ZatcaTabView({ form }) {
  const phase = form[ZK.ACTIVE_PHASE];
  const env = form[ZK.ENVIRONMENT];

  return (
    <ViewCard
      title="ZATCA e-invoicing"
      desc="Saudi e-invoice integration status. Use Edit to run setup, certificates, and sync."
    >
      <ViewRow label="Status" value={ZATCA_PHASE_LABELS[phase] || phase || "Disabled"} />
      <ViewRow label="Environment" value={ZATCA_ENVIRONMENT_LABELS[env] || env || "—"} />
      <ViewRow label="Device ID" value={form[ZK.DEVICE_ID]} />
      <ViewRow label="Company (EN)" value={form[ZK.COMPANY_NAME] || form.store_name} />
      <ViewRow label="VAT number" value={form[ZK.VAT_NUMBER] || form.vat_registration} />
      <ViewRow label="Auto sync" value={boolLabel(form[ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED] === "1")} />
    </ViewCard>
  );
}

function DashboardTabView({ form }) {
  return (
    <ViewCard title="Dashboard customization">
      <ViewRow label="Admin — show monthly profit" value={boolLabel(form.dashboard_admin_show_profit)} />
      <ViewRow label="Admin — show today's purchases" value={boolLabel(form.dashboard_admin_show_purchases)} />
      <ViewRow label="Cashier — show recent sales" value={boolLabel(form.dashboard_cashier_show_recent)} />
    </ViewCard>
  );
}

function VendorTabView({ form }) {
  return (
    <ViewCard title="Software vendor branding">
      <ViewRow label="Show in sidebar" value={boolLabel(form[VENDOR_SETTING_KEYS.ENABLED] !== "0")} />
      <ViewRow label="Menu label" value={form[VENDOR_SETTING_KEYS.MENU_LABEL]} />
      <ViewRow label="Company (English)" value={form[VENDOR_SETTING_KEYS.COMPANY_NAME]} />
      <ViewRow label="Company (Arabic)" value={form[VENDOR_SETTING_KEYS.COMPANY_NAME_AR]} dir="rtl" />
      <ViewRow label="Website" value={form[VENDOR_SETTING_KEYS.WEBSITE]} />
      <ViewRow label="Support email" value={form[VENDOR_SETTING_KEYS.EMAIL]} />
      <ViewRow label="Phone" value={form[VENDOR_SETTING_KEYS.PHONE]} />
    </ViewCard>
  );
}

export default function SettingsTabView({ tab, form, isAdmin }) {
  switch (tab) {
    case "store":
      return <StoreTabView form={form} />;
    case "permissions":
      return isAdmin ? <PermissionsTabView form={form} /> : null;
    case "receipt":
      return <ReceiptTabView form={form} />;
    case "zatca":
      return <ZatcaTabView form={form} />;
    case "dashboard":
      return <DashboardTabView form={form} />;
    case "vendor":
      return isAdmin ? <VendorTabView form={form} /> : null;
    default:
      return null;
  }
}

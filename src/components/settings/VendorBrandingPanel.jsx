import { Input, Textarea } from "../common/Input";
import { VENDOR_SETTING_KEYS } from "../../config/softwareVendor";
import { PHONE_PLACEHOLDER } from "../../utils/constants";

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="vendor-settings-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="vendor-settings-toggle-body">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export default function VendorBrandingPanel({ form, errors = {}, onChange }) {
  function set(key, value) {
    onChange({ ...form, [key]: value });
  }

  function setBool(key, checked) {
    set(key, checked ? "1" : "0");
  }

  return (
    <div className="vendor-settings">
      <p className="settings-section-desc">
        Show your software company in the sidebar with a highlighted menu item. Store staff can
        tap it to see who built and supports this POS system.
      </p>

      <ToggleRow
        label="Show vendor branding"
        hint="Display the sidebar menu item and popup"
        checked={form[VENDOR_SETTING_KEYS.ENABLED] !== "0"}
        onChange={(v) => setBool(VENDOR_SETTING_KEYS.ENABLED, v)}
      />
      <ToggleRow
        label="Sidebar highlight pulse"
        hint="Soft glowing animation on the menu item"
        checked={form[VENDOR_SETTING_KEYS.SIDEBAR_PULSE] !== "0"}
        onChange={(v) => setBool(VENDOR_SETTING_KEYS.SIDEBAR_PULSE, v)}
      />

      <div className="vendor-settings-grid">
        <Input
          label="Sidebar menu label"
          value={form[VENDOR_SETTING_KEYS.MENU_LABEL] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.MENU_LABEL, e.target.value)}
          placeholder="e.g. Acme Software"
        />
        <Input
          label="Company name (English) *"
          value={form[VENDOR_SETTING_KEYS.COMPANY_NAME] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.COMPANY_NAME, e.target.value)}
          placeholder="Your software company name"
          error={errors[VENDOR_SETTING_KEYS.COMPANY_NAME]}
        />
        <Input
          label="Company name (Arabic)"
          value={form[VENDOR_SETTING_KEYS.COMPANY_NAME_AR] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.COMPANY_NAME_AR, e.target.value)}
          dir="rtl"
        />
        <Input
          label="Tagline (English)"
          value={form[VENDOR_SETTING_KEYS.TAGLINE] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.TAGLINE, e.target.value)}
        />
        <Input
          label="Tagline (Arabic)"
          value={form[VENDOR_SETTING_KEYS.TAGLINE_AR] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.TAGLINE_AR, e.target.value)}
          dir="rtl"
        />
        <Input
          label="Website"
          value={form[VENDOR_SETTING_KEYS.WEBSITE] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.WEBSITE, e.target.value)}
          placeholder="https://yourcompany.com"
        />
        <Input
          label="Email"
          type="email"
          value={form[VENDOR_SETTING_KEYS.EMAIL] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.EMAIL, e.target.value)}
          error={errors[VENDOR_SETTING_KEYS.EMAIL]}
        />
        <Input
          label="Phone"
          value={form[VENDOR_SETTING_KEYS.PHONE] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.PHONE, e.target.value)}
        />
        <Input
          label="WhatsApp"
          value={form[VENDOR_SETTING_KEYS.WHATSAPP] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.WHATSAPP, e.target.value)}
          placeholder={PHONE_PLACEHOLDER}
        />
        <Input
          label="Address"
          value={form[VENDOR_SETTING_KEYS.ADDRESS] || ""}
          onChange={(e) => set(VENDOR_SETTING_KEYS.ADDRESS, e.target.value)}
        />
      </div>

      <Textarea
        label="Support message"
        value={form[VENDOR_SETTING_KEYS.SUPPORT_MESSAGE] || ""}
        onChange={(e) => set(VENDOR_SETTING_KEYS.SUPPORT_MESSAGE, e.target.value)}
        rows={3}
      />
      <Input
        label="Copyright line (optional)"
        value={form[VENDOR_SETTING_KEYS.COPYRIGHT] || ""}
        onChange={(e) => set(VENDOR_SETTING_KEYS.COPYRIGHT, e.target.value)}
        placeholder="© 2026 Your Company. All rights reserved."
      />
    </div>
  );
}

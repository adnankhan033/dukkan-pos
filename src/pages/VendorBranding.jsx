import { useEffect, useRef, useState } from "react";
import { Eye, RotateCcw, Save } from "lucide-react";
import { settingsService } from "../services/SettingsService";
import { useSettingsStore } from "../contexts/store";
import { usePermissions } from "../hooks/usePermissions";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Alert } from "../components/common/Loading";
import VendorBrandingPanel from "../components/settings/VendorBrandingPanel";
import SidebarVendorCard from "../components/layout/SidebarVendorCard";
import SoftwareVendorModal from "../components/vendor/SoftwareVendorModal";
import { VENDOR_DEFAULT_SETTINGS, VENDOR_SETTING_KEY_LIST } from "../config/softwareVendor";
import { resolveSoftwareVendor } from "../utils/softwareVendor";
import { notify } from "../utils/notify";
import "./VendorBranding.css";

function buildVendorForm(settings) {
  const form = {};
  for (const key of VENDOR_SETTING_KEY_LIST) {
    form[key] = settings[key] ?? VENDOR_DEFAULT_SETTINGS[key] ?? "";
  }
  return form;
}

export default function VendorBrandingPage() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { isAdmin } = usePermissions();
  const [form, setForm] = useState(() => buildVendorForm(settings));
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (dirtyRef.current) return;
    setForm(buildVendorForm(settings));
  }, [settings]);

  const previewSettings = { ...settings, ...form };
  const previewVendor = resolveSoftwareVendor(previewSettings);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      for (const key of VENDOR_SETTING_KEY_LIST) {
        payload[key] = String(form[key] ?? "");
      }
      const updated = await settingsService.updateMany(payload);
      setSettings(updated);
      setForm(buildVendorForm(updated));
      dirtyRef.current = false;
      notify.success("Vendor branding updated across the app.", { title: "Saved" });
    } catch (err) {
      notify.error(err.message || "Could not save vendor branding.", { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(buildVendorForm(VENDOR_DEFAULT_SETTINGS));
    dirtyRef.current = true;
  }

  if (!isAdmin) {
    return <Alert type="error">Only administrators can manage vendor branding.</Alert>;
  }

  return (
    <div className="vendor-branding-page">
      <PageHeader
        title="Vendor Branding"
        subtitle="Full control over your software company profile, sidebar highlight, and popup."
      />

      <div className="vendor-branding-layout">
        <form className="vendor-branding-form" onSubmit={handleSave}>
          <Card className="vendor-branding-card">
            <VendorBrandingPanel
              form={form}
              onChange={(next) => {
                dirtyRef.current = true;
                setForm(next);
              }}
            />
          </Card>

          <div className="vendor-branding-actions">
            <Button type="button" variant="secondary" onClick={handleReset}>
              <RotateCcw size={16} /> Reset defaults
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : (
                <>
                  <Save size={16} /> Save vendor branding
                </>
              )}
            </Button>
          </div>
        </form>

        <aside className="vendor-branding-preview">
          <Card className="vendor-branding-preview-card">
            <h3 className="vendor-branding-preview-title">Live preview</h3>
            <p className="vendor-branding-preview-desc">
              How the highlighted sidebar items will look for your team.
            </p>

            <div className="vendor-branding-preview-sidebar">
              <p className="vendor-branding-preview-label">Partner card (all users)</p>
              <SidebarVendorCard
                vendor={previewVendor}
                variant="partner"
                onClick={() => setPreviewOpen(true)}
              />
            </div>

            <div className="vendor-branding-preview-sidebar admin">
              <p className="vendor-branding-preview-label">Admin editor link</p>
              <SidebarVendorCard vendor={previewVendor} variant="admin" onClick={() => {}} />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="vendor-branding-preview-btn"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye size={16} /> Preview popup
            </Button>
          </Card>
        </aside>
      </div>

      <SoftwareVendorModal
        vendor={previewVendor}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}

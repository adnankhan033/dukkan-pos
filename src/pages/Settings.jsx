import { useState } from "react";
import { settingsService } from "../services/SettingsService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input, Textarea } from "../components/common/Input";
import { Alert } from "../components/common/Loading";

export default function Settings() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [form, setForm] = useState({
    store_name: settings.store_name || "",
    store_address: settings.store_address || "",
    vat_percent: settings.vat_percent || "15",
    currency: settings.currency || "SAR",
    receipt_footer: settings.receipt_footer || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    try {
      const updated = await settingsService.updateMany(form);
      setSettings(updated);
      setMessage("Settings saved successfully");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure store information and receipt preferences." />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Card style={{ maxWidth: "600px" }}>
        <form onSubmit={handleSave}>
          <Input label="Store Name" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Store Address" value={form.store_address} onChange={(e) => setForm({ ...form, store_address: e.target.value })} />
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <Input label="VAT %" type="number" step="0.01" value={form.vat_percent} onChange={(e) => setForm({ ...form, vat_percent: e.target.value })} />
            <Input label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Receipt Footer" value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} />
          </div>
          <Button type="submit" style={{ marginTop: "1.5rem" }}>Save Settings</Button>
        </form>
      </Card>
    </div>
  );
}

// 


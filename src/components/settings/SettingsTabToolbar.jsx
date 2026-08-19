import { Loader2, Pencil } from "lucide-react";
import Button from "../common/Button";

export default function SettingsTabToolbar({
  isEditing,
  onEdit,
  onCancel,
  onSave,
  saveLabel = "Save Settings",
  saving = false,
}) {
  if (isEditing) {
    return (
      <div className="settings-tab-toolbar settings-tab-toolbar--edit">
        <p className="settings-tab-toolbar-hint">
          {saving
            ? "Saving your changes…"
            : "You are editing this section. Save or cancel your changes."}
        </p>
        <div className="settings-tab-toolbar-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : null}
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-tab-toolbar">
      <p className="settings-tab-toolbar-hint">Review your configuration below. Click Edit to make changes.</p>
      <Button type="button" variant="secondary" onClick={onEdit}>
        <Pencil size={14} /> Edit
      </Button>
    </div>
  );
}

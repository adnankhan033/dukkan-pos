import { Pencil } from "lucide-react";
import Button from "../common/Button";

export default function SettingsTabToolbar({ isEditing, onEdit, onCancel, onSave, saveLabel = "Save Settings" }) {
  if (isEditing) {
    return (
      <div className="settings-tab-toolbar settings-tab-toolbar--edit">
        <p className="settings-tab-toolbar-hint">You are editing this section. Save or cancel your changes.</p>
        <div className="settings-tab-toolbar-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            {saveLabel}
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

import { roleActionSettingKey } from "../../utils/actions";

export default function ActionPermissionList({ actionsByGroup, form, updateField, role }) {
  return (
    <div className="settings-action-list">
      {[...actionsByGroup.entries()].map(([group, actions]) => (
        <div key={group} className="settings-action-group">
          <h4 className="settings-action-group-title">{group}</h4>
          {actions.map((action) => {
            const key = roleActionSettingKey(role, action.id);
            return (
              <label key={action.id} className="settings-check settings-check-block">
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => updateField(key, e.target.checked)}
                />
                <span>
                  <strong>{action.label}</strong>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

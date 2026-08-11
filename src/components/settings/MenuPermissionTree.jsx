import {
  moduleSettingKey,
  roleModuleSettingKey,
  menuItemSettingKey,
  roleMenuItemSettingKey,
} from "../../utils/modules";

function getParentKey(scope, role, moduleId) {
  if (scope === "global") return moduleSettingKey(moduleId);
  return roleModuleSettingKey(role, moduleId);
}

function getChildKey(scope, role, menuItemId) {
  if (scope === "global") return menuItemSettingKey(menuItemId);
  return roleMenuItemSettingKey(role, menuItemId);
}

export default function MenuPermissionTree({
  groups,
  form,
  updateField,
  scope = "global",
  role = null,
}) {
  return (
    <div className="settings-menu-tree">
      {groups.map((group) => {
        const parentKey = getParentKey(scope, role, group.module);
        const parentEnabled = form[parentKey] !== false;
        const showChildren =
          group.items.length > 1 || group.items.some((item) => item.id !== group.module);

        return (
          <div key={group.id} className="settings-menu-group">
            <label className="settings-check settings-check-block settings-menu-parent">
              <input
                type="checkbox"
                checked={!!form[parentKey]}
                onChange={(e) => updateField(parentKey, e.target.checked)}
              />
              <span>
                <strong>{group.label}</strong>
                {group.description ? <small>{group.description}</small> : null}
              </span>
            </label>

            {showChildren ? (
              <div className={`settings-menu-children${parentEnabled ? "" : " is-disabled"}`}>
                {group.items.map((item) => {
                  const childKey = getChildKey(scope, role, item.id);
                  return (
                    <label key={item.id} className="settings-check settings-check-block settings-menu-child">
                      <input
                        type="checkbox"
                        checked={!!form[childKey]}
                        disabled={!parentEnabled}
                        onChange={(e) => updateField(childKey, e.target.checked)}
                      />
                      <span>
                        <strong>{item.label}</strong>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

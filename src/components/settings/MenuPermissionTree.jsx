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

function shouldShowChildren(group) {
  if (group.items.length > 1) return true;
  if (group.items.length === 1 && group.items[0].id !== group.id) return true;
  return false;
}

export default function MenuPermissionTree({
  groups,
  form,
  updateField,
  updateFields,
  scope = "global",
  role = null,
  lockModuleIds = [],
}) {
  function isModuleLocked(moduleId) {
    return lockModuleIds.includes(moduleId);
  }

  function toggleParent(group, checked) {
    const parentKey = getParentKey(scope, role, group.module);
    const patch = { [parentKey]: checked };

    if (shouldShowChildren(group)) {
      for (const item of group.items) {
        patch[getChildKey(scope, role, item.id)] = checked;
      }
    }

    if (updateFields) {
      updateFields(patch);
      return;
    }

    for (const [key, value] of Object.entries(patch)) {
      updateField(key, value);
    }
  }

  function toggleChild(group, itemId, checked) {
    const childKey = getChildKey(scope, role, itemId);
    updateField(childKey, checked);

    if (!checked) return;

    const parentKey = getParentKey(scope, role, group.module);
    if (!form[parentKey]) {
      updateField(parentKey, true);
    }
  }

  return (
    <div className="settings-menu-tree">
      {groups.map((group) => {
        const parentKey = getParentKey(scope, role, group.module);
        const parentEnabled = !!form[parentKey];
        const locked = isModuleLocked(group.module);
        const showChildren = shouldShowChildren(group);
        const enabledChildren = showChildren
          ? group.items.filter((item) => !!form[getChildKey(scope, role, item.id)]).length
          : 0;

        return (
          <div key={group.id} className={`settings-menu-group${parentEnabled ? " is-open" : ""}`}>
            <div className="settings-menu-group-head">
              <label className={`settings-check settings-check-block settings-menu-parent${locked ? " is-locked" : ""}`}>
                <input
                  type="checkbox"
                  checked={parentEnabled}
                  disabled={locked}
                  onChange={(e) => toggleParent(group, e.target.checked)}
                />
                <span className="settings-menu-parent-text">
                  <strong>{group.label}</strong>
                  {group.description ? <small>{group.description}</small> : null}
                </span>
              </label>
              {showChildren ? (
                <span className="settings-menu-count">
                  {enabledChildren}/{group.items.length}
                </span>
              ) : null}
            </div>

            {showChildren ? (
              <div className={`settings-menu-children${parentEnabled && !locked ? "" : " is-disabled"}`}>
                {group.items.map((item) => {
                  const childKey = getChildKey(scope, role, item.id);
                  return (
                    <label
                      key={item.id}
                      className={`settings-check settings-check-block settings-menu-child${locked ? " is-locked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!form[childKey]}
                        disabled={locked || !parentEnabled}
                        onChange={(e) => toggleChild(group, item.id, e.target.checked)}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.path}</small>
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

import { useMemo, useState, memo } from "react";
import { Shield, Users, RotateCcw } from "lucide-react";
import { Card } from "../common/Card";
import Button from "../common/Button";
import { Alert } from "../common/Loading";
import MenuPermissionTree from "./MenuPermissionTree";
import ActionPermissionList from "./ActionPermissionList";
import { getMenuPermissionGroups } from "../../utils/modules";
import { getActionsByGroup, getAllPermissionSettingKeys, getRoleActionDefaults } from "../../utils/actions";
import {
  getModuleDefaults,
  getRoleModuleDefaults,
  getMenuItemDefaults,
  getRoleMenuItemDefaults,
} from "../../utils/modules";
import { ROLES, ROLE_LABELS } from "../../utils/roles";

const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.CASHIER];

function buildPermissionDefaults() {
  return {
    ...getModuleDefaults(),
    ...getRoleModuleDefaults(),
    ...getMenuItemDefaults(),
    ...getRoleMenuItemDefaults(),
    ...getRoleActionDefaults(),
  };
}

function defaultsToForm(defaults) {
  const form = {};
  for (const key of getAllPermissionSettingKeys()) {
    const value = defaults[key];
    form[key] = value !== "0" && value !== "false";
  }
  return form;
}

function PermissionsPanel({ form, updateField, updateFields, onResetRole }) {
  const [activeRole, setActiveRole] = useState(ROLES.CASHIER);
  const globalGroups = useMemo(() => getMenuPermissionGroups({ includeAdmin: false }), []);
  const roleGroups = useMemo(() => getMenuPermissionGroups({ includeAdmin: true }), []);
  const actionsByGroup = useMemo(() => getActionsByGroup(), []);

  function handleResetDefaults() {
    const defaults = buildPermissionDefaults();
    const patch = defaultsToForm(defaults);
    updateFields(patch);
  }

  function handleResetRole(role) {
    const defaults = buildPermissionDefaults();
    const patch = {};
    for (const key of getAllPermissionSettingKeys()) {
      if (key.includes(`role_${role}_`)) {
        patch[key] = defaults[key] !== "0" && defaults[key] !== "false";
      }
    }
    updateFields(patch);
    onResetRole?.(role);
  }

  return (
    <>
      <Card className="settings-card settings-permissions-card">
        <div className="settings-permissions-header">
          <div>
            <h3 className="settings-section-title">
              <Shield size={18} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
              Menu visibility (store-wide)
            </h3>
            <p className="settings-section-desc">
              Turn modules and pages on or off for the whole store. Disabled items are hidden from every role.
            </p>
          </div>
        </div>
        <MenuPermissionTree
          groups={globalGroups}
          form={form}
          updateField={updateField}
          updateFields={updateFields}
          scope="global"
        />
      </Card>

      <Card className="settings-card settings-permissions-card">
        <div className="settings-permissions-header">
          <div>
            <h3 className="settings-section-title">
              <Users size={18} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
              Role access
            </h3>
            <p className="settings-section-desc">
              Choose what each role can see in the sidebar. Parent items control whole sections; child items control individual pages.
            </p>
          </div>
          <div className="settings-role-tabs">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                className={`settings-role-tab${activeRole === role ? " active" : ""}`}
                onClick={() => setActiveRole(role)}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        {activeRole === ROLES.CASHIER && (
          <Alert type="info" title="Cashier limits">
            Users and Settings stay admin-only. Cashiers never see Administration pages even if checked here.
          </Alert>
        )}

        {activeRole === ROLES.ADMIN && (
          <Alert type="info" title="Administrator">
            Administrators always have full action permissions (create, edit, delete). Menu access can still be customized below.
          </Alert>
        )}

        <MenuPermissionTree
          groups={roleGroups}
          form={form}
          updateField={updateField}
          updateFields={updateFields}
          scope="role"
          role={activeRole}
          lockModuleIds={activeRole === ROLES.CASHIER ? ["users", "settings"] : []}
        />

        <div className="settings-permissions-actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => handleResetRole(activeRole)}>
            <RotateCcw size={14} />
            Reset {ROLE_LABELS[activeRole]} to defaults
          </Button>
        </div>
      </Card>

      <Card className="settings-card settings-permissions-card">
        <h3 className="settings-section-title">Cashier actions</h3>
        <p className="settings-section-desc">
          Fine-grained permissions for what cashiers can do inside allowed pages (create products, manage customers, etc.).
        </p>
        <ActionPermissionList
          actionsByGroup={actionsByGroup}
          form={form}
          updateField={updateField}
          role={ROLES.CASHIER}
        />
      </Card>

      <div className="settings-permissions-footer">
        <Button type="button" variant="secondary" onClick={handleResetDefaults}>
          <RotateCcw size={16} />
          Reset all permissions to defaults
        </Button>
      </div>
    </>
  );
}

export default memo(PermissionsPanel);

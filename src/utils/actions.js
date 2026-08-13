import { ROLES, isAdmin, normalizeRole } from "./roles";
import {
  MODULES,
  ADMIN_MODULES,
  MENU_ITEMS,
  moduleSettingKey,
  roleModuleSettingKey,
  menuItemSettingKey,
  roleMenuItemSettingKey,
} from "./modules";

/** Action permissions — keys match Drupal PosPermissionRegistry. */
export const ACTIONS = [
  { id: "products_create", module: "products", label: "Create products", group: "Products" },
  { id: "products_edit", module: "products", label: "Edit products", group: "Products" },
  { id: "products_delete", module: "products", label: "Delete products", group: "Products" },
  { id: "categories_manage", module: "products", label: "Manage categories", group: "Products" },
  { id: "units_manage", module: "products", label: "Manage units", group: "Products" },
  { id: "inventory_adjust", module: "inventory", label: "Adjust stock", group: "Inventory" },
  { id: "customers_manage", module: "customers", label: "Manage customers", group: "Customers" },
  { id: "suppliers_manage", module: "suppliers", label: "Manage suppliers", group: "Suppliers" },
  { id: "purchases_manage", module: "suppliers", label: "Manage purchases", group: "Suppliers" },
  { id: "accounting_manage", module: "accounting", label: "Manage accounting", group: "Accounting" },
  { id: "users_manage", module: "users", label: "Manage users", group: "Administration" },
  { id: "settings_manage", module: "settings", label: "Manage settings", group: "Administration" },
];

export function roleActionSettingKey(role, actionId) {
  return `role_${role}_action_${actionId}`;
}

export function canPerformAction(user, settings, actionId) {
  if (!user || !actionId) return false;
  if (isAdmin(user)) return true;

  const role = normalizeRole(user.role);
  if (role !== ROLES.CASHIER) return false;

  const key = roleActionSettingKey(role, actionId);
  const value = settings?.[key];
  if (value === undefined || value === "") return false;
  return value === "1" || value === "true";
}

export function getRoleActionDefaults() {
  const defaults = {};
  for (const action of ACTIONS) {
    defaults[roleActionSettingKey(ROLES.ADMIN, action.id)] = "1";
    defaults[roleActionSettingKey(ROLES.CASHIER, action.id)] = "0";
  }
  return defaults;
}

export function getActionsByGroup() {
  const groups = new Map();
  for (const action of ACTIONS) {
    if (!groups.has(action.group)) {
      groups.set(action.group, []);
    }
    groups.get(action.group).push(action);
  }
  return groups;
}

/** Keys stored in settings for permissions (modules, menus, actions). */
export function getAllPermissionSettingKeys() {
  const keys = [];
  for (const mod of MODULES) {
    keys.push(moduleSettingKey(mod.id));
  }
  for (const item of MENU_ITEMS) {
    keys.push(menuItemSettingKey(item.id));
  }
  for (const mod of [...MODULES, ...ADMIN_MODULES]) {
    keys.push(roleModuleSettingKey(ROLES.ADMIN, mod.id));
    keys.push(roleModuleSettingKey(ROLES.CASHIER, mod.id));
  }
  for (const item of MENU_ITEMS) {
    keys.push(roleMenuItemSettingKey(ROLES.ADMIN, item.id));
    keys.push(roleMenuItemSettingKey(ROLES.CASHIER, item.id));
  }
  for (const action of ACTIONS) {
    keys.push(roleActionSettingKey(ROLES.ADMIN, action.id));
    keys.push(roleActionSettingKey(ROLES.CASHIER, action.id));
  }
  return keys;
}

export function extractPermissionSettings(payload) {
  const keys = getAllPermissionSettingKeys();
  const result = {};
  for (const key of keys) {
    if (payload[key] !== undefined) {
      result[key] = payload[key];
    }
  }
  return result;
}

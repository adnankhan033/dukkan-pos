import { ROLES, isAdmin, normalizeRole, ALL_ROLES } from "./roles";
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
  {
    id: "invoices_update",
    module: "sales",
    label: "Update created invoices",
    group: "Sales",
    description: "Show Update on Orders so this role can change invoices after they are created.",
  },
  {
    id: "sales_override_price",
    module: "sales",
    label: "Change price on this sale only",
    group: "Sales",
    description: "Let this role set a temporary product price while creating an order. The catalog price is not changed.",
  },
  { id: "customers_manage", module: "customers", label: "Manage customers", group: "Customers" },
  { id: "suppliers_manage", module: "suppliers", label: "Manage suppliers", group: "Suppliers" },
  { id: "purchases_manage", module: "purchasing", label: "Manage purchases", group: "Purchasing" },
  { id: "accounting_manage", module: "expenses", label: "Manage expenses", group: "Accounting" },
  { id: "accounting_journals", module: "accounting", label: "Post and reverse journals", group: "Accounting" },
  { id: "accounting_partners", module: "partners", label: "Manage partners and capital", group: "Accounting" },
  { id: "accounting_close_period", module: "accounting", label: "Close fiscal periods", group: "Accounting" },
  { id: "modules_install", module: "settings", label: "Install modules", group: "Modules" },
  { id: "modules_configure", module: "settings", label: "Configure modules", group: "Modules" },
  { id: "modules_enable", module: "settings", label: "Enable modules", group: "Modules" },
  { id: "modules_disable", module: "settings", label: "Disable modules", group: "Modules" },
  { id: "modules_uninstall", module: "settings", label: "Uninstall modules", group: "Modules" },
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
  const key = roleActionSettingKey(role, actionId);
  const value = settings?.[key];
  if (value === undefined || value === "") return false;
  return value === "1" || value === "true";
}

export function getRoleActionDefaults() {
  const defaults = {};
  for (const action of ACTIONS) {
    for (const role of ALL_ROLES) {
      defaults[roleActionSettingKey(role, action.id)] = role === ROLES.ADMIN ? "1" : "0";
    }
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
    for (const role of ALL_ROLES) {
      keys.push(roleModuleSettingKey(role, mod.id));
    }
  }
  for (const item of MENU_ITEMS) {
    for (const role of ALL_ROLES) {
      keys.push(roleMenuItemSettingKey(role, item.id));
    }
  }
  for (const action of ACTIONS) {
    for (const role of ALL_ROLES) {
      keys.push(roleActionSettingKey(role, action.id));
    }
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

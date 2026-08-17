import { ROLES, ROLE_MODULES } from "./roles";
import { NAV_GROUPS } from "./nav";

export const MODULES = [
  { id: "dashboard", label: "Dashboard", description: "Home dashboard and stats" },
  { id: "sales", label: "Sales", description: "POS checkout and orders" },
  { id: "products", label: "Products", description: "Products, categories, units" },
  { id: "inventory", label: "Inventory", description: "Stock and purchases" },
  { id: "customers", label: "Customers", description: "Customer management" },
  { id: "suppliers", label: "Suppliers", description: "Supplier accounts, purchases, and balances" },
  { id: "accounting", label: "Accounting", description: "Expenses, salaries, bills" },
  { id: "reports", label: "Reports", description: "Sales and profit reports" },
];

export const ADMIN_MODULES = [
  { id: "users", label: "User Management", description: "Manage administrators and cashiers" },
  { id: "settings", label: "Settings", description: "Store and system configuration" },
];

export const ROUTE_MODULE_MAP = {
  "/": "dashboard",
  "/sales": "sales",
  "/orders": "sales",
  "/zatca-sync": "sales",
  "/products": "products",
  "/categories": "products",
  "/units": "products",
  "/inventory": "inventory",
  "/purchases": "suppliers",
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/accounting": "accounting",
  "/employees": "accounting",
  "/expenses": "accounting",
  "/reports": "reports",
  "/daily-close": "reports",
  "/cloud-backup": "settings",
  "/subscriptions": "users",
  "/users": "users",
  "/settings": "settings",
  "/zatca-queue": "settings",
  "/zatca-test": "settings",
};

const CASHIER_DEFAULT_MODULES = ["dashboard", "sales", "reports"];
const ADMIN_ONLY_MODULE_IDS = new Set(["users", "settings"]);
const ADMIN_GROUP_ID = "administration";

function flattenMenuItems() {
  const items = [];
  for (const group of NAV_GROUPS) {
    if (group.items?.length) {
      for (const item of group.items) {
        items.push({
          id: item.id,
          label: item.label,
          path: item.path,
          module: item.module || group.module,
          groupId: group.id,
          groupLabel: group.label,
        });
      }
    } else if (group.path) {
      items.push({
        id: group.id,
        label: group.label,
        path: group.path,
        module: group.module,
        groupId: group.id,
        groupLabel: group.label,
      });
    }
  }
  return items;
}

export const MENU_ITEMS = flattenMenuItems();

export const MENU_ITEM_BY_ID = new Map(MENU_ITEMS.map((item) => [item.id, item]));

export const ROUTE_MENU_ITEM_MAP = Object.fromEntries(
  MENU_ITEMS.map((item) => [item.path, item.id])
);

export function getMenuPermissionGroups({ includeAdmin = false } = {}) {
  return NAV_GROUPS.filter((group) => includeAdmin || group.id !== ADMIN_GROUP_ID).map((group) => ({
    id: group.id,
    label: group.label,
    module: group.module,
    description:
      MODULES.find((mod) => mod.id === group.module)?.description ||
      ADMIN_MODULES.find((mod) => mod.id === group.module)?.description ||
      "",
    items: group.items?.length
      ? group.items.map((item) => ({
          id: item.id,
          label: item.label,
          path: item.path,
          module: item.module || group.module,
        }))
      : [{ id: group.id, label: group.label, path: group.path, module: group.module }],
  }));
}

/** Collapse nav groups into one row per module with all menu items as children. */
export function getMenuPermissionGroupsByModule({ includeAdmin = false } = {}) {
  const navGroups = getMenuPermissionGroups({ includeAdmin });
  const byModule = new Map();

  for (const group of navGroups) {
    for (const item of group.items) {
      const modId = item.module;
      if (!byModule.has(modId)) {
        const modInfo = MODULES.find((mod) => mod.id === modId) || ADMIN_MODULES.find((mod) => mod.id === modId);
        byModule.set(modId, {
          id: modId,
          label: modInfo?.label || group.label,
          module: modId,
          description: modInfo?.description || group.description || "",
          items: [],
        });
      }
      const bucket = byModule.get(modId);
      if (!bucket.items.some((existing) => existing.id === item.id)) {
        bucket.items.push(item);
      }
    }
  }

  const order = [...MODULES.map((mod) => mod.id), ...ADMIN_MODULES.map((mod) => mod.id)];
  return order.filter((id) => byModule.has(id)).map((id) => byModule.get(id));
}

export function moduleSettingKey(moduleId) {
  return `module_${moduleId}_enabled`;
}

export function roleModuleSettingKey(role, moduleId) {
  return `role_${role}_module_${moduleId}`;
}

export function menuItemSettingKey(menuItemId) {
  return `menu_${menuItemId}_enabled`;
}

export function roleMenuItemSettingKey(role, menuItemId) {
  return `role_${role}_menu_${menuItemId}`;
}

export function isModuleEnabled(settings, moduleId) {
  const key = moduleSettingKey(moduleId);
  const value = settings?.[key];
  if (value === undefined || value === "") return true;
  return value === "1" || value === "true";
}

function defaultRoleModuleEnabled(role, moduleId) {
  if (role === ROLES.ADMIN) {
    if (ADMIN_ONLY_MODULE_IDS.has(moduleId)) return true;
    return (ROLE_MODULES[ROLES.ADMIN] || []).includes(moduleId);
  }
  return CASHIER_DEFAULT_MODULES.includes(moduleId);
}

export function isRoleModuleEnabled(settings, role, moduleId) {
  if (role === ROLES.CASHIER && ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
    return false;
  }

  const key = roleModuleSettingKey(role, moduleId);
  const value = settings?.[key];
  if (value === undefined || value === "") {
    return defaultRoleModuleEnabled(role, moduleId);
  }
  return value === "1" || value === "true";
}

export function isMenuItemEnabled(settings, menuItemId) {
  const key = menuItemSettingKey(menuItemId);
  const value = settings?.[key];
  if (value === undefined || value === "") return true;
  return value === "1" || value === "true";
}

function defaultRoleMenuItemEnabled(role, menuItemId) {
  const item = MENU_ITEM_BY_ID.get(menuItemId);
  if (!item) return false;
  if (role === ROLES.CASHIER && ADMIN_ONLY_MODULE_IDS.has(item.module)) return false;
  return defaultRoleModuleEnabled(role, item.module);
}

export function isRoleMenuItemEnabled(settings, role, menuItemId) {
  const item = MENU_ITEM_BY_ID.get(menuItemId);
  if (!item) return false;

  if (role === ROLES.CASHIER && ADMIN_ONLY_MODULE_IDS.has(item.module)) {
    return false;
  }

  const key = roleMenuItemSettingKey(role, menuItemId);
  const value = settings?.[key];
  if (value === undefined || value === "") {
    return defaultRoleMenuItemEnabled(role, menuItemId);
  }
  return value === "1" || value === "true";
}

export function canAccessModule(user, settings, moduleId) {
  if (!user || !moduleId) return false;

  const role = String(user.role || "").toLowerCase() === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;

  if (ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
    return role === ROLES.ADMIN && isRoleModuleEnabled(settings, role, moduleId);
  }

  if (!isModuleEnabled(settings, moduleId)) return false;
  return isRoleModuleEnabled(settings, role, moduleId);
}

export function canAccessMenuItem(user, settings, menuItemId) {
  if (!user || !menuItemId) return false;

  const item = MENU_ITEM_BY_ID.get(menuItemId);
  if (!item) return false;

  if (!canAccessModule(user, settings, item.module)) return false;
  if (!isMenuItemEnabled(settings, menuItemId)) return false;

  const role = String(user.role || "").toLowerCase() === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;
  return isRoleMenuItemEnabled(settings, role, menuItemId);
}

export function canAccessPath(user, settings, path) {
  const menuItemId = ROUTE_MENU_ITEM_MAP[path];
  if (menuItemId) {
    return canAccessMenuItem(user, settings, menuItemId);
  }

  const moduleId = ROUTE_MODULE_MAP[path];
  if (!moduleId) return true;
  return canAccessModule(user, settings, moduleId);
}

export function getModuleDefaults() {
  const defaults = {};
  for (const mod of MODULES) {
    defaults[moduleSettingKey(mod.id)] = "1";
  }
  return defaults;
}

export function getRoleModuleDefaults() {
  const defaults = {};
  const allModules = [...MODULES, ...ADMIN_MODULES];

  for (const mod of allModules) {
    defaults[roleModuleSettingKey(ROLES.ADMIN, mod.id)] = "1";
    defaults[roleModuleSettingKey(
      ROLES.CASHIER,
      mod.id
    )] = CASHIER_DEFAULT_MODULES.includes(mod.id) ? "1" : "0";
  }

  return defaults;
}

export function getMenuItemDefaults() {
  const defaults = {};
  for (const item of MENU_ITEMS) {
    defaults[menuItemSettingKey(item.id)] = "1";
  }
  return defaults;
}

export function getRoleMenuItemDefaults() {
  const defaults = {};

  for (const item of MENU_ITEMS) {
    defaults[roleMenuItemSettingKey(ROLES.ADMIN, item.id)] = "1";
    defaults[roleMenuItemSettingKey(
      ROLES.CASHIER,
      item.id
    )] = defaultRoleMenuItemEnabled(ROLES.CASHIER, item.id) ? "1" : "0";
  }

  return defaults;
}

/** First allowed route after login (respects role + settings). */
export function getDefaultRouteForUser(user, settings) {
  const role = String(user?.role || "").toLowerCase() === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;
  if (role === ROLES.ADMIN) return "/";

  const preferred = ["/sales", "/", "/orders", "/products", "/customers", "/inventory", "/accounting", "/reports"];
  for (const path of preferred) {
    if (canAccessPath(user, settings, path)) return path;
  }

  for (const path of Object.keys(ROUTE_MODULE_MAP)) {
    if (canAccessPath(user, settings, path)) return path;
  }

  return "/login";
}

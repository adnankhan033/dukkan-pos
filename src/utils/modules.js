import { ROLES, ROLE_MODULES, ALL_ROLES, normalizeRole } from "./roles";
import { NAV_GROUPS } from "./nav";
import {
  getAdminPermissionModules,
  getCatalogModule,
  getPermissionModules,
  MODULE_LIFECYCLE,
} from "../modules/catalog";
import {
  isTruthySetting,
  menuItemSettingKey,
  moduleConfiguredKey,
  moduleInstalledKey,
  moduleSettingKey,
  roleMenuItemSettingKey,
  roleModuleSettingKey,
} from "../modules/keys";

export {
  menuItemSettingKey,
  moduleConfiguredKey,
  moduleInstalledKey,
  moduleSettingKey,
  roleMenuItemSettingKey,
  roleModuleSettingKey,
};

function toPermissionModule(mod) {
  return { id: mod.id, label: mod.name, description: mod.description };
}

export const MODULES = getPermissionModules().map(toPermissionModule);

export const ADMIN_MODULES = getAdminPermissionModules().map(toPermissionModule);

export const ROUTE_MODULE_MAP = {
  "/": "dashboard",
  "/sales": "sales",
  "/orders": "sales",
  "/zatca-sync": "sales",
  "/products": "products",
  "/categories": "products",
  "/units": "products",
  "/inventory": "inventory",
  "/purchases": "purchasing",
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/wholesale": "wholesale",
  "/wholesale/price-lists": "wholesale",
  "/accounting": "accounting",
  "/accounting/receive": "cash_bank",
  "/accounting/pay": "cash_bank",
  "/accounting/expenses": "expenses",
  "/accounting/partners": "partners",
  "/accounting/journals": "accounting",
  "/accounting/reports": "accounting",
  "/employees": "expenses",
  "/expenses": "expenses",
  "/reports": "reports",
  "/daily-close": "reports",
  "/cloud-backup": "settings",
  "/subscriptions": "users",
  "/users": "users",
  "/settings": "settings",
  "/store-cards": "settings",
  "/zatca-queue": "settings",
  "/zatca-test": "settings",
};

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

export function isModuleEnabled(settings, moduleId) {
  const def = getCatalogModule(moduleId);
  if (def?.lifecycle === MODULE_LIFECYCLE.CORE) return true;

  if (def?.lifecycle === MODULE_LIFECYCLE.OPTIONAL) {
    const installed = settings?.[moduleInstalledKey(moduleId)];
    if (!isTruthySetting(installed)) return false;
  }

  const key = moduleSettingKey(moduleId);
  const value = settings?.[key];
  if (value === undefined || value === "") {
    return def ? Boolean(def.defaultEnabled) && def.lifecycle !== MODULE_LIFECYCLE.OPTIONAL : true;
  }
  return isTruthySetting(value);
}

function defaultRoleModuleEnabled(role, moduleId) {
  if (ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
    return role === ROLES.ADMIN;
  }
  return (ROLE_MODULES[role] || []).includes(moduleId);
}

export function isRoleModuleEnabled(settings, role, moduleId) {
  if (role !== ROLES.ADMIN && ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
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
  if (role !== ROLES.ADMIN && ADMIN_ONLY_MODULE_IDS.has(item.module)) return false;
  return defaultRoleModuleEnabled(role, item.module);
}

export function isRoleMenuItemEnabled(settings, role, menuItemId) {
  const item = MENU_ITEM_BY_ID.get(menuItemId);
  if (!item) return false;

  if (role !== ROLES.ADMIN && ADMIN_ONLY_MODULE_IDS.has(item.module)) {
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

  const role = normalizeRole(user.role);

  if (ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
    return role === ROLES.ADMIN;
  }

  if (!isModuleEnabled(settings, moduleId)) return false;
  return isRoleModuleEnabled(settings, role, moduleId);
}

export function canAccessMenuItem(user, settings, menuItemId) {
  if (!user || !menuItemId) return false;

  const item = MENU_ITEM_BY_ID.get(menuItemId);
  if (!item) return false;

  const role = normalizeRole(user.role);
  if (role === ROLES.ADMIN && ADMIN_ONLY_MODULE_IDS.has(item.module)) {
    return true;
  }

  if (!canAccessModule(user, settings, item.module)) return false;
  if (!isMenuItemEnabled(settings, menuItemId)) return false;

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
    const def = getCatalogModule(mod.id);
    const enabled = def ? Boolean(def.defaultEnabled) && def.lifecycle !== MODULE_LIFECYCLE.OPTIONAL : true;
    defaults[moduleSettingKey(mod.id)] = enabled ? "1" : "0";
    defaults[moduleInstalledKey(mod.id)] = def?.lifecycle === MODULE_LIFECYCLE.OPTIONAL ? "0" : "1";
    defaults[moduleConfiguredKey(mod.id)] = def?.lifecycle === MODULE_LIFECYCLE.OPTIONAL ? "0" : "1";
  }
  return defaults;
}

export function getRoleModuleDefaults() {
  const defaults = {};
  const allModules = [...MODULES, ...ADMIN_MODULES];

  for (const mod of allModules) {
    for (const role of ALL_ROLES) {
      defaults[roleModuleSettingKey(role, mod.id)] = defaultRoleModuleEnabled(role, mod.id) ? "1" : "0";
    }
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
    for (const role of ALL_ROLES) {
      defaults[roleMenuItemSettingKey(role, item.id)] = defaultRoleMenuItemEnabled(role, item.id) ? "1" : "0";
    }
  }

  return defaults;
}

/** First allowed route after login (respects role + settings). */
export function getDefaultRouteForUser(user, settings) {
  const role = normalizeRole(user?.role);
  if (role === ROLES.ADMIN) return "/";

  const preferred = ["/sales", "/", "/orders", "/products", "/customers", "/inventory", "/accounting/receive", "/reports"];
  for (const path of preferred) {
    if (canAccessPath(user, settings, path)) return path;
  }

  for (const path of Object.keys(ROUTE_MODULE_MAP)) {
    if (canAccessPath(user, settings, path)) return path;
  }

  return "/login";
}

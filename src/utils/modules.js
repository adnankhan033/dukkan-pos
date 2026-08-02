import { ROLES, ROLE_MODULES } from "./roles";

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
  "/expenses": "accounting",
  "/reports": "reports",
  "/users": "users",
  "/settings": "settings",
  "/zatca-queue": "settings",
  "/zatca-test": "settings",
};

const CASHIER_DEFAULT_MODULES = ["dashboard", "sales", "reports"];
const ADMIN_ONLY_MODULE_IDS = new Set(["users", "settings"]);

export function moduleSettingKey(moduleId) {
  return `module_${moduleId}_enabled`;
}

export function roleModuleSettingKey(role, moduleId) {
  return `role_${role}_module_${moduleId}`;
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

export function canAccessModule(user, settings, moduleId) {
  if (!user || !moduleId) return false;

  const role = String(user.role || "").toLowerCase() === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;

  if (ADMIN_ONLY_MODULE_IDS.has(moduleId)) {
    return role === ROLES.ADMIN && isRoleModuleEnabled(settings, role, moduleId);
  }

  if (!isModuleEnabled(settings, moduleId)) return false;
  return isRoleModuleEnabled(settings, role, moduleId);
}

export function canAccessPath(user, settings, path) {
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

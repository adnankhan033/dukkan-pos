import { roleCanAccessModule } from "./roles";

export const MODULES = [
  { id: "dashboard", label: "Dashboard", description: "Home dashboard and stats" },
  { id: "sales", label: "Sales", description: "POS checkout and orders" },
  { id: "products", label: "Products", description: "Products, categories, units" },
  { id: "inventory", label: "Inventory", description: "Stock and purchases" },
  { id: "customers", label: "Customers", description: "Customer management" },
  { id: "suppliers", label: "Suppliers", description: "Supplier management" },
  { id: "accounting", label: "Accounting", description: "Expenses, salaries, bills" },
  { id: "reports", label: "Reports", description: "Sales and profit reports" },
];

export const ROUTE_MODULE_MAP = {
  "/": "dashboard",
  "/sales": "sales",
  "/orders": "sales",
  "/products": "products",
  "/categories": "products",
  "/units": "products",
  "/inventory": "inventory",
  "/purchases": "inventory",
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/accounting": "accounting",
  "/expenses": "accounting",
  "/reports": "reports",
  "/users": "users",
  "/settings": "settings",
};

export function moduleSettingKey(moduleId) {
  return `module_${moduleId}_enabled`;
}

export function isModuleEnabled(settings, moduleId) {
  const key = moduleSettingKey(moduleId);
  const value = settings?.[key];
  if (value === undefined || value === "") return true;
  return value === "1" || value === "true";
}

export function canAccessModule(user, settings, moduleId) {
  if (!roleCanAccessModule(user, moduleId)) return false;
  if (moduleId === "users" || moduleId === "settings") return true;
  return isModuleEnabled(settings, moduleId);
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

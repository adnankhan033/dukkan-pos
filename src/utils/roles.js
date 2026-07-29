export const ROLES = {
  ADMIN: "admin",
  CASHIER: "cashier",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.CASHIER]: "Cashier",
};

/** Modules each role may access when enabled in settings. */
export const ROLE_MODULES = {
  [ROLES.ADMIN]: [
    "dashboard",
    "sales",
    "products",
    "inventory",
    "customers",
    "suppliers",
    "accounting",
    "reports",
    "users",
    "settings",
  ],
  [ROLES.CASHIER]: ["dashboard", "sales"],
};

export function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  return value === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;
}

export function isAdmin(user) {
  return normalizeRole(user?.role) === ROLES.ADMIN;
}

export function roleCanAccessModule(user, moduleId) {
  if (!user || !moduleId) return false;
  const role = normalizeRole(user.role);
  const allowed = ROLE_MODULES[role] || [];
  if (moduleId === "users" || moduleId === "settings") {
    return role === ROLES.ADMIN;
  }
  return allowed.includes(moduleId);
}

export function getDefaultRouteForUser(user) {
  return normalizeRole(user?.role) === ROLES.CASHIER ? "/sales" : "/";
}

export const ROLES = {
  ADMIN: "admin",
  CASHIER: "cashier",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.CASHIER]: "Cashier",
};

/** Fallback when per-role settings are not saved yet. */
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
  [ROLES.CASHIER]: ["dashboard", "sales", "reports"],
};

export function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  return value === ROLES.CASHIER ? ROLES.CASHIER : ROLES.ADMIN;
}

export function isAdmin(user) {
  return normalizeRole(user?.role) === ROLES.ADMIN;
}

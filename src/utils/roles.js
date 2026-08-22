export const ROLES = {
  ADMIN: "admin",
  CASHIER: "cashier",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.CASHIER]: "Cashier",
};

export const ALL_ROLES = [ROLES.ADMIN, ROLES.CASHIER];

/** Fallback when per-role settings are not saved yet. */
export const ROLE_MODULES = {
  [ROLES.ADMIN]: [
    "dashboard",
    "sales",
    "products",
    "inventory",
    "customers",
    "suppliers",
    "purchasing",
    "wholesale",
    "accounting",
    "expenses",
    "partners",
    "cash_bank",
    "zatca",
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

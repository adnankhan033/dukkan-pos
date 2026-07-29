import { getModuleDefaults, getRoleModuleDefaults } from "./modules";

export const DB_NAME = "sqlite:portal_pos.db";

export const DEFAULT_SETTINGS = {
  store_name: "Portal POS",
  store_name_ar: "",
  store_address: "",
  cr_number: "",
  vat_registration: "",
  vat_percent: "15",
  currency: "SAR",
  receipt_footer: "Thank you for your purchase!",
  receipt_footer_ar: "شكراً لتسوقكم",
  receipt_show_qr: "1",
  receipt_show_bilingual: "1",
  receipt_show_tax_info: "1",
  receipt_paper_width: "80",
  receipt_header_note: "",
  receipt_template: "baqala",
  dashboard_admin_show_profit: "1",
  dashboard_admin_show_purchases: "1",
  dashboard_cashier_show_recent: "1",
  ...getModuleDefaults(),
  ...getRoleModuleDefaults(),
};

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
};

/** Market cash purchase vs supplier delivery (paid now or on credit). */
export const PURCHASE_TYPE = {
  MARKET: "market",
  SUPPLIER_PAID: "supplier_paid",
  SUPPLIER_CREDIT: "supplier_credit",
};

export const PURCHASE_PAYMENT_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  PARTIAL: "partial",
};

export const PURCHASE_PAYMENT_STATUS_LABELS = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partial",
};

export const SALE_STATUS = {
  COMPLETED: "completed",
  HELD: "held",
  PARTIAL_RETURN: "partial_return",
  RETURNED: "returned",
};

export const ORDER_PERIODS = {
  TODAY: "today",
  WEEK: "week",
  MONTH: "month",
};

export const ORDER_RETURN_FILTERS = {
  ALL: "all",
  NO_RETURN: "no_return",
  WITH_RETURN: "with_return",
  PARTIAL: "partial_return",
  RETURNED: "returned",
};

export const PRODUCT_IMPORT_BATCH_SIZE = 50;

export const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Rent" },
  { id: "salary", label: "Salaries & Wages" },
  { id: "utilities", label: "Utilities" },
  { id: "supplies", label: "Store Supplies" },
  { id: "maintenance", label: "Maintenance & Repairs" },
  { id: "transport", label: "Transport & Delivery" },
  { id: "marketing", label: "Marketing" },
  { id: "tax", label: "Tax & Government Fees" },
  { id: "other", label: "Other" },
];

export const EXPENSE_PERIODS = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  ALL: "all",
};

export const ITEMS_PER_PAGE = 10;

/** Grouped sidebar navigation — filtered by role and module settings. */
export const NAV_GROUPS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/", module: "dashboard" },
  {
    id: "sales",
    label: "Sales",
    icon: "ShoppingCart",
    module: "sales",
    items: [
      { path: "/sales", label: "POS" },
      { path: "/orders", label: "Orders" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: "Package",
    module: "products",
    items: [
      { path: "/products", label: "Products" },
      { path: "/categories", label: "Categories" },
      { path: "/units", label: "Units" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "Boxes",
    module: "inventory",
    items: [{ path: "/inventory", label: "Stock" }],
  },
  { id: "customers", label: "Customers", icon: "Users", path: "/customers", module: "customers" },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: "Building2",
    module: "suppliers",
    items: [
      { path: "/suppliers", label: "Accounts" },
      { path: "/purchases", label: "Purchases" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: "Receipt",
    module: "accounting",
    items: [{ path: "/accounting", label: "Expenses" }],
  },
  { id: "reports", label: "Reports", icon: "BarChart3", path: "/reports", module: "reports" },
  {
    id: "administration",
    label: "Administration",
    icon: "Shield",
    module: "users",
    items: [
      { path: "/users", label: "Users", module: "users" },
      { path: "/settings", label: "Settings", module: "settings" },
    ],
  },
];

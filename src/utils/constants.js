export const DB_NAME = "sqlite:portal_pos.db";

export const DEFAULT_SETTINGS = {
  store_name: "Portal POS",
  store_address: "",
  vat_percent: "15",
  currency: "SAR",
  receipt_footer: "Thank you for your purchase!",
};

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
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

export const ITEMS_PER_PAGE = 10;

export const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { path: "/products", label: "Products", icon: "Package" },
  { path: "/sales", label: "Sales", icon: "ShoppingCart" },
  { path: "/orders", label: "Orders", icon: "ClipboardList" },
  { path: "/purchases", label: "Purchases", icon: "Truck" },
  { path: "/inventory", label: "Inventory", icon: "Warehouse" },
  { path: "/customers", label: "Customers", icon: "Users" },
  { path: "/suppliers", label: "Suppliers", icon: "Building2" },
  { path: "/categories", label: "Categories", icon: "Tags" },
  { path: "/expenses", label: "Expenses", icon: "Receipt" },
  { path: "/reports", label: "Reports", icon: "BarChart3" },
  { path: "/settings", label: "Settings", icon: "Settings" },
];

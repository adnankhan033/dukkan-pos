/** Grouped sidebar navigation — filtered by role and module settings. */
export const NAV_GROUPS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/", module: "dashboard" },
  {
    id: "sales",
    label: "Sales",
    icon: "ShoppingCart",
    module: "sales",
    items: [
      { id: "pos", path: "/sales", label: "POS" },
      { id: "orders", path: "/orders", label: "Orders" },
      { id: "zatca-sync", path: "/zatca-sync", label: "ZATCA Sync" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: "Package",
    module: "products",
    items: [
      { id: "products-list", path: "/products", label: "Products" },
      { id: "categories", path: "/categories", label: "Categories" },
      { id: "units", path: "/units", label: "Units" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "Boxes",
    module: "inventory",
    items: [{ id: "stock", path: "/inventory", label: "Stock" }],
  },
  { id: "customers", label: "Customers", icon: "Users", path: "/customers", module: "customers" },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: "Building2",
    module: "suppliers",
    items: [
      { id: "supplier-accounts", path: "/suppliers", label: "Accounts" },
      { id: "purchases", path: "/purchases", label: "Purchases" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: "Receipt",
    module: "accounting",
    items: [
      { id: "expenses", path: "/accounting", label: "Expenses" },
      { id: "employees", path: "/employees", label: "Employees" },
    ],
  },
  { id: "reports", label: "Reports", icon: "BarChart3", path: "/reports", module: "reports" },
  {
    id: "backup",
    label: "Backup",
    icon: "CloudUpload",
    module: "settings",
    items: [{ id: "cloud-backup", path: "/cloud-backup", label: "Gmail Backup", module: "settings" }],
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: "CreditCard",
    path: "/subscriptions",
    module: "dashboard",
  },
  {
    id: "administration",
    label: "Administration",
    icon: "Shield",
    module: "users",
    items: [
      { id: "users", path: "/users", label: "Users", module: "users" },
      { id: "settings", path: "/settings", label: "Settings", module: "settings" },
      { id: "zatca-queue", path: "/zatca-queue", label: "ZATCA Queue", module: "settings" },
      { id: "zatca-test", path: "/zatca-test", label: "ZATCA Test Center", module: "settings" },
    ],
  },
];

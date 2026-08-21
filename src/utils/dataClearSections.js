/** Administrator-only data wipe sections (Settings → Backup). */
export const DATA_CLEAR_SECTIONS = [
  {
    id: "orders",
    label: "Sales & Orders",
    description: "Sales, line items, returns, ZATCA invoices, and sale payments.",
    tables: ["sales", "sale_items", "sale_returns", "sale_return_items", "zatca_invoices", "zatca_api_logs"],
  },
  {
    id: "purchases",
    label: "Purchases",
    description: "Purchase orders, lines, supplier payments, and purchase payments.",
    tables: ["purchases", "purchase_items", "supplier_payments"],
  },
  {
    id: "products",
    label: "Products & Catalog",
    description: "Products, categories, units, inventory history, and import logs.",
    tables: ["products", "categories", "units", "inventory", "import_logs"],
    requiresEmpty: ["sale_items", "purchase_items"],
    requiresEmptyMessage:
      "Clear Sales & Orders and Purchases first — products are still linked to existing transactions.",
  },
  {
    id: "customers",
    label: "Customers",
    description: "All customer records. Sales are kept; customer links are removed.",
    tables: ["customers"],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "All supplier records. Purchases are kept; supplier links are removed.",
    tables: ["suppliers"],
  },
  {
    id: "inventory",
    label: "Inventory History",
    description: "Stock movement log only. Product quantities are not reset.",
    tables: ["inventory"],
  },
  {
    id: "accounting",
    label: "Expenses & Accounting",
    description: "Expenses, journal entries, partners, chart of accounts, and standalone payments.",
    tables: [
      "expenses",
      "payments",
      "journal_lines",
      "journal_entries",
      "partner_transactions",
      "partners",
      "accounting_audit_log",
      "accounting_sequences",
      "accounts",
      "account_groups",
      "fiscal_periods",
    ],
  },
  {
    id: "employees",
    label: "Employees & Salaries",
    description: "Employee profiles and salary payment records.",
    tables: ["employees", "employee_salaries"],
  },
  {
    id: "subscriptions",
    label: "User Subscriptions",
    description: "Cashier subscription plans and renewal dates.",
    tables: ["user_subscriptions"],
  },
];

export function getDataClearSection(sectionId) {
  return DATA_CLEAR_SECTIONS.find((section) => section.id === sectionId) || null;
}

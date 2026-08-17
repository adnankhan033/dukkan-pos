export const DIRECTORY_EXPORT_TYPES = {
  CUSTOMERS: "customers",
  SUPPLIERS: "suppliers",
};

export const CUSTOMER_EXPORT_SCOPES = {
  CONTACTS: "contacts",
  ACCOUNTS: "accounts",
  BALANCE_DUE: "balance_due",
  FULL_STATEMENT: "full_statement",
};

const CUSTOMER_CONTACT_COLUMNS = [
  { key: "name", label: "Customer Name", width: 28 },
  { key: "phone", label: "Phone", width: 16 },
  { key: "email", label: "Email", width: 26 },
  { key: "address", label: "Address", width: 34 },
  { key: "notes", label: "Notes", width: 24 },
];

const CUSTOMER_ACCOUNT_COLUMNS = [
  { key: "name", label: "Customer Name", width: 26 },
  { key: "phone", label: "Phone", width: 14 },
  { key: "email", label: "Email", width: 22 },
  { key: "total_invoiced", label: "Total Invoiced", width: 16, format: "currency" },
  { key: "total_paid", label: "Total Paid", width: 14, format: "currency" },
  { key: "balance_pending", label: "Balance Due", width: 14, format: "currency" },
  { key: "pending_count", label: "Unpaid Invoices", width: 14, format: "integer" },
  { key: "address", label: "Address", width: 28 },
];

const CUSTOMER_BALANCE_DUE_COLUMNS = [
  { key: "name", label: "Customer Name", width: 28 },
  { key: "phone", label: "Phone", width: 16 },
  { key: "email", label: "Email", width: 24 },
  { key: "balance_pending", label: "Balance Due", width: 16, format: "currency" },
  { key: "pending_count", label: "Unpaid Invoices", width: 14, format: "integer" },
  { key: "total_invoiced", label: "Total Invoiced", width: 16, format: "currency" },
  { key: "total_paid", label: "Total Paid", width: 14, format: "currency" },
];

export const CUSTOMER_EXPORT_SCOPE_OPTIONS = [
  {
    id: CUSTOMER_EXPORT_SCOPES.FULL_STATEMENT,
    label: "Full account statement (share with customer)",
    hint: "Select one customer — pay-later account invoices, payments, and balance due (excludes regular cash/card sales).",
    requiresCustomer: true,
    pdfOnly: true,
  },
  {
    id: CUSTOMER_EXPORT_SCOPES.ACCOUNTS,
    label: "Account summary (all customers)",
    hint: "Contacts plus invoiced, paid, and balance due — best for collections.",
  },
  {
    id: CUSTOMER_EXPORT_SCOPES.BALANCE_DUE,
    label: "Balance due only",
    hint: "Customers who still owe money, sorted by highest balance.",
  },
  {
    id: CUSTOMER_EXPORT_SCOPES.CONTACTS,
    label: "Contact directory",
    hint: "Name, phone, email, and address only — no financial columns.",
  },
];

export const DIRECTORY_DEFINITIONS = {
  [DIRECTORY_EXPORT_TYPES.CUSTOMERS]: {
    id: DIRECTORY_EXPORT_TYPES.CUSTOMERS,
    title: "Customer Directory",
    subtitle: "Official customer contact list",
    sheetName: "Customers",
    filePrefix: "customers-directory",
    columns: CUSTOMER_CONTACT_COLUMNS,
  },
  [DIRECTORY_EXPORT_TYPES.SUPPLIERS]: {
    id: DIRECTORY_EXPORT_TYPES.SUPPLIERS,
    title: "Supplier Directory",
    subtitle: "Supplier contacts and account balances",
    sheetName: "Suppliers",
    filePrefix: "suppliers-directory",
    columns: [
      { key: "company", label: "Supplier Company", width: 28 },
      { key: "contact_person", label: "Contact Person", width: 20 },
      { key: "phone", label: "Phone", width: 16 },
      { key: "email", label: "Email", width: 24 },
      { key: "address", label: "Address", width: 30 },
      { key: "total_delivered", label: "Total Delivered", width: 16, format: "currency" },
      { key: "total_paid", label: "Total Paid", width: 16, format: "currency" },
      { key: "balance_pending", label: "Pending Balance", width: 16, format: "currency" },
    ],
  },
};

export function getDirectoryDefinition(type) {
  return DIRECTORY_DEFINITIONS[type] || DIRECTORY_DEFINITIONS[DIRECTORY_EXPORT_TYPES.CUSTOMERS];
}

export function getCustomerExportDefinition(scope = CUSTOMER_EXPORT_SCOPES.ACCOUNTS) {
  const base = DIRECTORY_DEFINITIONS[DIRECTORY_EXPORT_TYPES.CUSTOMERS];

  if (scope === CUSTOMER_EXPORT_SCOPES.CONTACTS) {
    return {
      ...base,
      title: "Customer Contact Directory",
      subtitle: "Customer contacts for WhatsApp, email, or printing",
      filePrefix: "customers-contacts",
      columns: CUSTOMER_CONTACT_COLUMNS,
      scope,
      includesBalances: false,
      balanceOnly: false,
    };
  }

  if (scope === CUSTOMER_EXPORT_SCOPES.BALANCE_DUE) {
    return {
      ...base,
      title: "Customer Balance Due Report",
      subtitle: "Customers with outstanding pay-later balances",
      filePrefix: "customers-balance-due",
      columns: CUSTOMER_BALANCE_DUE_COLUMNS,
      scope,
      includesBalances: true,
      balanceOnly: true,
    };
  }

  if (scope === CUSTOMER_EXPORT_SCOPES.FULL_STATEMENT) {
    return {
      ...base,
      title: "Customer Account Statement",
      subtitle: "Complete invoice and payment history",
      filePrefix: "customer-account-statement",
      columns: [],
      scope,
      includesBalances: true,
      balanceOnly: false,
      isFullStatement: true,
    };
  }

  return {
    ...base,
    title: "Customer Account Summary",
    subtitle: "Customer contacts with invoiced, paid, and balance due totals",
    filePrefix: "customers-account-summary",
    columns: CUSTOMER_ACCOUNT_COLUMNS,
    scope,
    includesBalances: true,
    balanceOnly: false,
  };
}

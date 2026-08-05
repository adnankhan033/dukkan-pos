export const DIRECTORY_EXPORT_TYPES = {
  CUSTOMERS: "customers",
  SUPPLIERS: "suppliers",
};

export const DIRECTORY_DEFINITIONS = {
  [DIRECTORY_EXPORT_TYPES.CUSTOMERS]: {
    id: DIRECTORY_EXPORT_TYPES.CUSTOMERS,
    title: "Customer Directory",
    subtitle: "Official customer contact list",
    sheetName: "Customers",
    filePrefix: "customers-directory",
    columns: [
      { key: "name", label: "Customer Name", width: 28 },
      { key: "phone", label: "Phone", width: 16 },
      { key: "email", label: "Email", width: 26 },
      { key: "address", label: "Address", width: 34 },
      { key: "notes", label: "Notes", width: 24 },
    ],
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

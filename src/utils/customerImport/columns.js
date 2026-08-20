/** Canonical customer import column definitions (UTF-8). */

export const CUSTOMER_IMPORT_COLUMNS = [
  {
    key: "name",
    label: "name",
    title: "Name",
    required: true,
    example: "Ahmad Autos",
    hint: "Required. Shop or person name shown on POS and invoices.",
  },
  {
    key: "phone",
    label: "phone",
    title: "Phone",
    required: false,
    example: "03149882341 / 03460282848",
    hint: "Optional. Multiple numbers can be separated with / or a comma.",
  },
  {
    key: "email",
    label: "email",
    title: "Email",
    required: false,
    example: "shop@example.com",
    hint: "Optional. Must be a valid email if provided.",
  },
  {
    key: "address",
    label: "address",
    title: "Address",
    required: false,
    example: "Darora, Upper Dir",
    hint: "Optional. City, area, or street.",
  },
  {
    key: "notes",
    label: "notes",
    title: "Notes",
    required: false,
    example: "Area: DIR U DARORA",
    hint: "Optional. Internal notes, not printed on receipts.",
  },
];

const HEADER_ALIASES = {
  name: ["name", "customer", "customer_name", "shop", "shop_name"],
  phone: ["phone", "mobile", "telephone", "phone_number", "contact"],
  email: ["email", "e-mail", "mail"],
  address: ["address", "city", "location", "area"],
  notes: ["notes", "note", "remarks", "comment"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[#]/g, "")
    .replace(/[\s-]+/g, "_");
}

export function mapHeaders(headers = []) {
  const map = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] != null) continue;
      if (aliases.includes(normalized)) map[key] = index;
    }
  });
  return map;
}

export function rowToCustomer(raw = [], headerMap = {}) {
  const read = (key) => {
    const index = headerMap[key];
    if (index == null) return "";
    return String(raw[index] ?? "").trim();
  };
  return {
    name: read("name"),
    phone: read("phone"),
    email: read("email"),
    address: read("address"),
    notes: read("notes"),
  };
}

export function templateHeaders() {
  return CUSTOMER_IMPORT_COLUMNS.map((col) => col.label);
}

export function templateSampleRows() {
  return [
    ["Ahmad Autos", "03461147089", "", "Timergara, Lower Dir", "Area: DIR L TMG"],
    ["Abid Ali Autos", "03159722018", "", "Darora, Upper Dir", "Area: DIR U DARORA"],
  ];
}

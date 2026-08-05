import { formatDateTime } from "../format";

export function buildCompanyProfile(settings = {}) {
  return {
    name: settings.store_name?.trim() || "DukkanPOS",
    nameAr: settings.store_name_ar?.trim() || "",
    address: settings.store_address?.trim() || "",
    crNumber: settings.cr_number?.trim() || "",
    vatNumber: settings.vat_registration?.trim() || "",
    currency: settings.currency?.trim() || "SAR",
    generatedAt: formatDateTime(new Date().toISOString()),
    generatedDate: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };
}

export function companyMetaLines(company) {
  const lines = [];
  if (company.address) lines.push(company.address);
  const ids = [];
  if (company.crNumber) ids.push(`CR: ${company.crNumber}`);
  if (company.vatNumber) ids.push(`VAT: ${company.vatNumber}`);
  if (ids.length) lines.push(ids.join("  ·  "));
  return lines;
}

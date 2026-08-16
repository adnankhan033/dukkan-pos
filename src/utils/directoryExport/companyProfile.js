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

/** Full store profile for rich PDF / report headers. */
export function buildReportCompanyProfile(settings = {}) {
  const base = buildCompanyProfile(settings);
  return {
    ...base,
    phone: settings.store_phone?.trim() || "",
    city: settings.zatca_city?.trim() || "",
    district: settings.zatca_district?.trim() || "",
    streetEn: settings.zatca_street_name_en?.trim() || "",
    streetAr: settings.zatca_street_name_ar?.trim() || "",
    buildingNumber: settings.zatca_building_number?.trim() || "",
    postalCode: settings.zatca_postal_code?.trim() || "",
    additionalNumber: settings.zatca_additional_number?.trim() || "",
    footer: settings.receipt_footer?.trim() || "",
    footerAr: settings.receipt_footer_ar?.trim() || "",
    vatPercent: settings.vat_percent?.trim() || "15",
  };
}

export function formatCompanyAddress(company) {
  const parts = [];
  if (company.buildingNumber) parts.push(`Bldg ${company.buildingNumber}`);
  if (company.streetEn) parts.push(company.streetEn);
  if (company.streetAr) parts.push(company.streetAr);
  if (company.district) parts.push(company.district);
  if (company.city) parts.push(company.city);
  if (company.postalCode) parts.push(company.postalCode);
  if (company.additionalNumber) parts.push(`Add. ${company.additionalNumber}`);

  if (parts.length) return parts.join(", ");
  return company.address || "";
}

export function companyMetaLines(company) {
  const lines = [];
  const fullAddress = formatCompanyAddress(company);
  if (fullAddress) lines.push(fullAddress);
  else if (company.address) lines.push(company.address);

  const ids = [];
  if (company.crNumber) ids.push(`CR: ${company.crNumber}`);
  if (company.vatNumber) ids.push(`VAT: ${company.vatNumber}`);
  if (ids.length) lines.push(ids.join("  ·  "));
  if (company.phone) lines.push(`Tel: ${company.phone}`);
  return lines;
}

export function companyInitial(name) {
  const trimmed = String(name || "D").trim();
  return trimmed.charAt(0).toUpperCase();
}

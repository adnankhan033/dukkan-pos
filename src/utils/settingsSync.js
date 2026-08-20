import { ZATCA_SETTING_KEYS as ZK } from "../zatca/core/constants";
import { ACTIVATION_SETTING_KEYS } from "./activationConfig";

/** Settings owned by the desktop app. */
export const LOCAL_STORE_SETTING_KEYS = [
  "store_name",
  "store_name_ar",
  "store_address",
  "store_phone",
  "cr_number",
  "vat_registration",
  "vat_percent",
  "vat_included",
  "tax_enabled",
  "currency",
  "business_timezone",
  "business_date_override",
  "business_time_override",
  "receipt_footer",
  "receipt_footer_ar",
  "receipt_branding",
  "receipt_show_qr",
  "receipt_show_bilingual",
  "receipt_show_tax_info",
  "receipt_section_store_header",
  "receipt_section_invoice_meta",
  "receipt_section_invoice_title",
  "receipt_section_header_note",
  "receipt_section_items",
  "receipt_section_totals",
  "receipt_section_payment",
  "receipt_section_footer",
  "receipt_section_branding",
  "receipt_paper_width",
  "receipt_header_note",
  "receipt_template",
  "receipt_print_on_complete",
  "invoice_update_existing",
  "dashboard_admin_show_profit",
  "dashboard_admin_show_purchases",
  "dashboard_cashier_show_recent",
  ZK.COMPANY_NAME,
  ZK.COMPANY_NAME_AR,
  ZK.CR_NUMBER,
  ZK.VAT_NUMBER,
  ZK.COMPANY_ADDRESS,
  ACTIVATION_SETTING_KEYS.CUSTOMER_STORE,
  ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS,
  ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE,
];

/** Mirror Store tab fields into ZATCA + activation keys on save. */
export function mirrorStoreFields(settings = {}) {
  const mirrored = { ...settings };

  if (settings.store_name?.trim()) {
    mirrored[ZK.COMPANY_NAME] = settings.store_name.trim();
    mirrored[ACTIVATION_SETTING_KEYS.CUSTOMER_STORE] = settings.store_name.trim();
  }
  if (settings.store_name_ar?.trim()) {
    mirrored[ZK.COMPANY_NAME_AR] = settings.store_name_ar.trim();
  }
  if (settings.store_address?.trim()) {
    mirrored[ZK.COMPANY_ADDRESS] = settings.store_address.trim();
    mirrored[ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS] = settings.store_address.trim();
  }
  if (settings.store_phone?.trim()) {
    mirrored[ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE] = settings.store_phone.trim();
  }
  if (settings.cr_number?.trim()) {
    mirrored[ZK.CR_NUMBER] = settings.cr_number.trim();
  }
  if (settings.vat_registration?.trim()) {
    mirrored[ZK.VAT_NUMBER] = settings.vat_registration.trim();
  }

  return mirrored;
}

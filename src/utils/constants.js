import { getModuleDefaults, getRoleModuleDefaults, getMenuItemDefaults, getRoleMenuItemDefaults } from "./modules";
import { getRoleActionDefaults } from "./actions";
import { getZatcaDefaultSettings } from "../zatca/core/config";
import { VENDOR_DEFAULT_SETTINGS } from "../config/softwareVendor";
import { RECEIPT_SECTION_DEFAULTS } from "./receiptSections";
import { APP_NAME, DB_NAME } from "./appIdentity";

export { DB_NAME };

export const DEFAULT_SETTINGS = {
  store_name: APP_NAME,
  store_name_ar: "",
  store_address: "",
  store_phone: "",
  cr_number: "",
  vat_registration: "",
  vat_percent: "15",
  vat_included: "1",
  tax_enabled: "1",
  currency: "SAR",
  receipt_footer: "Thank You",
  receipt_footer_ar: "شكراً لكم",
  receipt_branding: APP_NAME,
  receipt_show_qr: "1",
  receipt_show_bilingual: "1",
  receipt_show_tax_info: "1",
  ...RECEIPT_SECTION_DEFAULTS,
  receipt_paper_width: "80",
  receipt_header_note: "",
  receipt_template: "baqala",
  receipt_print_on_complete: "1",
  invoice_update_existing: "0",
  business_timezone: "Asia/Riyadh",
  business_date_override: "",
  business_time_override: "",
  dashboard_admin_show_profit: "1",
  dashboard_admin_show_purchases: "1",
  dashboard_cashier_show_recent: "1",
  accounting_enabled: "0",
  ...VENDOR_DEFAULT_SETTINGS,
  ...getZatcaDefaultSettings(),
  ...getModuleDefaults(),
  ...getRoleModuleDefaults(),
  ...getMenuItemDefaults(),
  ...getRoleMenuItemDefaults(),
  ...getRoleActionDefaults(),
};

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  PAY_LATER: "pay_later",
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

/** Sale invoice collection status (mirrors purchase payment status). */
export const SALE_PAYMENT_STATUS = PURCHASE_PAYMENT_STATUS;
export const SALE_PAYMENT_STATUS_LABELS = PURCHASE_PAYMENT_STATUS_LABELS;

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
  CUSTOM: "custom",
};

export const ORDER_RETURN_FILTERS = {
  ALL: "all",
  NO_RETURN: "no_return",
  WITH_RETURN: "with_return",
  PARTIAL: "partial_return",
  RETURNED: "returned",
};

export const PRODUCT_IMPORT_BATCH_SIZE = 50;
export const POS_TOP_SELLERS_LIMIT = 10;

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

/** Phone placeholder — local number, no country code. */
export const PHONE_PLACEHOLDER = "05XXXXXXXX";

export const ITEMS_PER_PAGE = 10;

/** Products list page size. */
export const PRODUCTS_PAGE_SIZE = 100;

/** Inventory stock list page size (large catalogs). */
export const INVENTORY_PAGE_SIZE = 200;

/** Orders list page size. */
export const ORDERS_PAGE_SIZE = 100;

/** Customers directory page size. */
export const CUSTOMERS_PAGE_SIZE = 100;

export { NAV_GROUPS } from "./nav";

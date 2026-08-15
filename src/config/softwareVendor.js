/** Default software vendor / developer branding (override in Settings → Vendor). */
export const VENDOR_SETTING_KEYS = {
  ENABLED: "vendor_enabled",
  SIDEBAR_PULSE: "vendor_sidebar_pulse",
  MENU_LABEL: "vendor_menu_label",
  COMPANY_NAME: "vendor_company_name",
  COMPANY_NAME_AR: "vendor_company_name_ar",
  TAGLINE: "vendor_tagline",
  TAGLINE_AR: "vendor_tagline_ar",
  WEBSITE: "vendor_website",
  EMAIL: "vendor_email",
  PHONE: "vendor_phone",
  WHATSAPP: "vendor_whatsapp",
  ADDRESS: "vendor_address",
  SUPPORT_MESSAGE: "vendor_support_message",
  COPYRIGHT: "vendor_copyright",
};

export const DEFAULT_SOFTWARE_VENDOR = {
  enabled: true,
  sidebarPulse: true,
  menuLabel: "Software Partner",
  companyName: "",
  companyNameAr: "",
  tagline: "We build modern POS systems for retail.",
  taglineAr: "نبني أنظمة نقاط بيع حديثة للتجزئة.",
  website: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  supportMessage:
    "Need help, custom features, or support? Contact us — we're here for your business.",
  copyright: "",
};

export const VENDOR_DEFAULT_SETTINGS = {
  [VENDOR_SETTING_KEYS.ENABLED]: "1",
  [VENDOR_SETTING_KEYS.SIDEBAR_PULSE]: "1",
  [VENDOR_SETTING_KEYS.MENU_LABEL]: DEFAULT_SOFTWARE_VENDOR.menuLabel,
  [VENDOR_SETTING_KEYS.COMPANY_NAME]: DEFAULT_SOFTWARE_VENDOR.companyName,
  [VENDOR_SETTING_KEYS.COMPANY_NAME_AR]: DEFAULT_SOFTWARE_VENDOR.companyNameAr,
  [VENDOR_SETTING_KEYS.TAGLINE]: DEFAULT_SOFTWARE_VENDOR.tagline,
  [VENDOR_SETTING_KEYS.TAGLINE_AR]: DEFAULT_SOFTWARE_VENDOR.taglineAr,
  [VENDOR_SETTING_KEYS.WEBSITE]: DEFAULT_SOFTWARE_VENDOR.website,
  [VENDOR_SETTING_KEYS.EMAIL]: DEFAULT_SOFTWARE_VENDOR.email,
  [VENDOR_SETTING_KEYS.PHONE]: DEFAULT_SOFTWARE_VENDOR.phone,
  [VENDOR_SETTING_KEYS.WHATSAPP]: DEFAULT_SOFTWARE_VENDOR.whatsapp,
  [VENDOR_SETTING_KEYS.ADDRESS]: DEFAULT_SOFTWARE_VENDOR.address,
  [VENDOR_SETTING_KEYS.SUPPORT_MESSAGE]: DEFAULT_SOFTWARE_VENDOR.supportMessage,
  [VENDOR_SETTING_KEYS.COPYRIGHT]: DEFAULT_SOFTWARE_VENDOR.copyright,
};

export const VENDOR_SETTING_KEY_LIST = Object.values(VENDOR_SETTING_KEYS);

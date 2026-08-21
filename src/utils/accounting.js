/** Chart of accounts, journal types, and helpers for Saudi retail accounting. */

export const ACCOUNTING_SETTING_KEYS = {
  ENABLED: "accounting_enabled",
  CONFIGURED_AT: "accounting_configured_at",
  FISCAL_START: "accounting_fiscal_start",
  DEFAULT_CASH_ID: "accounting_default_cash_account_id",
  DEFAULT_BANK_ID: "accounting_default_bank_account_id",
  START_MODE: "accounting_start_mode",
  INVENTORY_REVALUE_REPAIRED: "accounting_inventory_revalue_repaired",
};

export const ACCOUNT_TYPES = {
  ASSET: "asset",
  LIABILITY: "liability",
  EQUITY: "equity",
  REVENUE: "revenue",
  EXPENSE: "expense",
};

export const ACCOUNT_CODES = {
  CASH: "1100",
  BANK: "1110",
  AR: "1200",
  INVENTORY: "1300",
  VAT_INPUT: "1400",
  OTHER_CURRENT_ASSETS: "1500",
  FIXED_ASSETS: "1600",
  AP: "2100",
  VAT_OUTPUT: "2200",
  OTHER_LIABILITIES: "2300",
  PARTNER_LOANS: "2400",
  OWNER_CAPITAL: "3100",
  PARTNER_CAPITAL: "3110",
  PARTNER_DRAWINGS: "3200",
  RETAINED_EARNINGS: "3300",
  CURRENT_PL: "3400",
  OPENING_EQUITY: "3500",
  SALES: "4100",
  OTHER_INCOME: "4200",
  SALES_RETURNS: "4300",
  SALES_DISCOUNTS: "4400",
  COGS: "5100",
  RENT: "5200",
  SALARIES: "5300",
  UTILITIES: "5400",
  TRANSPORT: "5500",
  INTERNET: "5600",
  MAINTENANCE: "5700",
  SUPPLIES: "5800",
  MARKETING: "5900",
  TAX_FEES: "5950",
  INVENTORY_ADJUST: "5980",
  OTHER_EXPENSE: "5990",
};

export const JOURNAL_TYPES = {
  SALE: "sale",
  SALE_RETURN: "sale_return",
  SALE_PAYMENT: "sale_payment",
  PURCHASE: "purchase",
  PURCHASE_PAYMENT: "purchase_payment",
  EXPENSE: "expense",
  PARTNER: "partner",
  CASH: "cash",
  INVENTORY: "inventory",
  OPENING: "opening",
  MANUAL: "manual",
  CLOSING: "closing",
  REVERSAL: "reversal",
};

export const PARTNER_TX_TYPES = [
  { id: "initial_capital", label: "Initial capital" },
  { id: "additional_capital", label: "Additional capital" },
  { id: "withdrawal", label: "Withdrawal / drawings" },
  { id: "loan_to_business", label: "Loan to business" },
  { id: "repayment_to_partner", label: "Repayment to partner" },
  { id: "profit_distribution", label: "Profit distribution" },
  { id: "expense_paid_by_partner", label: "Business expense paid by partner" },
];

export const EXPENSE_ACCOUNT_MAP = {
  rent: ACCOUNT_CODES.RENT,
  salary: ACCOUNT_CODES.SALARIES,
  utilities: ACCOUNT_CODES.UTILITIES,
  transport: ACCOUNT_CODES.TRANSPORT,
  maintenance: ACCOUNT_CODES.MAINTENANCE,
  supplies: ACCOUNT_CODES.SUPPLIES,
  marketing: ACCOUNT_CODES.MARKETING,
  tax: ACCOUNT_CODES.TAX_FEES,
  other: ACCOUNT_CODES.OTHER_EXPENSE,
};

export const DEFAULT_ACCOUNT_GROUPS = [
  { code: "1000", name: "Assets", name_ar: "الأصول", type: ACCOUNT_TYPES.ASSET, sort_order: 10 },
  { code: "2000", name: "Liabilities", name_ar: "الخصوم", type: ACCOUNT_TYPES.LIABILITY, sort_order: 20 },
  { code: "3000", name: "Equity", name_ar: "حقوق الملكية", type: ACCOUNT_TYPES.EQUITY, sort_order: 30 },
  { code: "4000", name: "Revenue", name_ar: "الإيرادات", type: ACCOUNT_TYPES.REVENUE, sort_order: 40 },
  { code: "5000", name: "Expenses", name_ar: "المصروفات", type: ACCOUNT_TYPES.EXPENSE, sort_order: 50 },
];

export const DEFAULT_ACCOUNTS = [
  { code: ACCOUNT_CODES.CASH, group: "1000", name: "Cash on hand", name_ar: "الصندوق", type: ACCOUNT_TYPES.ASSET, subtype: "cash", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.BANK, group: "1000", name: "Bank", name_ar: "البنك", type: ACCOUNT_TYPES.ASSET, subtype: "bank", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.AR, group: "1000", name: "Accounts receivable", name_ar: "الذمم المدينة", type: ACCOUNT_TYPES.ASSET, subtype: "ar", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.INVENTORY, group: "1000", name: "Inventory", name_ar: "المخزون", type: ACCOUNT_TYPES.ASSET, subtype: "inventory", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.VAT_INPUT, group: "1000", name: "VAT input", name_ar: "ضريبة مدخلات", type: ACCOUNT_TYPES.ASSET, subtype: "vat", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.OTHER_CURRENT_ASSETS, group: "1000", name: "Other current assets", name_ar: "أصول متداولة أخرى", type: ACCOUNT_TYPES.ASSET, subtype: "other", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.FIXED_ASSETS, group: "1000", name: "Fixed assets", name_ar: "الأصول الثابتة", type: ACCOUNT_TYPES.ASSET, subtype: "fixed", normal: "debit", system: 1 },

  { code: ACCOUNT_CODES.AP, group: "2000", name: "Accounts payable", name_ar: "الذمم الدائنة", type: ACCOUNT_TYPES.LIABILITY, subtype: "ap", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.VAT_OUTPUT, group: "2000", name: "VAT payable", name_ar: "ضريبة القيمة المضافة مستحقة", type: ACCOUNT_TYPES.LIABILITY, subtype: "vat", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.OTHER_LIABILITIES, group: "2000", name: "Other liabilities", name_ar: "خصوم أخرى", type: ACCOUNT_TYPES.LIABILITY, subtype: "other", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.PARTNER_LOANS, group: "2000", name: "Loans from partners", name_ar: "قروض الشركاء", type: ACCOUNT_TYPES.LIABILITY, subtype: "loan", normal: "credit", system: 1 },

  { code: ACCOUNT_CODES.OWNER_CAPITAL, group: "3000", name: "Owner capital", name_ar: "رأس مال المالك", type: ACCOUNT_TYPES.EQUITY, subtype: "capital", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.PARTNER_CAPITAL, group: "3000", name: "Partner capital", name_ar: "رأس مال الشركاء", type: ACCOUNT_TYPES.EQUITY, subtype: "capital", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.PARTNER_DRAWINGS, group: "3000", name: "Partner drawings", name_ar: "مسحوبات الشركاء", type: ACCOUNT_TYPES.EQUITY, subtype: "drawings", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.RETAINED_EARNINGS, group: "3000", name: "Retained earnings", name_ar: "الأرباح المبقاة", type: ACCOUNT_TYPES.EQUITY, subtype: "retained", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.CURRENT_PL, group: "3000", name: "Current year profit / loss", name_ar: "ربح / خسارة السنة", type: ACCOUNT_TYPES.EQUITY, subtype: "pl", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.OPENING_EQUITY, group: "3000", name: "Opening balance equity", name_ar: "حقوق ملكية افتتاحية", type: ACCOUNT_TYPES.EQUITY, subtype: "opening", normal: "credit", system: 1 },

  { code: ACCOUNT_CODES.SALES, group: "4000", name: "Sales", name_ar: "المبيعات", type: ACCOUNT_TYPES.REVENUE, subtype: "sales", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.OTHER_INCOME, group: "4000", name: "Other income", name_ar: "إيرادات أخرى", type: ACCOUNT_TYPES.REVENUE, subtype: "other", normal: "credit", system: 1 },
  { code: ACCOUNT_CODES.SALES_RETURNS, group: "4000", name: "Sales returns", name_ar: "مردودات المبيعات", type: ACCOUNT_TYPES.REVENUE, subtype: "contra", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.SALES_DISCOUNTS, group: "4000", name: "Sales discounts", name_ar: "خصومات المبيعات", type: ACCOUNT_TYPES.REVENUE, subtype: "contra", normal: "debit", system: 1 },

  { code: ACCOUNT_CODES.COGS, group: "5000", name: "Cost of goods sold", name_ar: "تكلفة البضاعة المباعة", type: ACCOUNT_TYPES.EXPENSE, subtype: "cogs", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.RENT, group: "5000", name: "Rent", name_ar: "الإيجار", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.SALARIES, group: "5000", name: "Salaries", name_ar: "الرواتب", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.UTILITIES, group: "5000", name: "Utilities", name_ar: "المرافق", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.TRANSPORT, group: "5000", name: "Transportation", name_ar: "النقل", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.INTERNET, group: "5000", name: "Internet", name_ar: "الإنترنت", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.MAINTENANCE, group: "5000", name: "Maintenance", name_ar: "الصيانة", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.SUPPLIES, group: "5000", name: "Store supplies", name_ar: "مستلزمات المتجر", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.MARKETING, group: "5000", name: "Marketing", name_ar: "التسويق", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.TAX_FEES, group: "5000", name: "Tax & government fees", name_ar: "رسوم حكومية", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.INVENTORY_ADJUST, group: "5000", name: "Inventory adjustments", name_ar: "تسويات المخزون", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
  { code: ACCOUNT_CODES.OTHER_EXPENSE, group: "5000", name: "Other expenses", name_ar: "مصروفات أخرى", type: ACCOUNT_TYPES.EXPENSE, subtype: "operating", normal: "debit", system: 1 },
];

export function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function isAccountingEnabled(settings) {
  const value = settings?.[ACCOUNTING_SETTING_KEYS.ENABLED];
  return value === "1" || value === "true" || value === true;
}

export function formatAccountingRef(prefix, sequence) {
  const num = Math.max(1, Number(sequence) || 1);
  return `${prefix}-${String(num).padStart(6, "0")}`;
}

export function signedBalance(account, debit, credit) {
  const d = roundMoney(debit);
  const c = roundMoney(credit);
  if (account?.normal_balance === "credit") return roundMoney(c - d);
  return roundMoney(d - c);
}

export function dateOnly(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

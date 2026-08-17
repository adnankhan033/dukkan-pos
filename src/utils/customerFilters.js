import { getPeriodDateRange } from "./format";
import { getBusinessDateISO } from "./businessDate";

export const CUSTOMER_FILTER_PERIODS = {
  ALL: "all",
  MONTH: "month",
  CUSTOM: "custom",
};

export const EMPTY_CUSTOMER_FILTERS = {
  customerId: "",
  search: "",
  phone: "",
  address: "",
  from: "",
  to: "",
  fromTime: "00:00",
  toTime: "23:59",
};

export function hasActiveCustomerFilters(filters = {}) {
  return Boolean(
    filters.customerId ||
    filters.search?.trim() ||
    filters.phone?.trim() ||
    filters.address?.trim() ||
    filters.from?.trim() ||
    filters.to?.trim()
  );
}

export function hasCustomerDateRange(filters = {}) {
  return Boolean(filters.from?.trim() || filters.to?.trim());
}

export function filtersForPeriod(period, settings = {}, current = {}) {
  if (period === CUSTOMER_FILTER_PERIODS.ALL) {
    return {
      ...current,
      from: "",
      to: "",
      fromTime: "00:00",
      toTime: "23:59",
    };
  }

  if (period === CUSTOMER_FILTER_PERIODS.MONTH) {
    const anchor = getBusinessDateISO(settings);
    const { from, to } = getPeriodDateRange("monthly", anchor);
    return {
      ...current,
      from,
      to,
      fromTime: "00:00",
      toTime: "23:59",
    };
  }

  return current;
}

export function describeCustomerFilters(filters = {}, customers = []) {
  const parts = [];

  if (filters.customerId) {
    const customer = customers.find(
      (row) => String(row.id ?? row.value) === String(filters.customerId)
    );
    const name = customer?.name || customer?.label;
    parts.push(name ? `Customer: ${name}` : "Customer selected");
  }
  if (filters.search?.trim()) parts.push(`Name/email: "${filters.search.trim()}"`);
  if (filters.phone?.trim()) parts.push(`Phone: ${filters.phone.trim()}`);
  if (filters.address?.trim()) parts.push(`Address: ${filters.address.trim()}`);
  if (filters.from?.trim() || filters.to?.trim()) {
    const from = filters.from?.trim() || "…";
    const to = filters.to?.trim() || "…";
    parts.push(`Invoices: ${from} → ${to}`);
  }

  return parts.length ? parts.join(" · ") : "All customers";
}

export function customerFilterPeriodLabel(period, filters = {}) {
  if (period === CUSTOMER_FILTER_PERIODS.MONTH) return "This month";
  if (period === CUSTOMER_FILTER_PERIODS.CUSTOM && hasCustomerDateRange(filters)) {
    const from = filters.from || "…";
    const to = filters.to || "…";
    return `${from} → ${to}`;
  }
  return "All time";
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Boxes,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { isAccountingEnabled } from "../utils/accounting";
import { getBusinessPeriodDateRange } from "../utils/businessDate";
import PageHeader from "../components/common/PageHeader";
import { StatCard } from "../components/common/Card";
import { LoadingSpinner } from "../components/common/Loading";
import AccountingGate from "../components/common/AccountingGate";
import ProductValueTotals from "../components/products/ProductValueTotals";
import { formatCurrency, todayISO } from "../utils/format";
import "./AccountingHub.css";

export default function AccountingOverview() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const range = useMemo(() => getBusinessPeriodDateRange("monthly", settings), [settings]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await accountingService.dashboard({ from: range.from, to: range.to || todayISO() }));
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="acct-hub">
      <PageHeader
        title="Accounting"
        subtitle="Sales and profit come from the books (without VAT). Cash is the till."
      />
      <AccountingGate enabled={enabled}>
        {loading ? (
          <LoadingSpinner message="Loading financial summary..." />
        ) : (
          <div className="acct-kpi-grid">
            <StatCard label="Sales (without VAT)" numericValue={data?.sales} currency={currency} icon={TrendingUp} />
            <StatCard label="Gross profit" numericValue={data?.grossProfit} currency={currency} icon={Scale} />
            <StatCard label="Net profit" numericValue={data?.netProfit} currency={currency} icon={PiggyBank} featured />
            <StatCard label="Expenses" numericValue={data?.expenses} currency={currency} icon={Receipt} />
            <StatCard label="Cash" numericValue={data?.cash} currency={currency} icon={Wallet} />
            <StatCard label="Bank" numericValue={data?.bank} currency={currency} icon={Landmark} />
            <StatCard
              label="Inventory at cost"
              value={formatCurrency(data?.inventory, currency)}
              numericValue={data?.inventory}
              currency={currency}
              icon={Boxes}
            />
            <StatCard label="Receivable" numericValue={data?.receivable} currency={currency} icon={Users} />
            <StatCard label="Payable" numericValue={data?.payable} currency={currency} icon={Banknote} />
            <StatCard label="Partner capital" numericValue={data?.partnerCapital} currency={currency} icon={Users} />
          </div>
        )}
        {!loading ? (
          <ProductValueTotals
            quantity={data?.inventoryQty}
            purchaseTotal={data?.inventory}
            sellingTotal={data?.inventorySelling}
            currency={currency}
            productCount={data?.inventoryProductCount}
          />
        ) : null}
      </AccountingGate>
    </div>
  );
}

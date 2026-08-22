import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  ClipboardList,
  Package,
  BarChart3,
  Boxes,
  Users,
  Settings,
  Wallet,
  Banknote,
  Truck,
  CalendarCheck,
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import "./DashboardQuickNav.css";

const NAV_ITEMS = [
  { path: "/sales", label: "POS", hint: "New sale", icon: ShoppingCart, module: "sales" },
  { path: "/orders", label: "Invoices", hint: "History", icon: ClipboardList, module: "sales" },
  { path: "/products", label: "Products", hint: "Catalog", icon: Package, module: "products" },
  { path: "/inventory", label: "Stock", hint: "On hand", icon: Boxes, module: "inventory" },
  { path: "/purchases", label: "Purchases", hint: "Stock in", icon: Truck, module: "purchasing" },
  { path: "/customers", label: "Customers", hint: "Accounts", icon: Users, module: "customers" },
  { path: "/accounting/receive", label: "Receive", hint: "Collect cash", icon: Banknote, module: "cash_bank" },
  { path: "/accounting/pay", label: "Pay", hint: "Pay out", icon: Wallet, module: "cash_bank" },
  { path: "/daily-close", label: "Close day", hint: "Till count", icon: CalendarCheck, module: "reports" },
  { path: "/reports", label: "Reports", hint: "Numbers", icon: BarChart3, module: "reports" },
  { path: "/settings", label: "Settings", hint: "Store", icon: Settings, module: "settings" },
];

export default function DashboardQuickNav({ variant = "admin" }) {
  const navigate = useNavigate();
  const { canAccessModule, canAccessPath } = usePermissions();

  const items =
    variant === "cashier"
      ? NAV_ITEMS.filter(
          (item) =>
            ["/sales", "/orders", "/products", "/reports"].includes(item.path) && canAccessPath(item.path)
        )
      : NAV_ITEMS.filter((item) => canAccessModule(item.module) && canAccessPath(item.path));

  if (!items.length) return null;

  return (
    <nav className="dashboard-quick-nav" aria-label="Quick navigation">
      <div className="dashboard-quick-nav-track">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              className="dashboard-quick-nav-item"
              onClick={() => navigate(item.path)}
            >
              <span className="dashboard-quick-nav-icon">
                <Icon size={20} />
              </span>
              <span className="dashboard-quick-nav-text">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

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
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import "./DashboardQuickNav.css";

const NAV_ITEMS = [
  { path: "/sales", label: "POS", hint: "New sale", icon: ShoppingCart, module: "sales" },
  { path: "/orders", label: "Orders", hint: "History", icon: ClipboardList, module: "sales" },
  { path: "/products", label: "Products", hint: "Catalog", icon: Package, module: "products" },
  { path: "/inventory", label: "Stock", hint: "Levels", icon: Boxes, module: "inventory" },
  { path: "/customers", label: "Customers", hint: "CRM", icon: Users, module: "customers" },
  { path: "/accounting/receive", label: "Receive cash", hint: "Collect dues", icon: Banknote, module: "accounting" },
  { path: "/accounting/pay", label: "Pay cash", hint: "Pay suppliers", icon: Wallet, module: "accounting" },
  { path: "/reports", label: "Reports", hint: "Analytics", icon: BarChart3, module: "reports" },
  { path: "/settings", label: "Settings", hint: "Store", icon: Settings, module: "settings" },
];

export default function DashboardQuickNav({ variant = "admin" }) {
  const navigate = useNavigate();
  const { canAccessModule } = usePermissions();

  const items =
    variant === "cashier"
      ? NAV_ITEMS.filter((item) => ["/sales", "/orders", "/products"].includes(item.path))
      : NAV_ITEMS.filter((item) => canAccessModule(item.module));

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

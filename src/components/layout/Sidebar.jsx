import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  Truck,
  Warehouse,
  Users,
  Building2,
  Tags,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { NAV_ITEMS } from "../../utils/constants";
import { useAuthStore } from "../../contexts/store";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../contexts/store";
import Button from "../common/Button";
import "./Sidebar.css";

const ICONS = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  Truck,
  Warehouse,
  Users,
  Building2,
  Tags,
  Receipt,
  BarChart3,
  Settings,
};

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const settings = useSettingsStore((s) => s.settings);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>{settings.store_name || "Portal POS"}</h2>
        <span>Point of Sale v1.0</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] || LayoutDashboard;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || user?.username}</span>
            <span className="sidebar-user-role">{user?.role || "user"}</span>
          </div>
          <div className="sidebar-actions">
            <Button variant="ghost" size="sm" className="btn-icon" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button variant="ghost" size="sm" className="btn-icon" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

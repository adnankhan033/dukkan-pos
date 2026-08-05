import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Building2,
  Receipt,
  BarChart3,
  Settings,
  Shield,
  CreditCard,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
} from "lucide-react";
import { useVisibleNavGroups } from "../../hooks/usePermissions";
import { ROLE_LABELS, normalizeRole } from "../../utils/roles";
import { useAuthStore } from "../../contexts/store";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../contexts/store";
import Button from "../common/Button";
import "./Sidebar.css";

const ICONS = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Building2,
  Receipt,
  BarChart3,
  Settings,
  Shield,
  CreditCard,
};

function isPathActive(pathname, path) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function groupHasActiveChild(group, pathname) {
  return group.items?.some((item) => isPathActive(pathname, item.path));
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const settings = useSettingsStore((s) => s.settings);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const visibleGroups = useVisibleNavGroups();
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of visibleGroups) {
        if (group.id === "sales") {
          next.sales = true;
        }
        if (group.items && groupHasActiveChild(group, pathname)) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [pathname, visibleGroups]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function toggleGroup(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>{settings.store_name || "DukkanPOS"}</h2>
        {settings.store_name_ar && (
          <p className="sidebar-brand-ar" dir="rtl">
            {settings.store_name_ar}
          </p>
        )}
        <span>DukkanPOS v1.0</span>
      </div>

      <nav className="sidebar-nav">
        {visibleGroups.map((group) => {
          const Icon = ICONS[group.icon] || LayoutDashboard;

          if (group.path) {
            return (
              <NavLink
                key={group.id}
                to={group.path}
                end={group.path === "/"}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} />
                {group.label}
              </NavLink>
            );
          }

          const isOpen = expanded[group.id];
          const hasActiveChild = groupHasActiveChild(group, pathname);

          return (
            <div key={group.id} className="sidebar-group">
              <button
                type="button"
                className={`sidebar-group-toggle ${hasActiveChild ? "has-active" : ""}`}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
              >
                <span className="sidebar-group-label">
                  <Icon size={18} />
                  {group.label}
                </span>
                <ChevronDown
                  size={16}
                  className={`sidebar-chevron ${isOpen ? "open" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="sidebar-subnav">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `sidebar-sublink ${isActive ? "active" : ""}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || user?.username}</span>
            <span className="sidebar-user-role">
              {ROLE_LABELS[normalizeRole(user?.role)] || user?.role || "user"}
            </span>
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

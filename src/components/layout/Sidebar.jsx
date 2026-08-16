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
  CalendarCheck,
  Settings,
  Shield,
  CreditCard,
  CloudUpload,
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
import { resolveSoftwareVendor } from "../../utils/softwareVendor";
import SoftwareVendorModal from "../vendor/SoftwareVendorModal";
import SidebarVendorCard from "./SidebarVendorCard";
import Button from "../common/Button";
import "./Sidebar.css";
import "./SidebarVendorCard.css";

const ICONS = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Building2,
  Receipt,
  BarChart3,
  CalendarCheck,
  Settings,
  Shield,
  CreditCard,
  CloudUpload,
};

function isPathActive(pathname, path) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function groupHasActiveChild(group, pathname) {
  return group.items?.some((item) => isPathActive(pathname, item.path));
}

function NavIcon({ icon: Icon }) {
  return (
    <span className="sidebar-nav-icon" aria-hidden="true">
      <Icon size={17} strokeWidth={2.1} />
    </span>
  );
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
  const [vendorOpen, setVendorOpen] = useState(false);
  const vendor = resolveSoftwareVendor(settings);

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
        <div className="sidebar-brand-icon">D</div>
        <div className="sidebar-brand-text">
          <h2>{settings.store_name || "DukkanPOS"}</h2>
          {settings.store_name_ar && (
            <p className="sidebar-brand-ar" dir="rtl">
              {settings.store_name_ar}
            </p>
          )}
          <span className="sidebar-brand-version">DukkanPOS v1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="sidebar-nav-heading">Menu</p>

        {visibleGroups.map((group) => {
          const Icon = ICONS[group.icon] || LayoutDashboard;

          if (group.path) {
            return (
              <div key={group.id} className="sidebar-nav-block">
                <NavLink
                  to={group.path}
                  end={group.path === "/"}
                  className={({ isActive }) =>
                    `sidebar-nav-parent sidebar-nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <NavIcon icon={Icon} />
                  <span className="sidebar-nav-label">{group.label}</span>
                </NavLink>
              </div>
            );
          }

          const isOpen = expanded[group.id];
          const hasActiveChild = groupHasActiveChild(group, pathname);
          const childCount = group.items?.length ?? 0;

          return (
            <div
              key={group.id}
              className={`sidebar-nav-block sidebar-nav-group ${isOpen ? "open" : ""} ${hasActiveChild ? "has-active-child" : ""}`}
            >
              <button
                type="button"
                className={`sidebar-nav-parent sidebar-nav-toggle ${isOpen ? "open" : ""} ${hasActiveChild ? "active" : ""}`}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
              >
                <NavIcon icon={Icon} />
                <span className="sidebar-nav-label">{group.label}</span>
                <span className="sidebar-nav-meta">
                  <span className="sidebar-nav-count">{childCount}</span>
                  <ChevronDown size={15} className={`sidebar-nav-chevron ${isOpen ? "open" : ""}`} />
                </span>
              </button>

              <div className={`sidebar-subnav-panel ${isOpen ? "open" : ""}`}>
                <div className="sidebar-subnav-inner">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `sidebar-nav-child ${isActive ? "active" : ""}`
                      }
                    >
                      <span className="sidebar-nav-child-track" aria-hidden="true">
                        <span className="sidebar-nav-child-line" />
                        <span className="sidebar-nav-child-dot" />
                      </span>
                      <span className="sidebar-nav-child-label">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-vendor-stack">
        {vendor.enabled && (
          <SidebarVendorCard vendor={vendor} onClick={() => setVendorOpen(true)} variant="partner" />
        )}
      </div>

      <SoftwareVendorModal vendor={vendor} isOpen={vendorOpen} onClose={() => setVendorOpen(false)} />

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {(user?.full_name || user?.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || user?.username}</span>
            <span className="sidebar-user-role">
              {ROLE_LABELS[normalizeRole(user?.role)] || user?.role || "user"}
            </span>
          </div>
          <div className="sidebar-actions">
            <Button variant="ghost" size="sm" className="btn-icon sidebar-action-btn" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button variant="ghost" size="sm" className="btn-icon sidebar-action-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

import { useEffect, useRef, useState } from "react";
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
  Landmark,
  BookOpen,
  Handshake,
  Scale,
  Wallet,
  Shield,
  CreditCard,
  CloudUpload,
  IdCard,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useVisibleNavGroups } from "../../hooks/usePermissions";
import { ROLE_LABELS, normalizeRole } from "../../utils/roles";
import { useAuthStore } from "../../contexts/store";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
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
  Landmark,
  BookOpen,
  Handshake,
  Scale,
  Wallet,
  Shield,
  CreditCard,
  CloudUpload,
  IdCard,
};

function isPathActive(pathname, path) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function groupHasActiveChild(group, pathname) {
  return group.items?.some((item) => isPathActive(pathname, item.path));
}

function NavIcon({ icon: Icon, compact = false }) {
  return (
    <span className={`sidebar-nav-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <Icon size={17} strokeWidth={2.1} />
    </span>
  );
}

function SidebarToggle({ mode, onToggle, onHide, onExpand }) {
  if (mode === "hidden") {
    return (
      <button
        type="button"
        className="sidebar-reveal-tab"
        onClick={onExpand}
        title="Show sidebar (Ctrl+B)"
        aria-label="Show sidebar"
      >
        <span className="sidebar-reveal-tab-glow" aria-hidden="true" />
        <PanelLeftOpen size={18} strokeWidth={2.2} />
        <span className="sidebar-reveal-tab-label">Menu</span>
      </button>
    );
  }

  const toggleTitle =
    mode === "expanded" ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)";
  const hideTitle = "Hide sidebar (Ctrl+Shift+B)";

  return (
    <div className="sidebar-edge-controls">
      <button
        type="button"
        className="sidebar-edge-toggle"
        onClick={onToggle}
        title={toggleTitle}
        aria-label={toggleTitle}
      >
        {mode === "expanded" ? (
          <ChevronLeft size={16} strokeWidth={2.4} />
        ) : (
          <ChevronRight size={16} strokeWidth={2.4} />
        )}
      </button>
      <button
        type="button"
        className="sidebar-edge-hide"
        onClick={onHide}
        title={hideTitle}
        aria-label={hideTitle}
      >
        <PanelLeftClose size={13} strokeWidth={2.3} />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const settings = useSettingsStore((s) => s.settings);
  const { isDark, toggleTheme } = useTheme();
  const { mode, isMini, isHidden, toggle, hide, expand } = useSidebar();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const visibleGroups = useVisibleNavGroups();
  const [expanded, setExpanded] = useState({});
  const [flyoutGroupId, setFlyoutGroupId] = useState(null);
  const [vendorOpen, setVendorOpen] = useState(false);
  const flyoutCloseTimer = useRef(null);
  const vendor = resolveSoftwareVendor(settings);

  useEffect(() => {
    const activeGroupId = visibleGroups.find(
      (group) => group.items && groupHasActiveChild(group, pathname)
    )?.id;

    setExpanded(activeGroupId ? { [activeGroupId]: true } : {});
  }, [pathname, visibleGroups]);

  useEffect(() => {
    setFlyoutGroupId(null);
  }, [pathname, mode]);

  useEffect(
    () => () => {
      if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    },
    []
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function toggleGroup(id) {
    if (isMini) {
      setFlyoutGroupId((prev) => (prev === id ? null : id));
      return;
    }
    setExpanded((prev) => (prev[id] ? {} : { [id]: true }));
  }

  function openFlyout(id) {
    if (!isMini) return;
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    setFlyoutGroupId(id);
  }

  function scheduleFlyoutClose() {
    if (!isMini) return;
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => setFlyoutGroupId(null), 180);
  }

  function cancelFlyoutClose() {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
  }

  return (
    <>
      <SidebarToggle mode={mode} onToggle={toggle} onHide={hide} onExpand={expand} />

      <aside
        className={`sidebar sidebar--${mode}`}
        aria-hidden={isHidden}
        data-sidebar-mode={mode}
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" title={settings.store_name || "Nexttel POS"}>
            N
          </div>
          <div className="sidebar-brand-text">
            <h2>{settings.store_name || "Nexttel POS"}</h2>
            {settings.store_name_ar && (
              <p className="sidebar-brand-ar" dir="rtl">
                {settings.store_name_ar}
              </p>
            )}
            <span className="sidebar-brand-version">Nexttel POS v1.0</span>
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
                    title={isMini ? group.label : undefined}
                  >
                    <NavIcon icon={Icon} compact={isMini} />
                    <span className="sidebar-nav-label">{group.label}</span>
                    {isMini && <span className="sidebar-nav-tooltip">{group.label}</span>}
                  </NavLink>
                </div>
              );
            }

            const isOpen = isMini ? flyoutGroupId === group.id : expanded[group.id];
            const hasActiveChild = groupHasActiveChild(group, pathname);
            const childCount = group.items?.length ?? 0;

            return (
              <div
                key={group.id}
                className={`sidebar-nav-block sidebar-nav-group ${isOpen ? "open" : ""} ${hasActiveChild ? "has-active-child" : ""}`}
                onMouseEnter={() => openFlyout(group.id)}
                onMouseLeave={scheduleFlyoutClose}
              >
                <button
                  type="button"
                  className={`sidebar-nav-parent sidebar-nav-toggle ${isOpen ? "open" : ""} ${hasActiveChild ? "active" : ""}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  title={isMini ? group.label : undefined}
                >
                  <NavIcon icon={Icon} compact={isMini} />
                  <span className="sidebar-nav-label">{group.label}</span>
                  <span className="sidebar-nav-meta">
                    <span className="sidebar-nav-count">{childCount}</span>
                    <ChevronDown size={15} className={`sidebar-nav-chevron ${isOpen ? "open" : ""}`} />
                  </span>
                  {isMini && <span className="sidebar-nav-tooltip">{group.label}</span>}
                </button>

                {isMini ? (
                  <div
                    className={`sidebar-flyout ${isOpen ? "open" : ""}`}
                    onMouseEnter={cancelFlyoutClose}
                    onMouseLeave={scheduleFlyoutClose}
                  >
                    <div className="sidebar-flyout-header">
                      <NavIcon icon={Icon} />
                      <span>{group.label}</span>
                    </div>
                    <div className="sidebar-flyout-links">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            `sidebar-flyout-link ${isActive ? "active" : ""}`
                          }
                          onClick={() => setFlyoutGroupId(null)}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-vendor-stack">
          {vendor.enabled && (
            <SidebarVendorCard
              vendor={vendor}
              onClick={() => setVendorOpen(true)}
              variant="partner"
              compact={isMini}
            />
          )}
        </div>

        <SoftwareVendorModal vendor={vendor} isOpen={vendorOpen} onClose={() => setVendorOpen(false)} />

        <div className="sidebar-footer">
          <div className="sidebar-user-card" title={isMini ? user?.full_name || user?.username : undefined}>
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
              <Button
                variant="ghost"
                size="sm"
                className="btn-icon sidebar-action-btn"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="btn-icon sidebar-action-btn"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={16} />
              </Button>
            </div>
            {isMini && (
              <div className="sidebar-user-popover">
                <strong>{user?.full_name || user?.username}</strong>
                <span>{ROLE_LABELS[normalizeRole(user?.role)] || user?.role || "user"}</span>
                <div className="sidebar-user-popover-actions">
                  <button type="button" onClick={toggleTheme}>
                    {isDark ? <Sun size={15} /> : <Moon size={15} />}
                    Theme
                  </button>
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

import { ChevronRight, Sparkles } from "lucide-react";
import "./SidebarVendorCard.css";

export default function SidebarVendorCard({ vendor, onClick, variant = "partner", compact = false }) {
  const isAdminLink = variant === "admin";
  const title = isAdminLink ? "Vendor Branding" : vendor.menuLabel;
  const subtitle = isAdminLink
    ? "Edit software company profile"
    : vendor.isConfigured
      ? "Powered by · Tap for details"
      : "Software partner";

  return (
    <div className={`sidebar-vendor-wrap ${isAdminLink ? "admin" : "partner"} ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className={`sidebar-vendor-card ${vendor.sidebarPulse && !isAdminLink ? "pulse" : ""} ${isAdminLink ? "admin" : ""} ${compact ? "compact" : ""}`}
        onClick={onClick}
        title={isAdminLink ? "Manage vendor branding" : title}
      >
        <span className="sidebar-vendor-border" aria-hidden="true" />
        <span className="sidebar-vendor-shine" aria-hidden="true" />
        <span className="sidebar-vendor-glow" aria-hidden="true" />

        <span className="sidebar-vendor-avatar">
          {isAdminLink ? <Sparkles size={15} strokeWidth={2.5} /> : vendor.initials}
        </span>

        {!compact && (
          <>
            <span className="sidebar-vendor-body">
              {!isAdminLink && (
                <span className="sidebar-vendor-chip">
                  <span className="sidebar-vendor-live" aria-hidden="true" />
                  Partner
                </span>
              )}
              {isAdminLink && <span className="sidebar-vendor-chip admin">Super Admin</span>}
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>

            <ChevronRight size={16} className="sidebar-vendor-arrow" />
          </>
        )}
      </button>
    </div>
  );
}

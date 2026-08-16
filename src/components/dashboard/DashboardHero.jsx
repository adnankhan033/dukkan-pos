import { useEffect, useState } from "react";
import { Sparkles, Store } from "lucide-react";
import { useSettingsStore, useAuthStore } from "../../contexts/store";
import { getBusinessDateTimeLabel } from "../../utils/businessDate";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function splitDateTime(datetime) {
  if (!datetime) return { date: "—", time: "—" };
  const parts = String(datetime).split(",");
  if (parts.length >= 2) {
    return { date: parts[0].trim(), time: parts.slice(1).join(",").trim() };
  }
  const space = datetime.lastIndexOf(" ");
  if (space > 0) {
    return {
      date: datetime.slice(0, space).trim(),
      time: datetime.slice(space).trim(),
    };
  }
  return { date: datetime, time: "" };
}

export default function DashboardHero({ variant = "admin", actions, children, chips = [] }) {
  const settings = useSettingsStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const storeName = settings.store_name?.trim() || "Dukkan POS";
  const storeNameAr = settings.store_name_ar?.trim();
  const userName = user?.full_name?.trim() || user?.username?.trim();
  const firstName = userName?.split(" ")[0];
  const [clock, setClock] = useState(() => getBusinessDateTimeLabel(settings));
  const { date, time } = splitDateTime(clock.datetime);

  useEffect(() => {
    const tick = () => setClock(getBusinessDateTimeLabel(settings));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings]);

  return (
    <section className={`dashboard-hero dashboard-hero-${variant}`}>
      <div className="dashboard-hero-bg" aria-hidden="true">
        <span className="dashboard-hero-orb dashboard-hero-orb-1" />
        <span className="dashboard-hero-orb dashboard-hero-orb-2" />
        <span className="dashboard-hero-orb dashboard-hero-orb-3" />
        <span className="dashboard-hero-grid" />
        <span className="dashboard-hero-shimmer" />
        <span className="dashboard-hero-mesh" />
      </div>

      <div className="dashboard-hero-content">
        <div className="dashboard-hero-main">
          <div className="dashboard-hero-badge">
            <span className="dashboard-live-dot" aria-hidden="true" />
            <Sparkles size={14} />
            <span>{variant === "admin" ? "Your command center" : "Ready to sell"}</span>
          </div>
          <h1 className="dashboard-hero-title">
            {getGreeting()}
            {firstName ? (
              <>
                , <span className="dashboard-hero-name">{firstName}</span>
              </>
            ) : null}
          </h1>
          <div className="dashboard-hero-store">
            <Store size={18} />
            <span>{storeName}</span>
            {storeNameAr ? (
              <span className="dashboard-hero-store-ar" dir="rtl">
                {storeNameAr}
              </span>
            ) : null}
          </div>
          <p className="dashboard-hero-subtitle">
            {variant === "admin"
              ? "Everything you need to run your store — sales, stock, and insights in one place."
              : "One tap to open POS. Scan, sell, and you're done."}
          </p>
        </div>

        <div className="dashboard-hero-side">
          <div className="dashboard-hero-clock">
            <div className="dashboard-hero-clock-label">
              <span className="dashboard-live-dot sm" aria-hidden="true" />
              Live store time
            </div>
            <div className="dashboard-hero-clock-split">
              <span className="dashboard-hero-clock-date">{date}</span>
              <span className="dashboard-hero-clock-time">{time}</span>
            </div>
            <div className="dashboard-hero-clock-region">{clock.region}</div>
            {clock.isOverride ? (
              <div className="dashboard-hero-clock-note">Manual business time is on</div>
            ) : null}
          </div>
          {actions ? <div className="dashboard-hero-actions">{actions}</div> : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="dashboard-hero-chips">
          {chips.map((chip) => (
            <div key={chip.label} className={`dashboard-hero-chip ${chip.tone || ""}`}>
              <span className="dashboard-hero-chip-label">{chip.label}</span>
              <strong>{chip.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {children ? <div className="dashboard-hero-footer">{children}</div> : null}
    </section>
  );
}

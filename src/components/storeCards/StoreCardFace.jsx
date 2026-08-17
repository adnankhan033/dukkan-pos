import { Clock, MapPin, Phone } from "lucide-react";
import { storeCardInitials } from "../../utils/storeCardProfile";
import "./StoreCardFace.css";

function CardOrnaments() {
  return (
    <div className="store-card-ornaments" aria-hidden="true">
      <span className="store-card-orb store-card-orb-a" />
      <span className="store-card-orb store-card-orb-b" />
      <span className="store-card-geo" />
      <span className="store-card-foil" />
      <span className="store-card-shine" />
      <span className="store-card-chip" />
      <span className="store-card-ribbon" />
      <span className="store-card-edge" />
    </div>
  );
}

function MetaRow({ icon: Icon, label, value, strong = false }) {
  if (!value) return null;
  return (
    <p className={`store-card-row ${strong ? "hero" : ""}`}>
      <Icon size={12} strokeWidth={2.4} />
      <span className="store-card-row-label">{label}</span>
      <span className="store-card-row-value">{value}</span>
    </p>
  );
}

export default function StoreCardFace({ profile, theme, qrDataUrl, size = "md" }) {
  const initials = storeCardInitials(profile.name);
  const website = profile.website ? profile.website.replace(/^https?:\/\//i, "") : "";

  return (
    <article className={`store-card store-card-${theme} store-card-${size}`}>
      <CardOrnaments />

      <div className="store-card-brand-col" aria-hidden="true">
        <span className="store-card-mono">{initials}</span>
        <span className="store-card-mono-sub">VIP</span>
      </div>

      <div className="store-card-inner">
        <header className="store-card-head">
          <span className="store-card-mark">
            <span className="store-card-mark-ring" />
            <span className="store-card-mark-text">{initials}</span>
          </span>
          <div className="store-card-head-text">
            <span className="store-card-kicker">Your neighborhood store</span>
            <h3 className="store-card-name">{profile.name || "Your store"}</h3>
            {profile.nameAr ? (
              <p className="store-card-name-ar" dir="rtl">
                {profile.nameAr}
              </p>
            ) : null}
          </div>
        </header>

        {profile.tagline ? <p className="store-card-tagline">{profile.tagline}</p> : null}

        <p className="store-card-phone-hero">{profile.phone || profile.whatsapp || ""}</p>

        <div className="store-card-body">
          <div className="store-card-meta">
            <MetaRow icon={Phone} label="Call" value={profile.phone} strong />
            {profile.whatsapp && profile.whatsapp !== profile.phone ? (
              <MetaRow icon={Phone} label="WhatsApp" value={profile.whatsapp} />
            ) : null}
            <MetaRow icon={Clock} label="Hours" value={profile.hours} />
            <MetaRow icon={MapPin} label="Visit" value={profile.address} />
          </div>

          <div className="store-card-qr-wrap">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="" className="store-card-qr" />
            ) : (
              <div className="store-card-qr store-card-qr-empty" />
            )}
            <small>Scan · WhatsApp</small>
          </div>
        </div>

        {(website || profile.email) && (
          <footer className="store-card-foot">
            {website ? <span>{website}</span> : null}
            {profile.email ? <span>{profile.email}</span> : null}
          </footer>
        )}
      </div>
    </article>
  );
}

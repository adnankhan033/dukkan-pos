import { MapPin, Phone } from "lucide-react";
import { storeCardInitials } from "../../utils/storeCardProfile";
import "./StoreCardFace.css";

function Decor({ theme }) {
  if (theme === "emerald") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="xMaxYMin slice">
        <circle cx="430" cy="18" r="92" fill="#6ee7b7" opacity="0.35" />
        <circle cx="390" cy="70" r="46" fill="#ffffff" opacity="0.45" />
        <circle cx="468" cy="108" r="34" fill="#34d399" opacity="0.28" />
        <ellipse cx="70" cy="-10" rx="90" ry="60" fill="#ffffff" opacity="0.35" />
      </svg>
    );
  }
  if (theme === "midnight") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="none">
        <rect x="312" y="-40" width="34" height="280" rx="17" transform="rotate(16 329 100)" fill="#fde68a" />
        <rect x="358" y="-40" width="12" height="280" rx="6" transform="rotate(16 364 100)" fill="#c7d2fe" />
        <circle cx="70" cy="28" r="8" fill="#a5b4fc" />
        <circle cx="96" cy="28" r="5" fill="#fde68a" />
      </svg>
    );
  }
  if (theme === "oasis") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="xMaxYMin slice">
        <circle cx="420" cy="200" r="120" fill="none" stroke="#7dd3fc" strokeWidth="14" opacity="0.55" />
        <circle cx="420" cy="200" r="78" fill="none" stroke="#38bdf8" strokeWidth="10" opacity="0.35" />
        <circle cx="40" cy="20" r="50" fill="#ffffff" opacity="0.4" />
      </svg>
    );
  }
  if (theme === "dune") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="xMaxYMin meet">
        <path d="M300 210 A90 90 0 0 1 480 210" fill="none" stroke="#fdba74" strokeWidth="14" />
        <path d="M328 210 A62 62 0 0 1 452 210" fill="none" stroke="#fed7aa" strokeWidth="14" />
        <path d="M356 210 A34 34 0 0 1 424 210" fill="none" stroke="#fff7ed" strokeWidth="14" />
        <circle cx="52" cy="36" r="18" fill="#ffedd5" />
      </svg>
    );
  }
  if (theme === "royal") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210">
        <circle cx="412" cy="32" r="12" fill="#fb7185" opacity="0.55" />
        <circle cx="444" cy="62" r="22" fill="#f9a8d4" opacity="0.7" />
        <circle cx="392" cy="78" r="8" fill="#ffffff" />
        <circle cx="458" cy="118" r="36" fill="#fbcfe8" opacity="0.8" />
        <circle cx="56" cy="24" r="26" fill="#ffffff" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg className="poster-deco" viewBox="0 0 480 210">
      <rect x="338" y="18" width="118" height="118" rx="28" fill="none" stroke="#facc15" strokeWidth="8" />
      <rect x="368" y="48" width="118" height="118" rx="28" fill="#fde68a" />
      <circle cx="58" cy="32" r="22" fill="#fffbeb" />
    </svg>
  );
}

export default function StoreCardFace({ profile, theme, qrDataUrl, size = "md" }) {
  const initials = storeCardInitials(profile.name);
  const phone = profile.phone || profile.whatsapp || "";
  const place = [profile.address, profile.hours].filter(Boolean).join(" · ");

  return (
    <article className={`poster-card poster-${theme} poster-${size}`}>
      <div className="poster-hero">
        <span className="poster-grain" aria-hidden="true" />
        <Decor theme={theme} />
        <span className="poster-initials">{initials}</span>
        <span className="poster-chip">Store card</span>
        <h3 className="poster-name">{profile.name || "Your store"}</h3>
        {profile.nameAr ? (
          <p className="poster-ar" dir="rtl">
            {profile.nameAr}
          </p>
        ) : null}
        <span className="poster-rule" aria-hidden="true" />
        {profile.tagline ? <p className="poster-tag">{profile.tagline}</p> : null}
      </div>

      <div className="poster-dock">
        <div className="poster-dock-text">
          {phone ? (
            <p className="poster-phone">
              <span className="poster-phone-icon">
                <Phone size={14} strokeWidth={2.6} />
              </span>
              {phone}
            </p>
          ) : null}
          {place ? (
            <p className="poster-place">
              <MapPin size={13} strokeWidth={2.4} />
              {place}
            </p>
          ) : null}
        </div>
        <div className="poster-qr">
          {qrDataUrl ? <img src={qrDataUrl} alt="" /> : <span />}
          <small>Scan</small>
        </div>
      </div>
    </article>
  );
}

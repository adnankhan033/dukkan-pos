import { MapPin, Phone } from "lucide-react";
import { storeCardInitials } from "../../utils/storeCardProfile";
import "./StoreCardFace.css";

function Decor({ theme }) {
  if (theme === "emerald") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="xMaxYMin slice">
        <circle cx="410" cy="30" r="78" fill="rgba(16,185,129,0.18)" />
        <circle cx="455" cy="95" r="52" fill="rgba(52,211,153,0.28)" />
        <circle cx="360" cy="120" r="28" fill="rgba(167,243,208,0.7)" />
      </svg>
    );
  }
  if (theme === "midnight") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="none">
        <rect x="300" y="-20" width="28" height="260" transform="rotate(18 314 110)" fill="rgba(253,224,71,0.85)" />
        <rect x="350" y="-20" width="10" height="260" transform="rotate(18 355 110)" fill="rgba(165,180,252,0.45)" />
      </svg>
    );
  }
  if (theme === "oasis") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="none">
        <path d="M0 150 Q120 90 240 150 T480 150 V210 H0 Z" fill="rgba(125,211,252,0.45)" />
        <path d="M0 170 Q140 120 260 170 T480 170 V210 H0 Z" fill="rgba(186,230,253,0.7)" />
      </svg>
    );
  }
  if (theme === "dune") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210" preserveAspectRatio="xMaxYMin meet">
        <path d="M330 210 A70 70 0 0 1 470 210" fill="none" stroke="rgba(251,146,60,0.35)" strokeWidth="10" />
        <path d="M350 210 A50 50 0 0 1 450 210" fill="none" stroke="rgba(253,186,116,0.55)" strokeWidth="10" />
        <path d="M370 210 A30 30 0 0 1 430 210" fill="none" stroke="rgba(254,215,170,0.9)" strokeWidth="10" />
      </svg>
    );
  }
  if (theme === "royal") {
    return (
      <svg className="poster-deco" viewBox="0 0 480 210">
        <circle cx="400" cy="40" r="10" fill="rgba(244,114,182,0.45)" />
        <circle cx="430" cy="78" r="16" fill="rgba(251,113,133,0.4)" />
        <circle cx="368" cy="86" r="8" fill="rgba(253,164,175,0.7)" />
        <circle cx="448" cy="130" r="22" fill="rgba(252,231,243,0.9)" />
      </svg>
    );
  }
  return (
    <svg className="poster-deco" viewBox="0 0 480 210">
      <rect x="340" y="24" width="110" height="110" rx="18" fill="none" stroke="rgba(161,98,7,0.25)" strokeWidth="6" />
      <rect x="368" y="52" width="110" height="110" rx="18" fill="rgba(253,224,71,0.75)" />
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
        <Decor theme={theme} />
        <span className="poster-initials">{initials}</span>
        <h3 className="poster-name">{profile.name || "Your store"}</h3>
        {profile.nameAr ? (
          <p className="poster-ar" dir="rtl">
            {profile.nameAr}
          </p>
        ) : null}
        {profile.tagline ? <p className="poster-tag">{profile.tagline}</p> : null}
      </div>

      <div className="poster-dock">
        <div className="poster-dock-text">
          {phone ? (
            <p className="poster-phone">
              <Phone size={15} strokeWidth={2.6} />
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
        </div>
      </div>
    </article>
  );
}

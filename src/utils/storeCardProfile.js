export const STORE_CARD_SETTING_KEYS = {
  NAME: "store_card_name",
  NAME_AR: "store_card_name_ar",
  TAGLINE: "store_card_tagline",
  PHONE: "store_card_phone",
  WHATSAPP: "store_card_whatsapp",
  ADDRESS: "store_card_address",
  HOURS: "store_card_hours",
  WEBSITE: "store_card_website",
  EMAIL: "store_card_email",
  THEME: "store_card_theme",
};

export const STORE_CARD_THEMES = [
  { id: "emerald", name: "Gold Souk", caption: "Luxury green & gold — easy to remember" },
  { id: "midnight", name: "Night Majlis", caption: "Black card with gold chip" },
  { id: "oasis", name: "Oasis Neon", caption: "Big phone number, instant scan" },
  { id: "dune", name: "Najd Sunset", caption: "Warm Arabic-first look" },
  { id: "royal", name: "Royal Diwan", caption: "Centered poster, bold name" },
  { id: "pearl", name: "White Marble", caption: "Clean, modern, high contrast" },
];

const EMPTY_PROFILE = {
  name: "",
  nameAr: "",
  tagline: "",
  phone: "",
  whatsapp: "",
  address: "",
  hours: "",
  website: "",
  email: "",
  theme: "emerald",
};

export function readStoreCardProfile(settings = {}) {
  const pick = (cardKey, fallbackKey, fallback = "") => {
    const cardVal = String(settings[cardKey] || "").trim();
    if (cardVal) return cardVal;
    const storeVal = String(settings[fallbackKey] || "").trim();
    return storeVal || fallback;
  };

  return {
    name: pick(STORE_CARD_SETTING_KEYS.NAME, "store_name", "Dukkan POS"),
    nameAr: pick(STORE_CARD_SETTING_KEYS.NAME_AR, "store_name_ar"),
    tagline: String(settings[STORE_CARD_SETTING_KEYS.TAGLINE] || "").trim() || "Your neighborhood store",
    phone: pick(STORE_CARD_SETTING_KEYS.PHONE, "store_phone"),
    whatsapp: String(settings[STORE_CARD_SETTING_KEYS.WHATSAPP] || "").trim()
      || pick(STORE_CARD_SETTING_KEYS.PHONE, "store_phone"),
    address: pick(STORE_CARD_SETTING_KEYS.ADDRESS, "store_address"),
    hours: String(settings[STORE_CARD_SETTING_KEYS.HOURS] || "").trim() || "Sat–Thu · 8:00 AM – 11:00 PM",
    website: String(settings[STORE_CARD_SETTING_KEYS.WEBSITE] || "").trim(),
    email: String(settings[STORE_CARD_SETTING_KEYS.EMAIL] || "").trim(),
    theme: String(settings[STORE_CARD_SETTING_KEYS.THEME] || "emerald").trim() || "emerald",
  };
}

export function storeCardToSettingsPayload(profile) {
  return {
    [STORE_CARD_SETTING_KEYS.NAME]: profile.name || "",
    [STORE_CARD_SETTING_KEYS.NAME_AR]: profile.nameAr || "",
    [STORE_CARD_SETTING_KEYS.TAGLINE]: profile.tagline || "",
    [STORE_CARD_SETTING_KEYS.PHONE]: profile.phone || "",
    [STORE_CARD_SETTING_KEYS.WHATSAPP]: profile.whatsapp || "",
    [STORE_CARD_SETTING_KEYS.ADDRESS]: profile.address || "",
    [STORE_CARD_SETTING_KEYS.HOURS]: profile.hours || "",
    [STORE_CARD_SETTING_KEYS.WEBSITE]: profile.website || "",
    [STORE_CARD_SETTING_KEYS.EMAIL]: profile.email || "",
    [STORE_CARD_SETTING_KEYS.THEME]: profile.theme || "emerald",
  };
}

export function emptyStoreCardProfile() {
  return { ...EMPTY_PROFILE };
}

export function storeCardInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "DK";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function withHttps(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function buildStoreCardShareText(profile) {
  const lines = [profile.name || "Store"];
  if (profile.nameAr) lines.push(profile.nameAr);
  if (profile.tagline) lines.push(profile.tagline);
  lines.push("");
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.whatsapp) lines.push(`WhatsApp: ${profile.whatsapp}`);
  if (profile.address) lines.push(`Address: ${profile.address}`);
  if (profile.hours) lines.push(`Hours: ${profile.hours}`);
  if (profile.website) lines.push(withHttps(profile.website) || profile.website);
  if (profile.email) lines.push(profile.email);
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

export function buildStoreCardVCard(profile) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.name || "Store"}`,
    `ORG:${profile.name || "Store"}`,
  ];
  if (profile.phone) lines.push(`TEL;TYPE=WORK,VOICE:${profile.phone}`);
  if (profile.whatsapp) lines.push(`TEL;TYPE=CELL:${profile.whatsapp}`);
  if (profile.email) lines.push(`EMAIL:${profile.email}`);
  if (profile.website) lines.push(`URL:${withHttps(profile.website)}`);
  if (profile.address) lines.push(`ADR;TYPE=WORK:;;${profile.address};;;;`);
  if (profile.tagline) lines.push(`NOTE:${profile.tagline}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function storeCardQrPayload(profile) {
  const digits = digitsOnly(profile.whatsapp || profile.phone);
  if (digits) return `https://wa.me/${digits}`;
  if (profile.website) return withHttps(profile.website);
  if (profile.email) return `mailto:${profile.email}`;
  return buildStoreCardVCard(profile);
}

export function storeCardWhatsAppUrl(profile) {
  const digits = digitsOnly(profile.whatsapp || profile.phone);
  const text = buildStoreCardShareText(profile);
  if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function storeCardFileSlug(profile, themeId) {
  const name = String(profile.name || "store")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `store-card-${themeId || profile.theme || "card"}-${name || "store"}.png`;
}

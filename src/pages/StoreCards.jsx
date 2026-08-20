import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { Copy, Download, Save, Share2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input, Textarea } from "../components/common/Input";
import StoreCardFace from "../components/storeCards/StoreCardFace";
import { settingsService } from "../services/SettingsService";
import { useSettingsStore } from "../contexts/store";
import { notify } from "../utils/notify";
import { downloadBlob } from "../utils/productImport/download";
import {
  STORE_CARD_THEMES,
  buildStoreCardShareText,
  readStoreCardProfile,
  storeCardFileSlug,
  storeCardQrPayload,
  storeCardToSettingsPayload,
  storeCardWhatsAppUrl,
} from "../utils/storeCardProfile";
import { PHONE_PLACEHOLDER } from "../utils/constants";
import "./StoreCards.css";

export default function StoreCards() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [form, setForm] = useState(() => readStoreCardProfile(settings));
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState("");
  const [pendingExport, setPendingExport] = useState("");
  const dirtyRef = useRef(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (dirtyRef.current) return;
    setForm(readStoreCardProfile(settings));
  }, [settings]);

  const profile = useMemo(() => form, [form]);
  const selectedTheme =
    STORE_CARD_THEMES.find((theme) => theme.id === profile.theme) || STORE_CARD_THEMES[0];
  const exportTheme =
    STORE_CARD_THEMES.find((theme) => theme.id === pendingExport)?.id || selectedTheme.id;

  useEffect(() => {
    let cancelled = false;
    const payload = storeCardQrPayload(profile);
    QRCode.toDataURL(payload, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!pendingExport) return;
    let cancelled = false;

    async function exportCard() {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled || !exportRef.current) {
        setExporting("");
        setPendingExport("");
        return;
      }
      try {
        const canvas = await html2canvas(exportRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Could not create image."));
              return;
            }
            downloadBlob(blob, storeCardFileSlug(profile, pendingExport));
            resolve();
          }, "image/png");
        });
        notify.success("PNG downloaded — send it to anyone.", { title: "Card ready" });
      } catch (err) {
        notify.error(err.message || "Could not export the card.", { title: "Download failed" });
      } finally {
        if (!cancelled) {
          setExporting("");
          setPendingExport("");
        }
      }
    }

    exportCard();
    return () => {
      cancelled = true;
    };
  }, [pendingExport, profile]);

  function updateField(key, value) {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!String(form.name || "").trim()) {
      notify.error("Store name is required.", { title: "Missing name" });
      return;
    }
    setSaving(true);
    try {
      const updated = await settingsService.updateMany(storeCardToSettingsPayload(form));
      setSettings(updated);
      dirtyRef.current = false;
      notify.success("Store card profile saved. Share any design below.", { title: "Saved" });
    } catch (err) {
      notify.error(err.message || "Could not save store card.", { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  function handleDownload(themeId) {
    if (exporting) return;
    setExporting(themeId);
    setPendingExport(themeId);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildStoreCardShareText(profile));
      notify.success("Store details copied.", { title: "Copied" });
    } catch {
      notify.error("Could not copy to clipboard.", { title: "Copy failed" });
    }
  }

  async function handleWhatsApp() {
    const url = storeCardWhatsAppUrl(profile);
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="store-cards-page">
      <PageHeader
        title="Store Cards"
        subtitle="Create a stunning shareable card for your store — pick a design, then download or send it."
        actions={
          <Button type="submit" form="store-card-form" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save profile"}
          </Button>
        }
      />

      <div className="store-cards-layout">
        <Card className="store-cards-form-card">
          <form id="store-card-form" className="store-cards-form" onSubmit={handleSave}>
            <div className="store-cards-form-intro">
              <strong>Store details</strong>
              <p>These details fill every card design live. Save once, share any look.</p>
            </div>
            <Input
              label="Store name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Your store name"
              required
            />
            <Input
              label="Store name (Arabic)"
              value={form.nameAr}
              onChange={(e) => updateField("nameAr", e.target.value)}
              placeholder="اسم المتجر"
              dir="rtl"
            />
            <Input
              label="Tagline"
              value={form.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="Fresh groceries · Open late"
            />
            <div className="store-cards-form-row">
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder={PHONE_PLACEHOLDER}
              />
              <Input
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(e) => updateField("whatsapp", e.target.value)}
                placeholder={PHONE_PLACEHOLDER}
              />
            </div>
            <Textarea
              label="Address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Street, district, city"
            />
            <Input
              label="Opening hours"
              value={form.hours}
              onChange={(e) => updateField("hours", e.target.value)}
              placeholder="Sat–Thu · 8:00 AM – 11:00 PM"
            />
            <div className="store-cards-form-row">
              <Input
                label="Website"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="www.yourstore.com"
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="hello@yourstore.com"
              />
            </div>
          </form>
        </Card>

        <div className="store-cards-stage">
          <Card className="store-cards-featured">
            <div className="store-cards-featured-head">
              <div>
                <p className="store-cards-kicker">Selected design</p>
                <h2>{selectedTheme.name}</h2>
                <p>{selectedTheme.caption}</p>
              </div>
              <div className="store-cards-share-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                >
                  <Copy size={15} />
                  Copy
                </Button>
                <Button variant="secondary" size="sm" onClick={handleWhatsApp}>
                  <Share2 size={15} />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  disabled={Boolean(exporting)}
                  onClick={() => handleDownload(profile.theme)}
                >
                  <Download size={15} />
                  {exporting ? "Exporting…" : "Download PNG"}
                </Button>
              </div>
            </div>

            <div className="store-cards-featured-preview">
              <div className="store-cards-capture">
                <StoreCardFace
                  profile={profile}
                  theme={selectedTheme.id}
                  qrDataUrl={qrDataUrl}
                  size="lg"
                />
              </div>
            </div>
          </Card>

          <div className="store-cards-grid">
            {STORE_CARD_THEMES.map((theme) => {
              const selected = theme.id === profile.theme;
              const busy = exporting === theme.id;
              return (
                <div
                  key={theme.id}
                  className={`store-cards-option ${selected ? "selected" : ""}`}
                >
                  <button
                    type="button"
                    className="store-cards-option-preview"
                    onClick={() => updateField("theme", theme.id)}
                  >
                    <StoreCardFace
                      profile={profile}
                      theme={theme.id}
                      qrDataUrl={qrDataUrl}
                      size="sm"
                    />
                  </button>
                  <span className="store-cards-option-meta">
                    <strong>{theme.name}</strong>
                    <small>{theme.caption}</small>
                    <button
                      type="button"
                      className="store-cards-option-download"
                      disabled={Boolean(exporting)}
                      onClick={() => handleDownload(theme.id)}
                    >
                      <Download size={13} />
                      {busy ? "Exporting…" : "Download"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="store-cards-export-host" aria-hidden="true">
        <div ref={exportRef}>
          <StoreCardFace
            profile={profile}
            theme={exportTheme}
            qrDataUrl={qrDataUrl}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

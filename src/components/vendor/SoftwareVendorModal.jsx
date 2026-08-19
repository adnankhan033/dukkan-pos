import {
  Building2,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import Button from "../common/Button";
import "./SoftwareVendorModal.css";

function ContactRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  const content = (
    <>
      <span className="vendor-modal-contact-icon">
        <Icon size={16} />
      </span>
      <span className="vendor-modal-contact-body">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </>
  );

  if (href) {
    return (
      <a className="vendor-modal-contact" href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <div className="vendor-modal-contact">{content}</div>;
}

export default function SoftwareVendorModal({ vendor, isOpen, onClose }) {
  if (!isOpen || !vendor) return null;

  const websiteUrl = vendor.website
    ? vendor.website.startsWith("http")
      ? vendor.website
      : `https://${vendor.website}`
    : null;

  const whatsappDigits = vendor.whatsapp.replace(/\D/g, "");
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  return (
    <div className="vendor-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="vendor-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-modal-title"
      >
        <div className="vendor-modal-bg" aria-hidden="true">
          <span className="vendor-modal-orb vendor-modal-orb-1" />
          <span className="vendor-modal-orb vendor-modal-orb-2" />
          <span className="vendor-modal-spark vendor-modal-spark-1" />
          <span className="vendor-modal-spark vendor-modal-spark-2" />
        </div>

        <button type="button" className="vendor-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="vendor-modal-badge">
          <Sparkles size={14} />
          <span>Built by</span>
        </div>

        <div className="vendor-modal-brand">
          <div className="vendor-modal-logo">{vendor.initials}</div>
          <div className="vendor-modal-brand-text">
            <h2 id="vendor-modal-title">{vendor.companyName || vendor.menuLabel}</h2>
            {vendor.companyNameAr ? (
              <p className="vendor-modal-name-ar" dir="rtl">
                {vendor.companyNameAr}
              </p>
            ) : null}
            {vendor.tagline ? <p className="vendor-modal-tagline">{vendor.tagline}</p> : null}
            {vendor.taglineAr ? (
              <p className="vendor-modal-tagline-ar" dir="rtl">
                {vendor.taglineAr}
              </p>
            ) : null}
          </div>
        </div>

        <p className="vendor-modal-intro">
          {vendor.isConfigured
            ? "This point-of-sale system was designed and developed by our team for reliable daily store operations."
            : "Add your software company details in Settings → Vendor to show your branding here."}
        </p>

        {vendor.supportMessage ? (
          <div className="vendor-modal-support">{vendor.supportMessage}</div>
        ) : null}

        {(vendor.hasContact || vendor.address) && (
          <div className="vendor-modal-contacts">
            <ContactRow icon={Globe} label="Website" value={vendor.website} href={websiteUrl} />
            <ContactRow icon={Mail} label="Email" value={vendor.email} href={vendor.email ? `mailto:${vendor.email}` : null} />
            <ContactRow icon={Phone} label="Phone" value={vendor.phone} href={vendor.phone ? `tel:${vendor.phone}` : null} />
            <ContactRow icon={MessageCircle} label="WhatsApp" value={vendor.whatsapp} href={whatsappUrl} />
            {vendor.address ? (
              <div className="vendor-modal-contact">
                <span className="vendor-modal-contact-icon">
                  <MapPin size={16} />
                </span>
                <span className="vendor-modal-contact-body">
                  <small>Address</small>
                  <strong>{vendor.address}</strong>
                </span>
              </div>
            ) : null}
          </div>
        )}

        <div className="vendor-modal-footer">
          <div className="vendor-modal-product">
            <Building2 size={14} />
            <span>Nexttel POS · Desktop POS for retail</span>
          </div>
          {vendor.copyright ? <span className="vendor-modal-copy">{vendor.copyright}</span> : null}
        </div>

        <Button className="vendor-modal-cta" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

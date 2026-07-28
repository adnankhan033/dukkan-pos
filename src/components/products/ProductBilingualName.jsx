import "./ProductBilingualName.css";

/** English + Arabic product label for POS lists, cart, and receipts. */
export default function ProductBilingualName({
  name,
  nameAr,
  size = "md",
  align = "start",
  className = "",
}) {
  return (
    <div className={`product-bilingual-name product-bilingual-${size} align-${align} ${className}`.trim()}>
      <div className="product-bilingual-en">{name}</div>
      {nameAr ? (
        <div className="product-bilingual-ar" dir="rtl" lang="ar">
          {nameAr}
        </div>
      ) : null}
    </div>
  );
}

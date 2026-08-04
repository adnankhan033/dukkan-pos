import { productService } from "./ProductService";
import { compressImageUrl } from "../utils/image";

const LOOKUP_SOURCES = [
  {
    id: "openfoodfacts",
    label: "Open Food Facts",
    buildUrl: (barcode) =>
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_en,product_name_ar,brands,categories,quantity,image_front_url,image_url`,
  },
  {
    id: "openproductsfacts",
    label: "Open Products Facts",
    buildUrl: (barcode) =>
      `https://world.openproductsfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_en,product_name_ar,brands,categories,quantity,image_front_url,image_url`,
  },
];

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeBarcode(value) {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

export function isValidBarcodeLength(barcode) {
  return VALID_LENGTHS.has(barcode.length);
}

function buildProductName(product) {
  const name =
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    product.generic_name_en?.trim() ||
    product.generic_name?.trim() ||
    "";
  const brand = product.brands?.split(",")[0]?.trim();
  if (!name) return brand || "";
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`;
  }
  return name;
}

function parseExternalProduct(data, sourceLabel) {
  const product = data?.product;
  if (!product || data?.status !== 1) return null;

  const name = buildProductName(product);
  if (!name) return null;

  const nameAr =
    product.product_name_ar?.trim() ||
    product.generic_name_ar?.trim() ||
    "";

  return {
    source: sourceLabel,
    barcode: normalizeBarcode(data.code || product.code),
    name,
    name_ar: nameAr,
    brand: product.brands?.split(",")[0]?.trim() || null,
    categoryHint: product.categories?.split(",")[0]?.trim() || null,
    quantityHint: product.quantity?.trim() || null,
    imageUrl: product.image_front_url || product.image_url || null,
    sku: normalizeBarcode(data.code || product.code) || null,
  };
}

async function fetchExternalSource(source, barcode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.buildUrl(barcode), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return parseExternalProduct(data, source.label);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function matchCategoryId(categoryHint, categories = []) {
  if (!categoryHint || !categories.length) return null;
  const hint = categoryHint.toLowerCase();
  const exact = categories.find((c) => hint.includes(c.name.toLowerCase()));
  if (exact) return exact.id;
  const partial = categories.find((c) => c.name.toLowerCase().includes(hint.split(" ")[0]));
  return partial?.id ?? null;
}

export function matchUnitId(quantityHint, units = []) {
  if (!quantityHint || !units.length) return null;
  const match = quantityHint.match(/(\d+\.?\d*)\s*([a-zA-Z\u0600-\u06FF]+)/);
  if (!match) return null;
  const symbol = match[2].toLowerCase();
  const bySymbol = units.find((u) => u.symbol?.toLowerCase() === symbol);
  if (bySymbol) return bySymbol.id;
  const byName = units.find(
    (u) =>
      u.name?.toLowerCase().includes(symbol) ||
      u.symbol?.toLowerCase().includes(symbol)
  );
  return byName?.id ?? null;
}

async function mapToFormPatch(result, { categories = [], units = [] } = {}) {
  const patch = {
    barcode: result.barcode,
    name: result.name || "",
    name_ar: result.name_ar || "",
    sku: result.sku || result.barcode || "",
    category_id: matchCategoryId(result.categoryHint, categories) || "",
    unit_id: matchUnitId(result.quantityHint, units) || "",
  };

  if (result.imageUrl) {
    try {
      patch.image = await compressImageUrl(result.imageUrl);
    } catch {
      patch.imagePreviewUrl = result.imageUrl;
    }
  }

  return patch;
}

class BarcodeLookupService {
  async lookup(barcodeInput, options = {}) {
    const barcode = normalizeBarcode(barcodeInput);
    if (!barcode) {
      return { status: "invalid", message: "Enter a valid barcode number." };
    }
    if (!isValidBarcodeLength(barcode)) {
      return {
        status: "invalid",
        message: "Barcode should be 8, 12, 13, or 14 digits.",
        barcode,
      };
    }

    const local = await productService.findByBarcode(barcode);
    if (local) {
      return {
        status: "duplicate",
        message: `"${local.name}" already exists with this barcode.`,
        barcode,
        localProduct: local,
      };
    }

    for (const source of LOOKUP_SOURCES) {
      const external = await fetchExternalSource(source, barcode);
      if (!external) continue;

      const formPatch = await mapToFormPatch(external, options);
      return {
        status: "found",
        message: `Product found via ${external.source}.`,
        barcode,
        source: external.source,
        preview: {
          name: external.name,
          name_ar: external.name_ar,
          brand: external.brand,
          categoryHint: external.categoryHint,
          quantityHint: external.quantityHint,
          imageUrl: external.imageUrl,
        },
        formPatch,
      };
    }

    return {
      status: "not_found",
      message: "Barcode not found online. Enter product details manually.",
      barcode,
      formPatch: { barcode, sku: barcode },
    };
  }
}

export const barcodeLookupService = new BarcodeLookupService();

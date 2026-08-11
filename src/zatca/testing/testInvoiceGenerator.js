import { generateNumber } from "../../utils/format";
import { buildSimplifiedInvoicePayload } from "../phase2/invoiceBuilder";
import { generateQrDataUrl } from "../phase1/qrGenerator";
import { signZatcaInvoice, resolveEgsUuid } from "../phase2/invoiceSigner";
import {
  assertInvoiceVatMatchesCertificate,
  resolveInvoiceVatNumber,
} from "../core/vatResolver";
import {
  ZATCA_INVOICE_KINDS,
  ZATCA_SANDBOX_BUYER_VAT,
} from "../core/constants";

function buildTestSale() {
  const now = new Date().toISOString();
  const saleNumber = generateNumber("TEST");

  const sale = {
    id: null,
    sale_number: saleNumber,
    customer_name: "Test Customer",
    subtotal: 100,
    discount: 0,
    vat: 15,
    total: 115,
    created_at: now,
    status: "completed",
  };

  const items = [
    {
      product_name: "Test Product A",
      name: "Test Product A",
      quantity: 2,
      unit_price: 25,
      discount: 0,
      total: 50,
    },
    {
      product_name: "Test Product B",
      name: "Test Product B",
      quantity: 1,
      unit_price: 50,
      discount: 0,
      total: 50,
    },
  ];

  return { sale, items, saleNumber };
}

/**
 * Build and cryptographically sign a ZATCA compliance test invoice.
 * Uses zatca-xml-js — same pipeline as live sale sync.
 */
export async function generateTestInvoice(
  config,
  { production = false, invoiceKind = ZATCA_INVOICE_KINDS.SIMPLIFIED } = {}
) {
  const { sale, items } = buildTestSale();
  const payload = buildSimplifiedInvoicePayload({ sale, items, config, production });

  if (invoiceKind === ZATCA_INVOICE_KINDS.STANDARD) {
    payload.buyer = {
      name: "Test Buyer Company",
      vatNumber: ZATCA_SANDBOX_BUYER_VAT,
      crNumber: "1010010001",
    };
    payload.customer_name = payload.buyer.name;
    sale.customer_name = payload.buyer.name;
  }

  const signed = await signZatcaInvoice(config, payload, { production, invoiceKind });
  assertInvoiceVatMatchesCertificate(config, signed.signedXml, { production });
  const egsUuid = signed.egsUuid || resolveEgsUuid(config);

  let qrDataUrl = null;
  try {
    qrDataUrl = await generateQrDataUrl({
      sellerName: config.company?.name || "Test Store",
      vatNumber: resolveInvoiceVatNumber(config, { production }),
      sale,
    });
  } catch {
    qrDataUrl = null;
  }

  return {
    sale,
    items,
    uuid: egsUuid,
    invoiceHash: signed.invoiceHash,
    invoiceBase64: signed.invoiceBase64,
    payload,
    xml: signed.signedXml,
    signedXml: signed.signedXml,
    qr: signed.qr,
    qrDataUrl,
    signed: true,
  };
}

/** Phase 2 digital signature readiness check. */
export function checkDigitalSignatureReadiness(settings) {
  const hasCert = Boolean(settings.credentials?.certificate || settings.credentials?.complianceCsid);
  const hasKey = Boolean(settings.credentials?.privateKey);
  const hasSecret = Boolean(settings.credentials?.secret);

  return {
    passed: hasCert && hasKey && hasSecret,
    message:
      hasCert && hasKey && hasSecret
        ? "Certificate, private key, and secret are ready for signing."
        : "Missing certificate, private key, or secret — complete Compliance CSID first.",
    fix: !hasCert || !hasKey || !hasSecret ? "Complete Steps 3–4 in Settings → ZATCA." : null,
  };
}

/** @deprecated Preview-only stub — compliance API uses signed XML from generateTestInvoice. */
export function buildTestInvoiceXml() {
  return "";
}

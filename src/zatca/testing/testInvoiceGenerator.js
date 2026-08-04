import { generateNumber } from "../../utils/format";
import {
  buildSimplifiedInvoicePayload,
  computePlaceholderInvoiceHash,
} from "../phase2/invoiceBuilder";
import { generateQrDataUrl } from "../phase1/qrGenerator";

/** Build a complete dummy test invoice — no manual input needed. */
export async function generateTestInvoice(settings) {
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

  const payload = buildSimplifiedInvoicePayload({ sale, items, config: settings });
  const invoiceHash = computePlaceholderInvoiceHash(payload);
  const xml = buildTestInvoiceXml(payload);

  let qrDataUrl = null;
  try {
    qrDataUrl = await generateQrDataUrl({
      sellerName: settings.company?.name || settings.company?.name || "Test Store",
      vatNumber: settings.company?.vatNumber,
      sale,
    });
  } catch {
    qrDataUrl = null;
  }

  return {
    sale,
    items,
    uuid: payload.uuid,
    invoiceHash,
    payload,
    xml,
    qrDataUrl,
  };
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Simplified UBL-style XML for testing (not yet cryptographically signed). */
export function buildTestInvoiceXml(payload) {
  const lines = (payload.lineItems || [])
    .map(
      (item) => `
    <cac:InvoiceLine>
      <cbc:ID>${item.id}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${item.total.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${escapeXml(item.name)}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UUID>${escapeXml(payload.uuid)}</cbc:UUID>
  <cbc:ID>${escapeXml(payload.saleNumber)}</cbc:ID>
  <cbc:IssueDate>${payload.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${payload.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${payload.invoiceTypeName}">${payload.invoiceType}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(payload.seller?.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(payload.seller?.vatNumber)}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(payload.buyer?.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${lines}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${Number(payload.totals?.vat || 0).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">${Number(payload.totals?.subtotal || 0).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${Number(payload.totals?.total || 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${Number(payload.totals?.total || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

/** Phase 2 digital signature placeholder check. */
export function checkDigitalSignatureReadiness(settings) {
  const hasCert = Boolean(settings.credentials?.certificate || settings.credentials?.complianceCsid);
  const hasKey = Boolean(settings.credentials?.privateKey);
  const hasSecret = Boolean(settings.credentials?.secret);

  return {
    passed: hasCert && hasKey && hasSecret,
    message:
      hasCert && hasKey && hasSecret
        ? "Certificate, private key, and secret are ready for signing (full ECDSA signing coming soon)."
        : "Missing certificate, private key, or secret — complete ZATCA onboarding first.",
    fix: !hasCert || !hasKey || !hasSecret ? "Complete Steps 4–5 in Settings → ZATCA." : null,
  };
}

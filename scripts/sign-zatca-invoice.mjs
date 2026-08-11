/**
 * Signs a ZATCA tax invoice using zatca-xml-js (requires Node.js + OpenSSL).
 * Supports simplified (B2C / reporting) and standard (B2B / clearance) transforms.
 * Called from Tauri — not from the webview bundle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { EGS, ZATCASimplifiedTaxInvoice } from "zatca-xml-js";

const STANDARD_TYPE_NAME = "0100000";
const DEFAULT_SANDBOX_BUYER_VAT = "301121971500003";
const SAUDI_VAT_RE = /^3\d{13}3$/;

function normalizeBuyerVat(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return SAUDI_VAT_RE.test(digits) ? digits : DEFAULT_SANDBOX_BUYER_VAT;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node sign-zatca-invoice.mjs <input.json>");
  process.exit(1);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectSimplifiedBuyerParty(xml, buyerName) {
  const name = escapeXml(buyerName || "Walk-in Customer");
  const block = `<cac:AccountingCustomerParty>
  <cac:Party>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${name}</cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:Party>
</cac:AccountingCustomerParty>`;
  return xml.replace(
    "<cac:AccountingCustomerParty></cac:AccountingCustomerParty>",
    block
  );
}

function injectStandardBuyerParty(xml, buyer = {}) {
  const name = escapeXml(buyer.name || "Test Buyer Company");
  const vat = escapeXml(normalizeBuyerVat(buyer.vatNumber));
  const crn = escapeXml(buyer.crNumber || "1010010001");
  const block = `<cac:AccountingCustomerParty>
  <cac:Party>
    <cac:PartyIdentification>
      <cbc:ID schemeID="CRN">${crn}</cbc:ID>
    </cac:PartyIdentification>
    <cac:PostalAddress>
      <cbc:StreetName>Buyer Street</cbc:StreetName>
      <cbc:BuildingNumber>0000</cbc:BuildingNumber>
      <cbc:PlotIdentification>0000</cbc:PlotIdentification>
      <cbc:CitySubdivisionName>District</cbc:CitySubdivisionName>
      <cbc:CityName>Riyadh</cbc:CityName>
      <cbc:PostalZone>12345</cbc:PostalZone>
      <cac:Country>
        <cbc:IdentificationCode>SA</cbc:IdentificationCode>
      </cac:Country>
    </cac:PostalAddress>
    <cac:PartyTaxScheme>
      <cbc:CompanyID>${vat}</cbc:CompanyID>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:PartyTaxScheme>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${name}</cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:Party>
</cac:AccountingCustomerParty>`;
  return xml.replace(
    "<cac:AccountingCustomerParty></cac:AccountingCustomerParty>",
    block
  );
}

/** Standard tax invoices require supply date KSA-5 (BR-KSA-15). */
function injectSupplyDate(xml, issueDate) {
  const fromXml = xml.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/)?.[1];
  const date = escapeXml(issueDate || fromXml || new Date().toISOString().slice(0, 10));
  const block = `<cac:Delivery>
  <cbc:ActualDeliveryDate>${date}</cbc:ActualDeliveryDate>
</cac:Delivery>`;
  if (xml.includes("<cac:Delivery>")) {
    return xml;
  }
  // UBL 2.1: Delivery must come after AccountingCustomerParty and before TaxTotal.
  if (xml.includes("<cac:TaxTotal>")) {
    return xml.replace("<cac:TaxTotal>", `${block}\n  <cac:TaxTotal>`);
  }
  return xml.replace(
    "</cac:AccountingCustomerParty>",
    `</cac:AccountingCustomerParty>\n  ${block}`
  );
}

/** Convert zatca-xml-js simplified draft → standard tax invoice (B2B / clearance). */
function applyStandardInvoiceTransform(xmlStr, buyer = {}, issueDate) {
  let xml = xmlStr.replace(
    /<cbc:InvoiceTypeCode name="[^"]*">/,
    `<cbc:InvoiceTypeCode name="${STANDARD_TYPE_NAME}">`
  );
  xml = injectStandardBuyerParty(xml, buyer);
  return injectSupplyDate(xml, issueDate);
}

const input = JSON.parse(readFileSync(inputPath, "utf8"));
const outputPath = input.output_path;
if (!outputPath) {
  console.error("Missing output_path in input JSON");
  process.exit(1);
}

try {
  if (!input.egs_info?.private_key?.trim()) {
    throw new Error("Private key missing in signing input.");
  }
  if (!input.egs_info?.compliance_certificate && !input.egs_info?.production_certificate) {
    throw new Error("Compliance or production certificate missing in signing input.");
  }
  if (!input.invoice_props?.egs_info?.location?.street) {
    throw new Error("Invoice location.street missing — check company address in Settings.");
  }

  const invoiceKind = String(input.invoice_kind || "simplified").toLowerCase();
  const buyer =
    input.buyer ||
    input.invoice_props?.buyer ||
    {};
  const buyerName =
    input.buyer_name ||
    buyer.name ||
    input.invoice_props?.buyer_name ||
    (invoiceKind === "standard" ? "Test Buyer Company" : "Walk-in Customer");

  const egs = new EGS(input.egs_info);
  const invoiceProps = {
    ...input.invoice_props,
    egs_info: input.egs_info,
  };
  const draft = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });
  let xmlStr = draft.getXML().toString({ no_header: false });

  if (invoiceKind === "standard") {
    xmlStr = applyStandardInvoiceTransform(xmlStr, { ...buyer, name: buyerName }, input.invoice_props?.issue_date);
  } else {
    xmlStr = injectSimplifiedBuyerParty(xmlStr, buyerName);
  }

  const invoice = new ZATCASimplifiedTaxInvoice({ invoice_xml_str: xmlStr });
  const result = egs.signInvoice(invoice, Boolean(input.production));

  writeFileSync(
    outputPath,
    JSON.stringify({
      signedXml: result.signed_invoice_string,
      invoiceHash: result.invoice_hash,
      qr: result.qr,
      invoiceBase64: Buffer.from(result.signed_invoice_string, "utf8").toString("base64"),
    })
  );
} catch (err) {
  const message = err?.message || String(err);
  console.error(message);
  process.exit(1);
}

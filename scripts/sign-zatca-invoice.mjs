/**
 * Signs a ZATCA simplified tax invoice using zatca-xml-js (requires Node.js + OpenSSL).
 * Called from Tauri — not from the webview bundle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { EGS, ZATCASimplifiedTaxInvoice } from "zatca-xml-js";

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

function injectBuyerParty(xml, buyerName) {
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

  const buyerName =
    input.buyer_name ||
    input.invoice_props?.buyer_name ||
    input.invoice_props?.buyer?.name ||
    "Walk-in Customer";

  const egs = new EGS(input.egs_info);
  const draft = new ZATCASimplifiedTaxInvoice({ props: input.invoice_props });
  let xmlStr = draft.getXML().toString({ no_header: false });
  xmlStr = injectBuyerParty(xmlStr, buyerName);
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

/**
 * Keeps local fixes to zatca-xml-js (QR KSA-25 timestamp). Run after npm/bun install.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const qrFile = join(root, "node_modules/zatca-xml-js/lib/zatca/qr/index.js");

let src = readFileSync(qrFile, "utf8");

const broken = `const datetime = \`\${issue_date} \${issue_time}\`;
    const formatted_datetime = (0, moment_1.default)(datetime).format("YYYY-MM-DDTHH:mm:ss") + "Z";`;

const fixed = `const formatted_datetime = \`\${issue_date}T\${issue_time}\`;`;

if (src.includes(broken)) {
  src = src.replaceAll(broken, fixed);
  writeFileSync(qrFile, src);
  console.log("patched zatca-xml-js QR timestamp (KSA-25)");
} else if (src.includes(fixed)) {
  console.log("zatca-xml-js QR patch already applied");
} else {
  console.warn("zatca-xml-js QR patch skipped — file format changed");
}

/**
 * Keeps local fixes to zatca-xml-js (QR KSA-25 timestamp must match IssueDate + IssueTime).
 * XML IssueTime is KSA local without "Z", so QR tag 3 must be YYYY-MM-DDTHH:mm:ss (no Z).
 * Run after npm/bun install via postinstall.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const qrFile = join(root, "node_modules/zatca-xml-js/lib/zatca/qr/index.js");

let src = readFileSync(qrFile, "utf8");
const original = src;

const fixedBlock =
  'const formatted_datetime = `${String(issue_date).slice(0, 10)}T${String(issue_time).replace(/Z$/i, "").trim()}`;';

const replacePatterns = [
  /const datetime = `\$\{issue_date\} \$\{issue_time\}`;\s*const formatted_datetime = \(0, moment_1\.default\)\(datetime\)\.format\("YYYY-MM-DDTHH:mm:ss"\) \+ "Z";/g,
  /const formatted_datetime = `\$\{issue_date\}T\$\{issue_time\}Z`;/g,
  /const formatted_datetime = `\$\{issue_date\}T\$\{issue_time\}`;/g,
  /const formatted_datetime = `\$\{String\(issue_date\)\.slice\(0, 10\)\}T\$\{String\(issue_time\)\.replace\(\/Z\$\/i, ""\)\.trim\(\)\}`;/g,
];

for (const pattern of replacePatterns) {
  src = src.replace(pattern, fixedBlock);
}

if (src.includes('require("moment")') && !src.includes("moment_1.default")) {
  src = src.replace(/const moment_1 = __importDefault\(require\("moment"\)\);\n/, "");
}

if (src !== original) {
  writeFileSync(qrFile, src);
  console.log("patched zatca-xml-js QR timestamp (KSA-25, local time without Z)");
} else if (src.includes("replace(/Z$/i")) {
  console.log("zatca-xml-js QR patch already applied");
} else {
  console.warn("zatca-xml-js QR patch skipped — file format changed; inspect lib/zatca/qr/index.js");
}

/**
 * Bundle a portable Node runtime + zatca-xml-js for ZATCA invoice signing inside the desktop app.
 * Output: src-tauri/resources/zatca-signer/
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "src-tauri/resources/zatca-signer");
const stagingDir = join(root, ".zatca-signer-staging");
const NODE_VERSION = "20.18.3";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--win")) return { platform: "win32", arch: "x64" };
  if (args.has("--mac-x64")) return { platform: "darwin", arch: "x64" };
  if (args.has("--mac-arm64")) return { platform: "darwin", arch: "arm64" };
  return { platform: process.platform, arch: process.arch };
}

function nodeArchiveName(platform, arch) {
  if (platform === "darwin" && arch === "arm64") return `node-v${NODE_VERSION}-darwin-arm64`;
  if (platform === "darwin" && arch === "x64") return `node-v${NODE_VERSION}-darwin-x64`;
  if (platform === "win32" && arch === "x64") return `node-v${NODE_VERSION}-win-x64`;
  throw new Error(`Unsupported signer target: ${platform}/${arch}`);
}

function extractZip(archiveFile, extractDir) {
  if (process.platform === "win32") {
    runOrThrow("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${archiveFile.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
    ]);
    return;
  }

  runOrThrow("unzip", ["-q", archiveFile, "-d", extractDir]);
}

function resolveWindowsNodePath(extractDir, archiveName) {
  const direct = join(extractDir, "node.exe");
  if (existsSync(direct)) return direct;
  const nested = join(extractDir, archiveName, "node.exe");
  if (existsSync(nested)) return nested;
  throw new Error(`Could not find node.exe after extracting ${archiveName}.zip`);
}

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status ?? 1}`);
  }
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, buffer);
}

function patchZatcaXmlJs(nodeModulesDir) {
  const qrFile = join(nodeModulesDir, "zatca-xml-js/lib/zatca/qr/index.js");
  if (!existsSync(qrFile)) return;

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
    console.log("patched zatca-xml-js QR timestamp in bundled signer");
  }
}

function pruneSignerNodeModules(nodeModulesDir) {
  rmSync(join(nodeModulesDir, ".bin"), { recursive: true, force: true });
  rmSync(join(nodeModulesDir, ".package-lock.json"), { force: true });
}

function installSignerDeps() {
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  writeFileSync(
    join(stagingDir, "package.json"),
    JSON.stringify(
      {
        name: "zatca-signer",
        private: true,
        type: "module",
        dependencies: {
          "zatca-xml-js": "^0.1.9",
        },
      },
      null,
      2
    )
  );
  runOrThrow("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: stagingDir });
  pruneSignerNodeModules(join(stagingDir, "node_modules"));
  patchZatcaXmlJs(join(stagingDir, "node_modules"));
}

async function main() {
  const { platform, arch } = parseArgs();
  const archiveName = nodeArchiveName(platform, arch);
  const isWin = platform === "win32";
  const cacheDir = join(root, ".cache");
  const archiveFile = join(cacheDir, `${archiveName}.${isWin ? "zip" : "tar.gz"}`);
  const extractDir = join(cacheDir, archiveName);
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}.${isWin ? "zip" : "tar.gz"}`;

  mkdirSync(cacheDir, { recursive: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(archiveFile)) {
    console.log(`Downloading ${url}`);
    await download(url, archiveFile);
  }

  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  if (isWin) {
    extractZip(archiveFile, extractDir);
  } else {
    runOrThrow("tar", ["-xzf", archiveFile, "-C", extractDir, "--strip-components=1"]);
  }

  const nodeSrc = isWin
    ? resolveWindowsNodePath(extractDir, archiveName)
    : join(extractDir, "bin/node");
  const nodeDest = join(outDir, isWin ? "node.exe" : "node");
  cpSync(nodeSrc, nodeDest);
  if (!isWin) chmodSync(nodeDest, 0o755);

  cpSync(join(root, "scripts/sign-zatca-invoice.mjs"), join(outDir, "sign-zatca-invoice.mjs"));

  console.log("Installing zatca-xml-js for bundled signer...");
  installSignerDeps();
  cpSync(join(stagingDir, "node_modules"), join(outDir, "node_modules"), { recursive: true });
  pruneSignerNodeModules(join(outDir, "node_modules"));

  rmSync(stagingDir, { recursive: true, force: true });
  console.log(`ZATCA signer bundle ready: ${outDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

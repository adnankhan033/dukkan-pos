import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const releasesDir = join(root, "releases");

function targetRoot() {
  return process.env.CARGO_TARGET_DIR || join(root, "src-tauri/target");
}

function bundleDir(type, target) {
  const base = target
    ? join(targetRoot(), target, "release/bundle")
    : join(targetRoot(), "release/bundle");

  return {
    dmg: join(base, "dmg"),
    nsis: join(base, "nsis"),
  }[type];
}

function pickArtifact(type, files) {
  if (type === "dmg") {
    return files.find((name) => name.endsWith(".dmg") && !name.startsWith("."));
  }

  return (
    files.find((name) => name.endsWith("-setup.exe")) ||
    files.find((name) => name.endsWith(".exe") && !name.startsWith("."))
  );
}

export async function copyRelease(type, target = "") {
  const sourceDir = bundleDir(type, target);
  if (!sourceDir) {
    throw new Error(`Unknown release type: ${type}`);
  }

  let files;
  try {
    files = await readdir(sourceDir);
  } catch {
    throw new Error(
      `Build output folder not found: ${sourceDir}\nRun the Tauri build first.`
    );
  }

  const artifact = pickArtifact(type, files);
  if (!artifact) {
    throw new Error(`No ${type} installer found in ${sourceDir}`);
  }

  await mkdir(releasesDir, { recursive: true });

  const sourcePath = join(sourceDir, artifact);
  const destPath = join(releasesDir, artifact);

  await copyFile(sourcePath, destPath);
  return destPath;
}

async function main() {
  const type = process.argv[2];
  const target = process.argv[3] || "";

  if (!type) {
    console.error("Usage: node scripts/copy-release.mjs <dmg|nsis> [rust-target-triple]");
    process.exit(1);
  }

  const destPath = await copyRelease(type, target);
  console.log(`Release ready: ${destPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

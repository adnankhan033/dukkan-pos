import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyRelease } from "./copy-release.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const WINDOWS_TARGET = "x86_64-pc-windows-msvc";
const isWindows = process.platform === "win32";

function buildEnv() {
  const env = { ...process.env };
  env.CARGO_TARGET_DIR = join(root, "src-tauri/target");

  if (!isWindows) {
    const llvmPaths = [
      "/opt/homebrew/opt/llvm/bin",
      "/usr/local/opt/llvm/bin",
    ];

    for (const llvmBin of llvmPaths) {
      if (!env.PATH?.includes(llvmBin)) {
        env.PATH = `${llvmBin}:${env.PATH || ""}`;
      }
    }
  }

  return env;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: buildEnv() });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasCommand(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  return spawnSync(checker, [command], { stdio: "ignore", env: buildEnv() }).status === 0;
}

function hasRustTarget(target) {
  const result = spawnSync("rustup", ["target", "list", "--installed"], { encoding: "utf8" });
  return result.status === 0 && result.stdout.includes(target);
}

function printCrossCompileSetup() {
  console.error("\nWindows .exe builds on macOS/Linux need a one-time setup:\n");
  console.error("  brew install makensis llvm");
  console.error("  rustup target add x86_64-pc-windows-msvc");
  console.error("  cargo install cargo-xwin --locked");
  console.error("\nThen run again:");
  console.error("  bun run build:win-exe");
  console.error("\nOr build natively on a Windows PC with:");
  console.error("  bun run build:win-exe");
}

function ensureCrossCompileReady() {
  const missing = [];

  if (!hasCommand("makensis")) {
    missing.push("makensis  →  brew install makensis");
  }
  if (!hasCommand("cargo-xwin")) {
    missing.push("cargo-xwin  →  cargo install cargo-xwin --locked");
  }
  if (!hasCommand("llvm-lib")) {
    missing.push("llvm-lib  →  brew install llvm");
  }
  if (!hasRustTarget(WINDOWS_TARGET)) {
    missing.push(`${WINDOWS_TARGET}  →  rustup target add ${WINDOWS_TARGET}`);
  }

  if (missing.length > 0) {
    console.error("Missing Windows cross-compile tools:\n");
    missing.forEach((line) => console.error(`  • ${line}`));
    printCrossCompileSetup();
    process.exit(1);
  }
}

async function main() {
  if (isWindows) {
    run("node", ["scripts/build-zatca-signer.mjs", "--win"]);
    run("bun", ["run", "tauri", "build", "--bundles", "nsis"]);
    const dest = await copyRelease("nsis");
    console.log(`Release ready: ${dest}`);
    return;
  }

  ensureCrossCompileReady();

  run("node", ["scripts/build-zatca-signer.mjs", "--win"]);

  run("bun", [
    "run",
    "tauri",
    "build",
    "--runner",
    "cargo-xwin",
    "--target",
    WINDOWS_TARGET,
    "--bundles",
    "nsis",
  ]);

  const dest = await copyRelease("nsis", WINDOWS_TARGET);
  console.log(`Release ready: ${dest}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

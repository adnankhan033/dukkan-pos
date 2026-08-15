#!/usr/bin/env node
/**
 * Clears store setup + Drupal state so the app starts at step 1.
 * Close the app before running: bun run reset:setup
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const KEYS = [
  "installation_registration_status",
  "system_activation_status",
  "system_activation_key",
  "system_device_id",
  "system_activation_email_sent",
  "system_activation_email_error",
  "system_activation_created_at",
  "activation_customer_name",
  "activation_customer_phone",
  "activation_customer_store",
  "activation_customer_address",
  "activation_customer_vat",
  "activation_customer_cr",
  "activation_market_name",
  "activation_activated_at",
  "welcome_shown",
  "api_base_url",
];

const dbPath = join(
  homedir(),
  "Library/Application Support/com.sharedtechadnan.dukkan-pos/dukkan_pos.db"
);

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  console.error("Run the app once first, then close it and retry.");
  process.exit(1);
}

const quoted = KEYS.map((key) => `'${key.replace(/'/g, "''")}'`).join(", ");
const sql = `DELETE FROM settings WHERE key IN (${quoted}); SELECT changes();`;

const result = spawnSync("sqlite3", [dbPath, sql], { encoding: "utf8" });

if (result.status !== 0) {
  console.error(result.stderr || "Could not reset setup. Close the app and try again.");
  process.exit(result.status || 1);
}

console.log(`Setup reset OK (${result.stdout.trim()} settings cleared).`);
console.log("Restart the app — you will start at step 1 (Store details).");

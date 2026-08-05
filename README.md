# DukkanPOS

A desktop Point of Sale (POS) application built for retail stores in Saudi Arabia. DukkanPOS runs offline on your computer, supports bilingual (English / Arabic) receipts, VAT, inventory, suppliers, accounting, and optional **ZATCA** e-invoicing (Phase 1 and Phase 2).

**Stack:** Tauri 2 · React 19 · Vite · SQLite (local database)

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [Rust](https://rustup.rs) and platform tools for [Tauri](https://tauri.app/start/prerequisites/)
  - **macOS:** Xcode Command Line Tools
  - **Windows:** Visual Studio Build Tools + WebView2

---

## Commands

All commands are run from the project root (`dukkan-pos/`).

### First-time setup

```bash
# Clone or open the project, then install dependencies
bun install
```

> If you use npm instead of Bun: replace `bun install` with `npm install` and `bun run` with `npm run`.

### Run the app (development)

Opens the **DukkanPOS desktop window** with hot reload (Vite + Tauri).

```bash
bun run tauri dev
```

The first run compiles Rust dependencies and may take a minute. Later runs are much faster.

**If `tauri dev` fails** with a plugin permissions error mentioning the old `tauri-app` path, clear stale Rust build cache once, then start again:

```bash
cargo clean --manifest-path src-tauri/Cargo.toml && bun run tauri dev
```

After that, `bun run tauri dev` alone is enough for day-to-day development.

> **Note:** `bun run build` only builds the frontend to `dist/` — it does **not** open the desktop app. Use `bun run tauri dev` to run the app, or `bun run tauri build` for a production installer.

Other useful commands:

```bash
bun run dev          # Frontend only (Vite at http://localhost:1420/) — used internally by Tauri
bun run build        # Build frontend assets to dist/ (used before production packaging)
bun run preview      # Preview production frontend in the browser (no Tauri / SQLite)
```

### Build macOS installer (DMG)

Run on **macOS** only. Produces a `.dmg` disk image you can share or install.

```bash
# Step 1 — build the DMG (may take several minutes on first run)
bun run build:mac-dmg

# Step 2 (optional) — copy DMG to releases/ folder for distribution
bun run package:mac-dmg
```

**Output location:**

```
src-tauri/target/release/bundle/dmg/DukkanPOS_1.0.0_aarch64.dmg   # Apple Silicon
src-tauri/target/release/bundle/dmg/DukkanPOS_1.0.0_x64.dmg      # Intel Mac
```

After `package:mac-dmg`, a copy is also placed in:

```
releases/
```

**Install on Mac:** Open the `.dmg` → drag **DukkanPOS** to Applications → launch from Applications.

### Build Windows installer (EXE)

Run on **Windows** only. Produces an NSIS setup `.exe` installer.

```bash
# Step 1 — build the Windows installer
bun run build:win-exe

# Step 2 (optional) — zip the setup exe for easy sharing
bun run package:win-zip
```

**Output location:**

```
src-tauri/target/release/bundle/nsis/DukkanPOS_1.0.0_x64-setup.exe
```

After `package:win-zip`:

```
DukkanPOS-Windows.zip   # contains the setup.exe
```

**Install on Windows:** Run `DukkanPOS_1.0.0_x64-setup.exe` → follow the installer → launch from Start menu.

### Full production build (all bundles for current OS)

```bash
bun run tauri build
```

Builds all bundle types configured for your platform (DMG + `.app` on Mac, NSIS + MSI on Windows).

### Command reference

| Command | Description |
|---------|-------------|
| `bun install` | Install Node dependencies |
| `bun run tauri dev` | Run desktop app in development mode |
| `cargo clean --manifest-path src-tauri/Cargo.toml` | Clear stale Rust cache (after rename / upgrade) |
| `bun run tauri build` | Full production build (current OS) |
| `bun run build:mac-dmg` | Build macOS `.dmg` only |
| `bun run build:win-exe` | Build Windows `.exe` installer only |
| `bun run package:mac-dmg` | Copy DMG to `releases/` |
| `bun run package:win-zip` | Zip Windows setup exe |

> **Note:** You cannot cross-compile a Windows `.exe` on Mac (or a Mac `.dmg` on Windows) with Tauri by default. Build each installer on its target operating system.

### Upgrading from Portal POS

If you previously used **Portal POS** or the old **`tauri-app/`** folder name:

1. **Reopen the project** from the renamed folder: `dukkan-pos/` (was `tauri-app/`)
2. **Clear Rust build cache** so Tauri stops looking for files under the old path:
   ```bash
   cargo clean --manifest-path src-tauri/Cargo.toml
   bun run tauri dev
   ```
3. **Database:** The app now uses `dukkan_pos.db`. If you have existing data, rename your old database file from `portal_pos.db` to `dukkan_pos.db` in the Tauri app data directory, or restore from a JSON backup.
4. **Delete old build artifacts** such as `Portal POS.app` — run `bun run build:mac-dmg` to generate **DukkanPOS.app** / **DukkanPOS.dmg**

---

## Default login accounts

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Administrator | `admin` | `admin123` | Full access to all modules |
| Cashier | `cashier` | `cashier123` | Dashboard, Sales, Reports (configurable) |

> Change default passwords after first login via **Administration → Users**.

---

## Documentation

| Document | Description |
|----------|-------------|
| **[User Guide](docs/USER_GUIDE.md)** | Step-by-step setup and every module explained |
| **[ZATCA Guide](docs/ZATCA_GUIDE.md)** | Saudi e-invoicing Phase 1 & Phase 2 setup |

---

## Module overview

| Module | Purpose |
|--------|---------|
| **Dashboard** | Today’s sales, returns, stock alerts, profit, smart insights |
| **Sales (POS)** | Checkout, barcode scan, cash/card, hold & resume, returns |
| **Orders** | Sales history, reprint, returns, ZATCA sync status |
| **Products** | Products, categories, units, import/export Excel |
| **Inventory** | Stock levels, low/out filters, manual adjustments |
| **Customers** | Customer directory, export to Excel/PDF |
| **Suppliers** | Supplier accounts, credit balances, purchases |
| **Accounting** | Business expenses by category and period |
| **Reports** | Profit, daily/monthly sales, purchases, inventory |
| **Users** | Admin and cashier accounts |
| **Settings** | Store info, receipts, ZATCA, modules, backup |
| **ZATCA** | Queue, daily sync, test center (Phase 2) |

---

## Recommended first-time setup

1. Sign in as **admin**
2. Go to **Settings → Store** — enter store name (English/Arabic), address, CR, VAT number, currency, VAT %
3. Go to **Settings → Receipt** — configure receipt layout and preview
4. Add **Categories** and **Units** under Products
5. Add **Products** (or import from Excel)
6. Create **Users** for your cashiers
7. Optional: **Settings → ZATCA** — enable Phase 1 or Phase 2
8. **Settings → Backup** — download your first backup

Full details: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

---

## IDE setup (optional)

- [VS Code](https://code.visualstudio.com/) + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## License

Private project — DukkanPOS v0.1.0

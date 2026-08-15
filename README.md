# DukkanPOS

A desktop Point of Sale (POS) application built for retail stores in Saudi Arabia. DukkanPOS runs offline on your computer, supports bilingual (English / Arabic) receipts, VAT, inventory, suppliers, accounting, role-based access control, advanced reporting, and optional **ZATCA** e-invoicing (Phase 1 and Phase 2).

**Stack:** Tauri 2 · React 19 · Vite · SQLite (local database)

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [Rust](https://rustup.rs) and platform tools for [Tauri](https://tauri.app/start/prerequisites/)
  - **macOS:** Xcode Command Line Tools
  - **Windows:** Visual Studio Build Tools + WebView2

### First-time setup

```bash
bun install
bun run tauri dev
```

The first run compiles Rust dependencies and may take a minute. Later runs are much faster.

> If `tauri dev` fails with a plugin permissions error mentioning an old path, clear the Rust cache once:
>
> ```bash
> cargo clean --manifest-path src-tauri/Cargo.toml && bun run tauri dev
> ```

### Activation email (store setup)

Copy `.env.example` to `.env.local` and set your Gmail App Password so registration emails send to **dev.adnankhan@gmail.com** (activation keys are never shown in the app):

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_ACTIVATION_GMAIL=dev.adnankhan@gmail.com
VITE_ACTIVATION_GMAIL_APP_PASSWORD=your16charapppassword
```

Restart the app after saving. You receive the activation key by email and share it with the customer manually.

---

## Commands

All commands are run from the project root (`dukkan-pos/`).

| Command | Description |
|---------|-------------|
| `bun install` | Install Node dependencies |
| `bun run tauri dev` | Run desktop app in development mode (hot reload) |
| `bun run dev` | Frontend only at http://localhost:1420/ (used internally by Tauri) |
| `bun run build` | Build frontend assets to `dist/` |
| `bun run tauri build` | Full production build for current OS |
| `bun run build:mac-dmg` | Build macOS `.dmg` → copies to `releases/` |
| `bun run build:win-exe` | Build Windows `.exe` installer → copies to `releases/` |
| `bun run setup:win-cross` | One-time setup for Windows cross-compile on macOS |

> **Note:** `bun run build` only builds the frontend — it does **not** open the desktop app. Use `bun run tauri dev` to run the app.

---

## Building installers

Installers are copied automatically to the **`releases/`** folder at the project root.

### macOS (DMG)

Run on **macOS**:

```bash
bun run build:mac-dmg
```

**Output:**

```
releases/DukkanPOS_1.0.0_aarch64.dmg   # Apple Silicon
releases/DukkanPOS_1.0.0_x64.dmg       # Intel Mac
```

**Install:** Open the `.dmg` → drag **DukkanPOS** to Applications.

### Windows (EXE)

**Option A — on Windows (recommended):**

```bash
bun run build:win-exe
```

**Option B — cross-compile from macOS:**

One-time setup:

```bash
bun run setup:win-cross
# or manually:
# brew install makensis llvm
# rustup target add x86_64-pc-windows-msvc
# cargo install cargo-xwin --locked
```

Then build:

```bash
bun run build:win-exe
```

**Output:**

```
releases/DukkanPOS_1.0.0_x64-setup.exe
```

**Install:** Run the setup `.exe` → follow the installer → launch from Start menu.

### App icon

To regenerate desktop icons from the SVG logo:

```bash
bun run tauri icon src-tauri/icons/updated/logo.svg
```

Icons are written to `src-tauri/icons/`. Keep `tauri.conf.json` pointing at `icons/` (not `icons/updated/`).

---

## Default login accounts

| Role | Username | Password | Default access |
|------|----------|----------|----------------|
| Administrator | `admin` | `9042@admin02` | Full access (configurable) |
<!-- | Cashier | `cashier` | `cashier123` | Dashboard, Sales, Reports (configurable) | -->

> Change default passwords after first login via **Administration → Users**.

---

## Module overview

| Module | Purpose |
|--------|---------|
| **Dashboard** | Today's sales, returns, stock alerts, profit, smart insights |
| **Sales (POS)** | Checkout, barcode scan, cash/card, hold & resume, returns |
| **Orders** | Sales history, reprint, returns, ZATCA sync status, date filters |
| **Products** | Products, categories, units, import/export Excel |
| **Inventory** | Stock levels, low/out filters, manual adjustments |
| **Customers** | Customer directory, export to Excel/PDF |
| **Suppliers** | Supplier accounts, credit balances, purchases |
| **Accounting** | Business expenses and employee salaries |
| **Reports** | Advanced profit analytics with date range filters |
| **Subscriptions** | Subscription management |
| **Users** | Admin and cashier accounts |
| **Settings** | Store info, receipts, ZATCA, modules, backup |
| **ZATCA** | Queue, daily sync, test center (Phase 2) |

---

## Role-based access & module permissions

**Settings → Modules** controls what each role can see and do. Permissions work at two levels:

### Global (store-wide)

Turn entire modules on or off for everyone.

### Per role (Admin / Cashier)

Choose which modules and individual menu items each role can access.

**Example tree:**

```
Sales
  ├── POS
  ├── Orders
  └── ZATCA Sync

Products
  ├── Products
  ├── Categories
  └── Units

Administration (admin only)
  ├── Users
  ├── Settings
  ├── ZATCA Queue
  └── ZATCA Test Center
```

Permissions are enforced in:

- Sidebar navigation (hidden items don't appear)
- Route guards (direct URLs are blocked)
- Post-login redirect (users land on their first allowed page)

Cashiers never see **User Management** or **Settings**, even if toggles are changed.

---

## Advanced Reports

**Reports** includes a full analytics dashboard with flexible date filtering.

### Date presets

- **Today** (default)
- **This Month**
- **This Week**
- **Custom Range** — pick any **From** / **To** dates

### KPI dashboard

- Gross Sales, Returns, Net Revenue
- COGS, Expenses, Net Profit
- Sales count, Average sale value
- Net profit margin %

### Detail tabs

| Tab | Content |
|-----|---------|
| Sales | All completed sales in the selected period |
| Returns | Refunds in the period |
| Expenses | Operating expenses |
| Purchases | Supplier purchases |
| Inventory | Live stock snapshot (not date-filtered) |

Includes a step-by-step **Profit Breakdown** panel (sales → returns → COGS → expenses → net profit).

---

## Orders date filtering

**Orders** supports the same style of date filtering as Reports:

- Quick presets: **Today**, **This Week**, **This Month**, **Custom Range**
- **From** / **To** date pickers with **Apply**
- Stats cards (order count, sales total, returns, net) update with the selected period
- Return status filters (All, No Returns, Partial, Full Return) work together with dates
- Search by order #, customer, or payment method

---

## Recommended first-time setup

1. Sign in as **admin**
2. **Settings → Store** — store name (English/Arabic), address, CR, VAT number, currency, VAT %
3. **Settings → Receipt** — receipt layout and preview
4. **Settings → Modules** — enable/disable modules and menu items per role
5. Add **Categories** and **Units** under Products
6. Add **Products** (or import from Excel)
7. Create **Users** for cashiers
8. Optional: **Settings → ZATCA** — enable Phase 1 or Phase 2
9. **Settings → Backup** — download your first backup

Full details: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| **[User Guide](docs/USER_GUIDE.md)** | Step-by-step setup and every module explained |
| **[ZATCA Guide](docs/ZATCA_GUIDE.md)** | Saudi e-invoicing Phase 1 & Phase 2 setup |

---

## Project structure

```
dukkan-pos/
├── src/                    # React frontend
│   ├── pages/              # Screen components (Sales, Orders, Reports, …)
│   ├── components/         # Shared UI and feature components
│   ├── services/           # SQLite data layer (SaleService, ReportService, …)
│   ├── hooks/              # usePermissions, useVisibleNavGroups, …
│   └── utils/              # modules.js, nav.js, format.js, …
├── src-tauri/              # Tauri / Rust backend
│   ├── icons/              # App icons (generated from logo.svg)
│   └── tauri.conf.json     # App name, window, bundle config
├── releases/               # Built installers (DMG, EXE)
├── scripts/                # Build helpers (copy-release, build-win-exe, …)
└── data/                   # Sample import CSVs
```

---

## IDE setup (optional)

- [VS Code](https://code.visualstudio.com/) + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## License

Private project — DukkanPOS v1.0.0


## clear activations 

sqlite3 "$HOME/Library/Application Support/com.sharedtechadnan.dukkan-pos/dukkan_pos.db" "DELETE FROM settings WHERE key IN (
  'system_activation_key',
  'system_activation_status',
  'system_device_id',
  'system_activation_email_sent',
  'system_activation_created_at',
  'system_activation_email_error',
  'activation_customer_name',
  'activation_customer_phone',
  'activation_customer_store',
  'activation_customer_address',
  'system_hostname'
);"



## clear activations  Generated app password
oaam phzn iqde qzql



## Your super admin account:
 Username: admin
 Password: 9042@Admin02

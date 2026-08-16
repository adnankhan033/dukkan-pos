# DukkanPOS

A desktop Point of Sale (POS) application built for retail stores and baqalas in Saudi Arabia. DukkanPOS runs offline on your computer, supports bilingual (English / Arabic) receipts, **VAT-inclusive shelf pricing**, inventory, suppliers, accounting, role-based access control, advanced reporting, and optional **ZATCA** e-invoicing (Phase 1 and Phase 2).

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

> Change default passwords after first login via **Administration → Users**.

---

## Module overview

| Module | Purpose |
|--------|---------|
| **Dashboard** | Today's sales, returns, stock alerts, profit, smart insights |
| **Sales (POS)** | Checkout, barcode scan, VAT-inclusive pricing, cash/card, hold & resume, returns |
| **Orders** | Sales history, reprint, returns, ZATCA sync status, date filters |
| **Products** | Products, categories, units, import/export CSV & Excel |
| **Inventory** | Stock levels, low/out filters, manual adjustments |
| **Customers** | Customer directory, export to Excel/PDF |
| **Suppliers** | Supplier accounts, credit balances, purchases |
| **Accounting** | Business expenses and employee salaries |
| **Reports** | Advanced profit analytics with date range filters |
| **Subscriptions** | Subscription management |
| **Users** | Admin and cashier accounts |
| **Settings** | Store info, VAT, receipts, ZATCA, modules, backup |
| **ZATCA** | Queue, daily sync, test center (Phase 2) |

---

## VAT & pricing (Saudi retail)

DukkanPOS supports **VAT-inclusive shelf prices** — the normal approach for Saudi supermarkets and baqalas.

### Store defaults (**Settings → Store**)

| Setting | Default | Description |
|---------|---------|-------------|
| **VAT %** | 15 | Store-wide VAT rate |
| **Prices include VAT** | Yes (new installs) | Selling price = customer-facing shelf price |

When VAT-inclusive is enabled, VAT is extracted using:

```
VAT = price × rate ÷ (100 + rate)
```

**Example:** Pepsi shelf price **11.50 SAR** at 15% VAT → net **10.00** + VAT **1.50** = customer pays **11.50**.

> **Existing stores** with products already entered keep VAT-exclusive behaviour until you enable **Prices include VAT** and update shelf prices.

### Per-product settings (**Products → Add/Edit**)

| Field | Options | Description |
|-------|---------|-------------|
| **Tax category** | Standard · Zero-rated · Exempt | VAT treatment for ZATCA |
| **Price type** | Store default · Inclusive · Exclusive | Override store pricing mode |
| **VAT rate override** | Optional % | Blank = use store VAT % |

Cashiers never choose include/exclude at checkout — it follows store and product settings automatically.

---

## Product import & export

**Products → Import / Export** supports CSV and Excel with **15 columns**:

| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| `name` | Yes | Pepsi 330ml | English product name |
| `name_ar` | No | بيبسي ٣٣٠ مل | Arabic name |
| `sku` | No | PEPSI-330 | Internal code; used for update matching |
| `barcode` | No | 6281000123453 | Scanner lookup |
| `category` | No | Beverages | Created automatically if missing |
| `unit` | No | pcs | Must exist in **Settings → Units** |
| `supplier` | No | Almarai Trading | Must exist in **Suppliers** |
| `cost_price` | No | 8.50 | Purchase cost |
| `selling_price` | Yes | 11.50 | Shelf price (inclusive when price type is inclusive) |
| `tax_category` | No | standard | `standard` · `zero_rated` · `exempt` |
| `vat_rate` | No | 15 | Optional override; blank = store rate |
| `vat_price_type` | No | inclusive | `inherit` · `inclusive` · `exclusive` |
| `quantity` | No | 120 | Opening stock |
| `min_stock` | No | 24 | Low-stock alert |
| `published` | No | yes | `yes` / `no` — visible in POS |

Download **CSV Template** or **Excel Template** from the Import / Export modal — includes 3 example products (Pepsi inclusive, Milk inherit, Coffee zero-rated) and an Instructions sheet.

**Import modes:** new only · update by SKU/barcode · skip duplicates · replace all.

---

## Receipts & invoices

**Settings → Receipt** includes:

- Saudi Baqala, Classic Thermal, and Compact 58mm templates
- **Invoice sections** — show/hide each part (header, items, totals, QR, footer, etc.)
- Bilingual labels, ZATCA QR, paper width, header note, footer text

Store name, CR, and VAT registration come from **Settings → Store**.

---

## ZATCA e-invoicing

**Settings → ZATCA** provides unified Phase 1 (QR on receipts) and Phase 2 (e-invoicing sync) setup:

- Company details (name, CR, VAT, address)
- **Business Information** — structured address fields (building, street, district, city, postal code) stored for future use
- Device keys, CSR, compliance & production certificates

See [docs/ZATCA_GUIDE.md](docs/ZATCA_GUIDE.md) for full setup steps.

---

## Role-based access & module permissions

**Settings → Modules** controls what each role can see and do. Permissions work at two levels:

### Global (store-wide)

Turn entire modules on or off for everyone.

### Per role (Admin / Cashier)

Choose which modules and individual menu items each role can access.

Permissions are enforced in sidebar navigation, route guards, and post-login redirect.

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

---

## Recommended first-time setup

1. Sign in as **admin**
2. **Settings → Store** — store name (EN/AR), address, phone, CR, VAT number, currency, VAT %, enable **Prices include VAT**
3. **Settings → Receipt** — template, invoice sections, preview & test print
4. **Settings → Modules** — enable/disable modules and menu items per role
5. Add **Categories** and **Units** under Products
6. Add **Products** manually or **Import / Export** from Excel (use the template)
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
│   ├── services/           # SQLite data layer (SaleService, ProductImportService, …)
│   ├── utils/              # vatPricing.js, productImport/, format.js, …
│   └── zatca/              # ZATCA Phase 1 & 2 integration
├── src-tauri/              # Tauri / Rust backend
│   ├── icons/              # App icons (generated from logo.svg)
│   └── tauri.conf.json     # App name, window, bundle config
├── releases/               # Built installers (DMG, EXE)
├── scripts/                # Build helpers (copy-release, build-win-exe, …)
└── data/                   # Sample import CSVs / Excel files
```

---

## IDE setup (optional)

- [VS Code](https://code.visualstudio.com/) + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## Developer notes

### Clear activation (reset device registration)

```bash
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
```

---

## License

Private project — DukkanPOS v1.0.0



## activations Generated app password
```
 oaam phzn iqde qzql
```
# Nexttel POS

Desktop Point of Sale for retail stores and baqalas in Saudi Arabia. Nexttel POS runs **offline** on your computer, supports bilingual (English / Arabic) receipts, **VAT-inclusive shelf pricing**, inventory, suppliers, customers, accounting, role-based access, reports, shareable **store cards**, optional **Gmail backup**, and **ZATCA** e-invoicing (Phase 1 and Phase 2).

**Stack:** Tauri 2 · React 19 · Vite 7 · SQLite (local) · Zustand

**App:** Nexttel POS v1.0.0

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

### Store activation (first launch)

On a new install the app opens a 3-step setup wizard:

1. **Store details** — name, phone, and address
2. **Activation key** — a 6-digit key in the form `DKP-123456` is emailed to **dev.adnankhan@gmail.com**. Enter only the six digits (the `DKP-` prefix is already shown)
3. **Sign in** — default super-admin account (see below)

The Gmail App Password used to send that email is built into the app. You can override it with `.env.local` if needed:

```bash
cp .env.example .env.local
```

```env
VITE_ACTIVATION_GMAIL=dev.adnankhan@gmail.com
VITE_ACTIVATION_GMAIL_APP_PASSWORD=
```

Restart the app after saving env changes.

To start setup from step 1 again (close the app first):

```bash
bun run reset:setup
```

---

## Commands

All commands are run from the project root (`nexttel-pos/`).

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
| `bun run reset:setup` | Clear activation so onboarding starts at step 1 |

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
releases/Nexttel POS_1.0.0_aarch64.dmg   # Apple Silicon
releases/Nexttel POS_1.0.0_x64.dmg       # Intel Mac
```

**Install:** Open the `.dmg` → drag **Nexttel POS** to Applications.

### Windows (EXE)

**Option A — on Windows (recommended):**

```bash
bun run build:win-exe
```

**Option B — cross-compile from macOS:**

```bash
bun run setup:win-cross
bun run build:win-exe
```

**Output:**

```
releases/Nexttel POS_1.0.0_x64-setup.exe
```

**Install:** Run the setup `.exe` → follow the installer → launch from Start menu.

### Data location (macOS and Windows)

The same app ID is used on both platforms. Folders are chosen at runtime for each user’s computer:

| | macOS | Windows |
|---|---|---|
| **Database** | `~/Library/Application Support/com.sharedtechadnan.nexttel-pos/nexttel_pos.db` | `%APPDATA%\com.sharedtechadnan.nexttel-pos\nexttel_pos.db` |
| **Backups** | `~/Documents/NexttelPOS/backups/` | `%USERPROFILE%\Documents\NexttelPOS\backups\` |

Windows store owners only need the setup `.exe`. They do not need Mac paths.

### App icon

```bash
bun run tauri icon src-tauri/icons/updated/logo.svg
```

Icons are written to `src-tauri/icons/`. Keep `tauri.conf.json` pointing at `icons/` (not `icons/updated/`).

---

## Default login

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Administrator | `admin` | `9042@Admin02` | Full access (configurable) |

A cashier account (`cashier` / `cashier123`) is also seeded on a fresh database.

> Change default passwords after first login via **Administration → Users**.

---

## What’s in the app

### Main menu

| Item | Purpose |
|------|---------|
| **Dashboard** | Today’s sales, returns, stock alerts, profit, insights |
| **Sales → POS** | Checkout, barcode scan, VAT-inclusive pricing, cash / card / pay later, hold & resume, returns |
| **Sales → Invoices** | Sales history, reprint, returns, ZATCA status, date filters |
| **Sales → ZATCA Sync** | Manual Phase 2 sync for the business day |
| **Products** | Catalog, categories, units, CSV / Excel import & export |
| **Inventory** | Stock levels, low / out filters, manual adjustments |
| **Customers** | Directory, balances, account statement PDF, filters, Excel / PDF export |
| **Suppliers** | Supplier accounts, credit balances, purchases |
| **Accounting** | Expenses and employee salaries |
| **Reports** | Profit analytics with date presets and custom range |
| **Daily Close** | End-of-day close and printable summary |
| **Administration** | Users, subscriptions, settings, Gmail backup, ZATCA queue & test center |
| **Store Card** | Shareable store cards (light poster designs) — download PNG, copy, or WhatsApp |

### Settings tabs

| Tab | Purpose |
|-----|---------|
| **Store** | Name (EN/AR), address, phone, CR, VAT number, VAT %, inclusive pricing, timezone |
| **Permissions** | Modules, menu items, and actions per role |
| **Payments** | POS payment methods (Cash, Card, Pay Later, plus custom) |
| **Receipt** | Templates, bilingual sections, QR, paper width, preview |
| **ZATCA** | Phase 1 QR and Phase 2 e-invoicing |
| **Dashboard** | Which widgets admins and cashiers see |
| **Vendor** | Software company branding in the sidebar |
| **Backup** | Local JSON backup / restore and data clear |

---

## Store cards

**Store Card** (last item in the main menu) builds a shareable card from store details.

1. Fill name, Arabic name, tagline, phone, WhatsApp, address, hours, website, email
2. Pick a light design: **Mint**, **Lilac**, **Sky**, **Peach**, **Blush**, **Lemon**
3. **Download PNG**, **Copy** details, or send via **WhatsApp**

Each card shows a QR code that opens WhatsApp (or the store website).

---

## VAT & pricing (Saudi retail)

Nexttel POS supports **VAT-inclusive shelf prices** — the normal approach for Saudi supermarkets and baqalas.

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

### Per-product settings (**Products → Add / Edit**)

| Field | Options | Description |
|-------|---------|-------------|
| **Tax category** | Standard · Zero-rated · Exempt | VAT treatment for ZATCA |
| **Price type** | Store default · Inclusive · Exclusive | Override store pricing mode |
| **VAT rate override** | Optional % | Blank = use store VAT % |

Cashiers never choose include/exclude at checkout — it follows store and product settings automatically.

---

## Product import & export

**Products → Import / Export** supports CSV and Excel.

| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| `name` | Yes | Pepsi 330ml | English product name |
| `name_ar` | No | بيبسي ٣٣٠ مل | Arabic name |
| `sku` | No | PEPSI-330 | Internal code; used for update matching |
| `barcode` | No | 6281000123453 | Scanner lookup |
| `category` | No | Beverages | Created automatically if missing |
| `unit` | No | pcs | Must already exist under **Products → Units** |
| `supplier` | No | Almarai Trading | Matched or created if new |
| `cost_price` | No | 8.50 | Purchase cost |
| `selling_price` | Yes | 11.50 | Shelf price (inclusive when that mode is on) |
| `vat` | No | default | `default` · `zero_rated` · `exempt` |
| `quantity` | No | 120 | Opening stock |
| `min_stock` | No | 24 | Low-stock alert |
| `published` | No | yes | `yes` / `no` — visible in POS |

Download **CSV Template** or **Excel Template** from the Import / Export modal.

**Import modes:** new only · update by SKU/barcode · skip duplicates · replace all.

---

## Receipts & invoices

**Settings → Receipt** includes:

- Saudi Baqala, Classic Thermal, and Compact 58mm templates
- Invoice sections — show/hide header, items, totals, QR, footer, and more
- Bilingual labels, ZATCA QR, paper width, header note, footer text

Store name, CR, and VAT registration come from **Settings → Store**.

---

## Customers

- Search, filters, and directory export (Excel / PDF)
- Customer account modal with sales and balance
- **Pay later** on POS, linked to a customer
- Account statement PDF for a single customer

---

## Payments

**Settings → Payments** manages POS tenders. Built-in methods:

| Code | Label | Notes |
|------|-------|--------|
| `cash` | Cash | Opens cash tender |
| `card` | Card | Card / mada |
| `pay_later` | Pay Later | Posts to the customer account |

You can add extra methods (for example mada or transfer) without changing checkout code.

---

## ZATCA e-invoicing

**Settings → ZATCA** covers Phase 1 (QR on receipts) and Phase 2 (e-invoicing sync):

- Company details (name, CR, VAT, address)
- Structured address fields (building, street, district, city, postal code)
- Device keys, CSR, compliance and production certificates
- **ZATCA Queue**, **ZATCA Sync**, and **ZATCA Test Center** under Administration / Sales

See [docs/ZATCA_GUIDE.md](docs/ZATCA_GUIDE.md) for full setup steps.

---

## Role-based access

**Settings → Permissions** controls what each role can see and do:

- **Global** — turn modules on or off for everyone
- **Per role** — Admin / Cashier modules, menu items, and actions

Enforced in the sidebar, route guards, and post-login redirect. Cashiers never see **Users** or **Settings**, even if other toggles change.

---

## Reports & daily close

**Reports** uses the store business timezone (default Asia/Riyadh).

**Date presets:** Today · This week · This month · Custom from / to

**KPIs:** Gross sales, returns, net revenue, COGS, expenses, net profit, sale count, average sale, margin %

**Tabs:** Sales · Returns · Expenses · Purchases · Inventory (live snapshot)

**Daily Close** produces an end-of-day summary you can print or keep for the till.

---

## Backup

- **Settings → Backup** — download / restore a full JSON backup; optional data clear
- **Administration → Gmail Backup** — send a backup to Gmail on a schedule while the app is open

---

## Recommended first-time setup

1. Complete **store activation**, then sign in as **admin**
2. **Settings → Store** — name (EN/AR), address, phone, CR, VAT number, currency, VAT %, **Prices include VAT**, timezone
3. **Settings → Receipt** — template, sections, preview
4. **Settings → Payments** — confirm cash / card / pay later
5. **Settings → Permissions** — modules and cashier access
6. Add **Categories** and **Units**
7. Add **Products** (or import from Excel using the template)
8. Create **Users** for cashiers
9. Optional: **Settings → ZATCA**, **Store Card**, **Gmail Backup**
10. Download your first backup

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
nexttel-pos/
├── src/                    # React frontend
│   ├── pages/              # Screens (Sales, Orders, StoreCards, Settings, …)
│   ├── components/         # Shared UI and feature components
│   ├── services/           # SQLite data layer
│   ├── utils/              # vatPricing, productImport, storeCardProfile, …
│   └── zatca/              # ZATCA Phase 1 & 2
├── src-tauri/              # Tauri / Rust backend (activation email, icons)
├── releases/               # Built installers (DMG, EXE)
├── scripts/                # Build helpers and reset:setup
├── docs/                   # User and ZATCA guides
└── data/                   # Sample import files and backups
```

---

## IDE setup (optional)

- [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.com/) + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## License

Private project — Nexttel POS v1.0.0


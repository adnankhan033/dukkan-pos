# NexttelPOS — User Guide

Complete step-by-step documentation for NexttelPOS: setup, daily workflows, and every module.

---

## Table of contents

1. [Getting started](#1-getting-started)
   - [Install, run & build commands](#11-install-and-launch)
2. [Roles and permissions](#2-roles-and-permissions)
3. [Dashboard](#3-dashboard)
4. [Sales module (POS)](#4-sales-module-pos)
5. [Orders](#5-orders)
6. [Products module](#6-products-module)
7. [Inventory](#7-inventory)
8. [Customers](#8-customers)
9. [Suppliers & Purchases](#9-suppliers--purchases)
10. [Accounting (Expenses)](#10-accounting-expenses)
11. [Reports](#11-reports)
12. [User management](#12-user-management)
13. [Settings](#13-settings)
14. [Backup & restore](#14-backup--restore)
15. [Daily workflows](#15-daily-workflows)
16. [Tips & shortcuts](#16-tips--shortcuts)

---

## 1. Getting started

### 1.1 Install and launch

#### Prerequisites

- [Bun](https://bun.sh) or Node.js 18+
- [Rust](https://rustup.rs) + [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

#### Install dependencies (first time only)

```bash
cd nexttel-pos
bun install
```

#### Run in development

```bash
bun run tauri dev
```

This opens the NexttelPOS window with hot reload for code changes.

#### Build macOS DMG (installer)

On a Mac:

```bash
bun run build:mac-dmg
bun run package:mac-dmg    # optional — copies to releases/
```

Find the installer at:

`src-tauri/target/release/bundle/dmg/NexttelPOS_1.0.0_*.dmg`

#### Build Windows EXE (installer)

On Windows:

```bash
bun run build:win-exe
bun run package:win-zip    # optional — creates NexttelPOS-Windows.zip
```

Find the installer at:

`src-tauri/target/release/bundle/nsis/NexttelPOS_1.0.0_x64-setup.exe`

#### End users

If you received a built installer, double-click the **DMG** (Mac) or **setup EXE** (Windows) — no commands needed.

#### First launch

On first run, the app creates a local SQLite database (`nexttel_pos.db`) in the OS app-data folder and seeds default settings and users.

- **macOS:** `~/Library/Application Support/com.sharedtechadnan.nexttel-pos/`
- **Windows:** `%APPDATA%\com.sharedtechadnan.nexttel-pos\`

Backups go to the user's Documents folder on both platforms:

- **macOS:** `~/Documents/NexttelPOS/backups/`
- **Windows:** `%USERPROFILE%\Documents\NexttelPOS\backups\`

### 1.2 Sign in

1. Open the login screen
2. Enter username and password
3. Default accounts:
   - **Administrator:** `admin` / `admin123`
   - **Cashier:** `cashier` / `cashier123`
4. After login, you are redirected based on your role (Admin → Dashboard, Cashier → POS)

### 1.3 Navigation

The sidebar groups features by module. Expand groups (Sales, Products, etc.) to see sub-pages. The sidebar shows your store name from Settings.

Use the **moon/sun** icon to toggle dark/light theme. Use **logout** to sign out.

---

## 2. Roles and permissions

### 2.1 Roles

| Role | Description |
|------|-------------|
| **Administrator** | Full access — products, inventory, settings, users, ZATCA, reports |
| **Cashier** | Limited access — typically Dashboard, POS, Orders, Reports |

### 2.2 Module access control

Administrators can restrict which modules each role sees:

1. Go to **Settings → Modules**
2. **Enable/disable modules** globally (e.g. turn off Accounting for the whole store)
3. **Per-role toggles** — choose what Admin and Cashier can access

Cashiers cannot access **Users** or **Settings** by default.

---

## 3. Dashboard

**Path:** Sidebar → Dashboard

The dashboard adapts to your role.

### 3.1 Administrator dashboard

Shows store-wide metrics:

- **Today's Sales (Net)** — completed sales minus returns today
- **Today's Returns** — refund total today
- **Today's Purchases** — stock purchases today (optional, toggle in Settings)
- **Total Products / Customers**
- **Low Stock Items** — products at or below minimum stock
- **Monthly Revenue / Returns / Profit** — optional profit card
- **Smart insights** — actionable alerts (slow movers, stock issues, etc.)
- **Top products** — best sellers
- **Recent sales** — latest transactions
- **ZATCA sync widget** — pending invoices when Phase 2 is active

### 3.2 Cashier dashboard

Shows:

- Today's sales total
- Held orders count
- Quick buttons: **Open POS**, **View Orders**
- Short insights and top products (configurable in Settings → Dashboard)

### 3.3 Dashboard settings

**Settings → Dashboard** tab:

- Show/hide profit on admin dashboard
- Show/hide purchases on admin dashboard
- Show/hide recent sales on cashier dashboard

---

## 4. Sales module (POS)

**Path:** Sidebar → Sales → POS

The main checkout screen for processing customer sales.

### 4.1 Layout

- **Left:** Product catalog with search and category filters
- **Right:** Cart, customer selection, payment, and complete sale

### 4.2 Adding products

**Tap/click a product card** to add one unit to the cart.

**Search bar:**

- Type product name (English or Arabic), SKU, or barcode
- Press **Enter** to scan/add by exact barcode match

**Category chips:** Filter products by category (All + each category with count).

**Product cards show:**

- Product name (bilingual)
- Price
- Category and stock level
- Badge with quantity already in cart
- Low-stock warning (overselling is allowed if stock is zero)

### 4.3 Cart

- **Customer:** Select walk-in or a saved customer
- **Quantity:** Use +/- buttons or remove with trash icon
- **Clear cart:** Removes all items
- **Discount:** Enter a fixed discount amount (subtracted before VAT)
- **Summary:** Subtotal, discount, VAT, total due

### 4.4 Payment

**Cash tab:**

1. Enter cash received (optional for partial payment)
2. Quick buttons: **Exact**, **+50**, **+100**, **+200**, **+500**
3. View **Change due** or **Balance due**
4. Click **Complete cash sale**

**Card tab:**

1. Review total
2. Click **Complete card sale**

**Other actions:**

- **Hold** — save cart as a held sale (resume later from the held strip at top)
- **Reprint** — print last completed sale receipt
- **Return** — open return modal (see Orders)

### 4.5 Complete sale flow

1. Click Complete sale
2. **Confirm** — review items and totals
3. **Print** — print receipt or skip printing
4. Sale is saved; stock is reduced; ZATCA processing runs if enabled

### 4.6 Held sales

When you hold a sale, a chip appears at the top. Click it to reload that cart and continue checkout.

### 4.7 Returns

Click **Return** in the POS header to process a sale return (full or partial). Stock is restored; refund is recorded.

---

## 5. Orders

**Path:** Sidebar → Sales → Orders

View and manage completed sales.

### 5.1 Features

- **Period tabs:** Today, This Week, This Month
- **Return filters:** All, No Returns, With Returns, Partial Return, Full Return
- **Search** by invoice number or customer
- **Stats cards:** order count, revenue, returns

### 5.2 Per-order actions

- **View details** — line items, payment, VAT, customer
- **Print receipt**
- **Process return**
- **Delete** (admin only, with confirmation)

### 5.3 ZATCA column (Phase 2 only)

When ZATCA Phase 2 is active, orders show sync status (Pending, Synced, Failed) and options to download signed XML.

---

## 6. Products module

**Path:** Sidebar → Products

### 6.1 Products

**Path:** Products → Products

Manage your sellable items.

**Add / edit product fields:**

| Field | Description |
|-------|-------------|
| Name (English) | Required; auto-translate to Arabic available |
| Name (Arabic) | Shown on receipts and POS |
| SKU | Internal product code |
| Barcode | Scannable at POS |
| Category | From Categories list |
| Unit | pcs, kg, box, etc. |
| Supplier | Optional link |
| Cost price | Purchase cost |
| Selling price | POS price |
| Quantity | Current stock |
| Min stock | Low-stock alert threshold |
| Published | Unpublished products hidden from POS |
| Image | Optional product photo |

**Sections:** Published / Unpublished tabs

**Bulk actions:** Select multiple products → publish, unpublish, or delete

**Barcode scanner:** Use camera to scan barcodes when adding products

**Import / Export:**

- Download Excel template
- Import products from Excel or CSV (create or update mode)
- Export current catalog to Excel
- Validation report for import errors

### 6.2 Categories

**Path:** Products → Categories

Organize products into groups (e.g. Beverages, Snacks).

- Add name and description
- Search and edit existing categories
- Categories appear as filters on the POS

### 6.3 Units

**Path:** Products → Units

Define measurement units (symbol + name). Default units are seeded on first install.

---

## 7. Inventory

**Path:** Sidebar → Inventory → Stock

Monitor and adjust stock levels.

### 7.1 Stock list

Shows all products with:

- Current quantity (color-coded: green = OK, yellow = low, red = out)
- Minimum stock level
- Cost price

### 7.2 Filters

- **All** — every product
- **Low Stock** — at or below minimum
- **Out of Stock** — quantity zero or negative

### 7.3 Manual adjustment

1. Click **Adjust** on a product
2. Enter new quantity and reason
3. Save — adjustment is logged in inventory history

> Stock also updates automatically from **sales** (decrease) and **purchases/returns** (increase).

---

## 8. Customers

**Path:** Sidebar → Customers

Maintain a customer directory for sales linked to accounts.

### 8.1 Customer fields

- Name (required)
- Phone, email, address
- Notes

### 8.2 Features

- Search, paginated list
- Add, edit, delete customers
- **Export directory** — Excel or PDF with company header (from store settings)

Customers are optional at POS — default is **Walk-in customer**.

---

## 9. Suppliers & Purchases

### 9.1 Suppliers (Accounts)

**Path:** Sidebar → Suppliers → Accounts

Manage vendor relationships and credit balances.

**Supplier fields:** Company name, contact person, phone, email, address

**Account summary (per supplier):**

- Total delivered (credit purchases)
- Total paid
- Pending balance

**Global summary:** Total pending across all suppliers

**Export:** Supplier directory to Excel/PDF with balances

### 9.2 Purchases

**Path:** Sidebar → Suppliers → Purchases

Record stock coming into the store.

**Purchase types:**

| Type | Description |
|------|-------------|
| Market / Cash | One-off cash purchase, no supplier account |
| Supplier — paid now | Linked to supplier, paid immediately |
| Supplier — on credit | Linked to supplier, pay later (adds to balance) |

**Steps:**

1. Choose purchase type and supplier (if applicable)
2. Search and add products with quantities and unit costs
3. Add notes and due date (for credit)
4. Save — stock increases; supplier balance updates for credit purchases

---

## 10. Accounting (Expenses)

**Path:** Sidebar → Accounting → Expenses

Track business costs separate from inventory purchases.

### 10.1 Expense categories

Rent, Salaries & Wages, Utilities, Store Supplies, Maintenance, Transport, Marketing, Tax & Government Fees, Other

### 10.2 Features

- Add expense: name, category, amount, date/time, notes
- Filter by period: Daily, Weekly, Monthly, Yearly, All
- Filter by category
- Search by name
- Summary cards: total and breakdown by category
- Uses **business timezone** from Settings (default: Asia/Riyadh)

---

## 11. Reports

**Path:** Sidebar → Reports

Business analytics and summaries.

### 11.1 Available reports

| Report | Content |
|--------|---------|
| **Profit summary** | Revenue, cost, expenses, net profit |
| **Daily sales** | Today's transactions |
| **Monthly sales** | Current month sales list |
| **Monthly returns** | Return transactions |
| **Monthly purchases** | Stock purchase totals |
| **Monthly expenses** | Expense totals by category |
| **Inventory report** | Stock valuation and quantities |

All monetary values use your store currency (default SAR).

---

## 12. User management

**Path:** Sidebar → Administration → Users

*(Administrators only)*

### 12.1 Create user

- Username, full name, password
- Role: Administrator or Cashier
- Active / inactive toggle

### 12.2 Manage users

- Search users
- Edit details or reset password
- Deactivate or delete users

> You cannot delete the last active administrator.

---

## 13. Settings

**Path:** Sidebar → Administration → Settings

### 13.1 Store tab

| Setting | Purpose |
|---------|---------|
| Store name (EN / AR) | Receipt and sidebar branding |
| Address | Receipt header |
| CR number | Commercial registration |
| VAT registration | Tax ID for receipts and ZATCA |
| VAT % | Default 15% (Saudi standard) |
| Currency | SAR default |
| Business timezone | Asia/Riyadh default |
| Date/time override | Testing or manual business date |

### 13.2 Receipt tab

| Setting | Purpose |
|---------|---------|
| Receipt template | Layout style (e.g. baqala) |
| Paper width | 80mm thermal default |
| Header note | Extra text on receipt |
| Footer (EN / AR) | Thank-you message |
| Show QR | ZATCA QR on receipt |
| Show bilingual | English + Arabic product names |
| Show tax info | VAT breakdown on receipt |
| **Preview** | Live receipt preview |

### 13.3 ZATCA tab

Saudi e-invoicing integration. See **[ZATCA Guide](ZATCA_GUIDE.md)** for full setup.

Quick summary:

- **Disabled** — no ZATCA
- **Phase 1** — QR code on receipts only (no API)
- **Phase 2** — QR + electronic invoice submission to ZATCA

Includes onboarding wizard, CSR generation, certificate management, and sync controls.

### 13.4 Modules tab

Enable/disable modules globally and per role (Admin vs Cashier).

### 13.5 Dashboard tab

Toggle dashboard widgets (profit, purchases, recent sales).

### 13.6 Backup tab

Download JSON backup or restore from file. See [Backup & restore](#14-backup--restore).

---

## 14. Backup & restore

**Path:** Settings → Backup

### 14.1 Download backup

1. Click **Download Backup**
2. Confirm — a JSON file is saved to your Downloads folder
3. Backup includes: products, sales, customers, suppliers, expenses, users, settings, ZATCA data

### 14.2 Restore backup

1. Click **Restore from file**
2. Select a previously exported JSON backup
3. Confirm — **all current data is replaced**
4. App reloads settings; you may need to sign in again

> **Important:** Restore regularly and keep backups safe. There is no cloud sync — data lives only on this device.

---

## 15. Daily workflows

### 15.1 Cashier — start of shift

1. Sign in as cashier
2. Open **POS**
3. Verify products load and search works
4. Test barcode scanner if used

### 15.2 Processing a sale

1. Add products (tap or scan)
2. Select customer if needed
3. Apply discount if any
4. Choose Cash or Card
5. Complete sale → print receipt

### 15.3 End of day (admin)

1. Review **Orders** for today's sales
2. Check **Reports** for daily totals
3. Review **Inventory** for low stock
4. If ZATCA Phase 2: run **ZATCA Sync** for pending invoices
5. **Download backup**

### 15.4 Restocking

1. Record **Purchase** (market or supplier)
2. Verify quantities in **Inventory**
3. Update **selling prices** in Products if needed

---

## 16. Tips & shortcuts

| Tip | Details |
|-----|---------|
| Barcode at POS | Focus search bar, scan, press Enter — product adds instantly |
| Held sales | Use Hold for customers who need to step away |
| Exact cash | Use **Exact** button to set received = total |
| Unpublished products | Hide seasonal items without deleting |
| Business date | Override in Settings for testing reports |
| Dark mode | Toggle in sidebar footer |
| Overselling | POS allows sale even at zero stock (warning shown) |
| Bilingual receipts | Enable in Settings → Receipt |

---

## Appendix: Sidebar map

```
Dashboard
Sales
  ├── POS
  ├── Orders
  └── ZATCA Sync          (Phase 2)
Products
  ├── Products
  ├── Categories
  └── Units
Inventory
  └── Stock
Customers
Suppliers
  ├── Accounts
  └── Purchases
Accounting
  └── Expenses
Reports
Administration
  ├── Users
  ├── Settings
  ├── ZATCA Queue       (Phase 2)
  └── ZATCA Test Center (Phase 2)
```

---

*NexttelPOS v0.1.0 — For ZATCA setup details, see [ZATCA_GUIDE.md](ZATCA_GUIDE.md).*

# DukkanPOS — ZATCA Integration Guide

Guide for Saudi Arabia **ZATCA** (Zakat, Tax and Customs Authority) e-invoicing in DukkanPOS.

---

## Overview

DukkanPOS supports three ZATCA modes configured per store in **Settings → ZATCA**:

| Mode | What it does | API required |
|------|----------------|--------------|
| **Disabled** | No ZATCA features | No |
| **Phase 1** | Simplified tax invoice **QR code** on receipts | No |
| **Phase 2** | Phase 1 QR **plus** electronic invoice submission to ZATCA | Yes |

Each installation chooses **one mode** for the whole store. It is not per-customer.

---

## Phase 1 — QR on receipts

For businesses required to show a **simplified tax invoice QR** without live API submission.

### Requirements

- Store name (English)
- VAT registration number
- VAT % configured (default 15%)

### Setup steps

1. Go to **Settings → Store**
   - Enter **VAT registration number**
   - Enter **Store name** and address
2. Go to **Settings → ZATCA**
   - Set **Active integration** → **ZATCA Phase 1**
   - Save settings
3. Go to **Settings → Receipt**
   - Enable **Show QR on receipt**
   - Save and test with a sale

### What happens on each sale

1. Sale completes normally
2. A TLV-encoded QR is generated with seller name, VAT number, timestamp, total, and VAT amount
3. QR prints on the receipt (if enabled)

No invoice is sent to ZATCA. No certificate is required.

---

## Phase 2 — E-invoicing with sync

For businesses required to **report simplified tax invoices** to ZATCA electronically.

Phase 2 **includes all Phase 1 behavior** (QR prints immediately) **plus** local queuing and API sync.

### Requirements

Everything from Phase 1, plus:

- Device serial number (EGS)
- Private key (generated on device)
- Certificate (from ZATCA onboarding)
- Compliance CSID (sandbox/testing)
- Production CSID (live environment)
- Internet for sync (sales work offline)

### Environments

| Environment | Purpose |
|-------------|---------|
| **Sandbox** | ZATCA official testing API |
| **Simulation** | Local testing without real API |
| **Production** | Live ZATCA reporting |

### Setup steps (high level)

1. **Settings → Store** — complete VAT, CR, company details
2. **Settings → ZATCA**
   - Set **Active integration** → **ZATCA Phase 2**
   - Choose **Environment** (start with Sandbox)
   - Enter device ID / serial / EGS unit name
3. **Generate private key** — app auto-generates on first visit if missing
4. **Generate CSR** — click Generate CSR, copy base64 into ZATCA portal
5. **Compliance CSID** — complete ZATCA onboarding OTP flow; paste certificate and CSID
6. **Validate certificate** — run certificate check in settings
7. **Test connection** — verify internet, credentials, and certificate
8. **Onboarding wizard** — run step-by-step API tests (Settings → ZATCA or Test Center)
9. For production: obtain **Production CSID** after compliance passes
10. Switch environment to **Production** when ready

### What happens on each sale

1. Sale completes — **QR prints immediately** (same as Phase 1)
2. Invoice payload is built and **queued locally** (status: Pending)
3. Background worker or manual sync sends to ZATCA when online
4. On success: status → **Synced**; signed XML stored
5. On failure: status → **Failed**; retry from queue

**Sales never block on ZATCA** — checkout always works, even offline.

---

## ZATCA pages

### ZATCA Sync (Sales menu)

**Path:** Sales → ZATCA Sync

Daily operations page for cashiers and admins:

- View invoices needing sync (outstanding / today / all)
- Filter by status: Pending, Failed, Synced
- Sync one, selected, or all pending invoices
- Auto-sync toggle (background every ~45 seconds when online)
- Online/offline indicator

### ZATCA Queue (Administration)

**Path:** Administration → ZATCA Queue

Full queue management:

- All queued invoices with status badges
- Retry failed items
- Bulk sync selected
- View last sync time and queue statistics

### ZATCA Test Center (Administration)

**Path:** Administration → ZATCA Test Center

Step-by-step verification without affecting live sales:

- Run individual ZATCA API operations
- Test compliance and reporting flows
- Validate certificates and payloads
- Useful during initial onboarding

---

## Sync workflow

### Manual sync

1. Open **ZATCA Sync** or **ZATCA Queue**
2. Select pending/failed invoices
3. Click **Sync selected** or **Sync all**
4. Wait for success/failure indicators

### Auto sync

1. **Settings → ZATCA** — enable auto sync
2. App checks queue every ~45 seconds when online
3. Failed items retry with backoff (max 5 attempts)

### After sync

- **Orders** page shows ZATCA status per sale
- Download signed XML from order details (when synced)
- Receipt QR was already printed at sale time

---

## Receipt & QR settings

**Settings → Receipt:**

| Option | Effect |
|--------|--------|
| Show QR | Print ZATCA QR on receipt |
| Show bilingual | English + Arabic names |
| Show tax info | VAT breakdown lines |

QR content follows ZATCA Phase 1 TLV specification regardless of Phase 2 sync status.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No QR on receipt | Enable Phase 1 or 2; set VAT number and store name; enable Show QR |
| Phase 2 not queuing | Confirm Phase 2 selected and saved; complete a new sale |
| Sync fails | Check internet; validate certificate; verify CSID matches environment |
| Certificate expired | Re-run ZATCA onboarding; update certificate in Settings |
| Offline sales | Normal — queue syncs when connection returns |
| Wrong VAT on QR | Update VAT % in Settings → Store |

---

## Security notes

- Private keys and CSID tokens are stored **locally** on the device
- Sensitive fields are masked in Settings UI
- Backups include ZATCA credentials — **protect backup files**
- Each device should have its own key pair for production

---

## Architecture (for reference)

DukkanPOS uses a **module pattern**:

- `DisabledModule` — no ZATCA
- `Phase1Module` — QR generation only
- `Phase2Module` — extends Phase 1 + local queue + API sync

The active module is selected from `zatca_active_phase` in settings. The POS code calls one facade (`zatcaService`) so checkout logic stays the same across phases.

---

*For general app usage, see [USER_GUIDE.md](USER_GUIDE.md).*

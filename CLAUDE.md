# BOQ Management System - Project Documentation

## Overview
A construction project management application for tracking BOQ (Bill of Quantities), material receipts, inventory, expenses, supplier invoices, and material compliance documents. Multi-tenant SaaS — sold per-site to customer companies (e.g. EFC) by **Cogneta Automation**. Built with Next.js 16, React 19, Supabase, and Tailwind CSS.

## Tech Stack
- **Framework**: Next.js 16.1.1 (App Router)
- **UI**: React 19, Tailwind CSS 4, Shadcn UI components
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (for document uploads)
- **Auth**: Demo-grade bcrypt-against-`tenant_users` with permissive RLS (see Auth section)
- **Icons**: Lucide React
- **Excel**: `xlsx` (and `xlsx-js-style` for richly-formatted MIR Overview) — import + export
- **PDF**: jsPDF + jspdf-autotable for new PDFs; pdf-lib for merging existing PDFs into a single document
- **Charts**: Recharts
- **Forms**: React Hook Form
- **Notifications**: Sonner (toast)
- **bcrypt**: `bcryptjs` (browser-safe; used by `src/lib/auth.ts`)

## Project Structure
```
app/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout: AuthGate + AppShell
│   │   ├── page.tsx               # Module landing (X5-style grouped cards)
│   │   ├── login/                 # Login screen (no sidebar)
│   │   ├── dashboard/             # KPI dashboard (was at / pre-multi-tenant)
│   │   ├── sites/                 # Sites management (tenant-scoped + activation-code gate on new)
│   │   ├── boq/                   # BOQ Management
│   │   ├── boq-progress/          # BOQ Progress tracking
│   │   ├── boq-item-compliance/   # BOQ Item Compliance — per-line-item materials, TDS, test certs, MB/RA (manage)
│   │   ├── boq-item-overview/     # BOQ Item Overview — read-only per-line-item compliance & billing dashboard
│   │   ├── ra-billing/            # RA Billing
│   │   ├── workstations/          # Workstation progress tracking
│   │   ├── api/
│   │   │   └── boq-materials/recommend/  # POST route handler: AI material recommendation (Claude Sonnet + heuristic fallback)
│   │   ├── material-grn/          # GRN (with library-aware compliance slots + exports)
│   │   ├── inventory/             # Inventory view
│   │   ├── document-compliance/   # Documents Compliance module (per-material Test Cert / TDS)
│   │   ├── expenses/              # Expense recording
│   │   ├── expense-dashboard/     # Expense analytics
│   │   ├── supplier-invoices/     # Supplier invoice payments
│   │   ├── checklists/            # Checklist management
│   │   ├── reports/
│   │   │   └── mir/               # MIR Reports (PDF, library-aware)
│   │   ├── master-data/           # Master data
│   │   │   ├── workstations/
│   │   │   ├── materials/         # incl. Excel template/import/export + labelled delete
│   │   │   ├── equipment/
│   │   │   ├── suppliers/
│   │   │   ├── labour-contractors/
│   │   │   ├── manpower-categories/
│   │   │   └── manpower/
│   │   └── admin/                 # Tenant admin pages
│   │       ├── users/             # Per-tenant user + module-access CRUD (admin role)
│   │       ├── codes/             # Issue site activation codes (superuser only)
│   │       └── tenants/           # Create customer tenants (superuser only)
│   ├── components/
│   │   ├── auth/                  # AuthGate wrapper
│   │   ├── layout/                # Sidebar, Mobile Nav, Header, AppShell
│   │   └── ui/                    # Shadcn UI components
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client (anon key)
│   │   ├── auth.ts                # Login, session, role + module-access helpers
│   │   ├── modules.ts             # ModuleKey, MODULES, MODULE_GROUPS, moduleKeyForPath
│   │   ├── landing-backdrop.tsx   # Shared photo+SVG backdrop for /login + /
│   │   ├── materials-excel.ts     # Material List template/export/import parsing
│   │   ├── material-compliance.ts # Library helpers + effectiveDocStatus + docStatusYN
│   │   ├── material-compliance-pdf.ts  # Merge all uploaded compliance docs into one PDF
│   │   ├── excel-parser.ts        # BOQ Excel import parser (multi-format, customer-tolerant; exports parseBOQRows)
│   │   ├── boq-item-workflow.ts   # BOQ Item Compliance/Overview: queries, doc/RA helpers, GRN auto-add, keyword scorer
│   │   ├── upto-date.ts           # Shared "Upto Date" computation (JMR-approved else workstations)
│   │   ├── checklist-parser.ts    # Tolerant checklist Excel parser
│   │   ├── checklist-pdf.ts       # Checklist PDF generator
│   │   └── utils.ts               # Utility functions (cn)
│   └── types/
│       └── database.ts            # TypeScript types
├── public/
│   ├── landing-bg.png             # Backdrop photo for /login + /
│   └── (next.js stock SVGs)
├── scripts/                       # Node one-shots (run as `node scripts/foo.js` from app/)
│   ├── hash-seed-passwords.js     # Generates bcrypt hashes for the seed tenant_users rows
│   └── update-cogneta-name.js     # Template: data-only updates via anon key (RLS is permissive)
├── supabase/
│   ├── schema.sql                 # Main database schema
│   └── migrations/                # Database migrations (run manually in SQL Editor)
└── public/                        # Static assets
```

## Authentication & Multi-Tenancy

### Model
- **`tenants`** (migration 028) — one row per customer company. `company_code` is what users type at login (e.g. `Cogneta`, `EFC`); `company_name` is the display label shown on the landing header.
- **`tenant_users`** — per-tenant users with bcrypt-hashed passwords, role (`user` | `admin` | `superuser`), and `allowed_modules` (a `TEXT[]` of `ModuleKey` values).
- **`site_activation_codes`** — single-use codes issued by Cogneta when a customer pays for a site. Required on `/sites/new` for non-superuser tenants.
- **`sites.tenant_id`** — the only tenant-scoping column. Every existing site was backfilled to the Cogneta tenant. **`master_materials`, `material_compliance_documents`, and other master tables are shared across tenants.**

### Login flow
- 2 fields: **Company Code** + **Password**. Password identifies the user — `login()` in `src/lib/auth.ts` fetches every active user in the tenant and bcrypt-compares against each. There's no separate username field at login.
- Session is stored in `localStorage` under `boqm.session` with a 24-hour expiry. Contains `{ tenant_id, tenant_code, tenant_name, user_id, username, role, allowed_modules, expires_at }`.
- `AuthGate` (`src/components/auth/auth-gate.tsx`) wraps every page (via `app/layout.tsx`). Redirects to `/login` when no session; renders a friendly access-denied card when the user lacks the module's key in their `allowed_modules` (or the required role for `/admin/*`).

### Roles
- **`superuser`** (Cogneta only) — sees every module + every tenant's data; bypasses activation-code requirement on `/sites/new`; can manage tenants, activation codes, and any tenant's users.
- **`admin`** — can manage users + module access for their own tenant via `/admin/users`.
- **`user`** — module access controlled by `allowed_modules`.

### Seed
Migration 028 seeds:
- Tenant `Cogneta` / `Cogneta Automation`, user `Cogneta / Cogneta` (superuser, all modules).
- Tenant `EFC` / `EFC`, user `admin / admin` (admin, modules: dashboard, sites, admin-users).

bcrypt hashes are generated by `scripts/hash-seed-passwords.js` and inlined into the migration.

### Security caveat — pilot-only auth
All app tables use `FOR ALL USING (true)` RLS — anyone with the Supabase URL + anon key can read/write any row. The Supabase anon key is in the browser. Acceptable for a trusted EFC-style pilot; **not internet-safe**. A full Supabase-Auth + per-tenant RLS rewrite is the deferred Phase 2.

## Key Modules

### 1. Sites Management (`/sites`)
- Create and manage construction sites
- Track site status (active, completed, on_hold)
- Client name, location tracking

### 2. BOQ Management (`/boq`)
- Bill of Quantities with packages, headlines, line items
- Import from Excel
- Track materials per line item
- **Progress Tracking** (per line item):
  - **BOQ Qty**: Planned quantity from BOQ
  - **Upto Date**: Sum of all progress entries from Workstations (across all workstations)
  - **Remaining**: BOQ Qty - Upto Date
  - **Progress Bar**: Visual indicator with color coding
    - Red (0-25%): Behind schedule
    - Amber (25-75%): In progress
    - Green (75-100%): Near completion
    - Blue (>100%): Over-executed
- **Consumption History** (read-only):
  - Displays material consumption recorded from Workstations module
  - Shows material name, quantity, workstation name, date
  - No direct recording - consumption is managed via Workstations module

### 2b. RA Billing (`/ra-billing`)
- Extended BOQ view with billing columns (rate, amounts, GST, actuals)
- Site -> Package cascading selectors
- Summary cards: Total BOQ Amount, Total Actual Amount, Billing %, Items with Actuals
- **Two billing types** based on `packages.billing_type`:
  - **Standard**: 12 columns — S.No, Description, Location, Unit, Quantity, Rate, Total Amount, GST Amount, Total w/ GST, Actual Qty, Actual Amount, Actual Amt w/ GST
  - **Supply & Installation (S&I)**: 13 columns — S.No, Description, Unit, Qty Ext, Quantity, Supply Rate, Install Rate, Supply Amt, Install Amt, Actual Qty, Actual Supply, Actual Install, Actual Total
- Description column uses `max-w-[350px]` with `whitespace-normal break-words` to prevent horizontal scrollbar overflow on long descriptions
- Headline subtotals and grand total row (adapts to billing type)
- Export to Excel (adapts columns/headers to billing type)
- Data comes from columns on `boq_line_items`:
  - Standard: `rate`, `total_amount`, `gst_amount`, `total_amount_with_gst`, `actual_quantity`, `actual_amount`, `actual_amount_with_gst`
  - S&I: `qty_ext`, `supply_rate`, `installation_rate`, `supply_amount`, `installation_amount`, `actual_supply_amount`, `actual_installation_amount`, `actual_total_amount`
- **Excel Parser** (`src/lib/excel-parser.ts`): generalized, customer-tolerant, fully backward-compatible. The pure core is exported as `parseBOQRows(rows, sheetName, warnings)` (used by both the `File`-based `parseBOQExcel` and headless tests).
  - **Header detection** normalizes the S.No cell (`replace(/[\s.]/g,'')`) so `S.No` / `SL.NO` / **`SR. NO.`** all match. Sheets missing an item/qty header are skipped (`return null`).
  - **Dynamic keyword column mapping** for item / specification / location / unit / qty (handles an extra SPECIFICATION column and "FINAL QTY"), with a **legacy fixed-position fallback** (desc=1, loc=2, unit=3, qty=4) so old LA-format files still parse.
  - **Description composition**: `ITEM — SPECIFICATION/Product Description (Make: …)` folded into the single `description` (richest text for the AI material recommendation).
  - **S.No cleaning**: rounds float noise (`2.0199999999999996 → "2.02"`); whole-number rows with no measurable data = headline, with data = flat-list line item (collapsed under one synthetic headline, e.g. Sanitary Fitting); decimal rows = line items.
  - Billing type: S&I detected by SUPPLY/INSTALLATION header keywords; extended-standard by RATE/AMOUNT/GST/ACTUAL keywords. Column-offset + multi-row header merge retained. Letter sub-items (`7.a`), orphan/landscape sections, and total-row skipping all retained.
  - **Only the main BOQ tab is imported** — `parseBOQExcel` stops at the first BOQ-signature sheet, so supplementary tabs (OEM-Supply, Make List, etc.) in customer workbooks are ignored. `ParsedBOQ` carries `sheetName`; the upload page imports only the selected sheet (default first).

### 2c. BOQ Item Compliance & Overview (`/boq-item-compliance`, `/boq-item-overview`)
A per-BOQ-line-item workflow layered **read-only on the existing `boq_line_items`** (does not touch BOQ Management / RA Billing / BOQ Progress). New tables are `boqc_*` (migrations 030–033); all queries/helpers live in `src/lib/boq-item-workflow.ts`.

- **BOQ Item Compliance** (manage): cascading Site → Package → Headline → Line Item selector, then three stages:
  - **Materials** — `boqc_materials`. An **AI Recommend** button POSTs the line-item description + a keyword-filtered candidate set of `master_materials` to `/api/boq-materials/recommend`; the engineer reviews/edits/approves (`is_approved`). Materials can also be added manually or as free-text. `source` ∈ `ai | manual | ai_edited | grn`; a badge shows provenance.
  - **TDS & Test Certificates** — `boqc_documents` (per approved material, mirrors `material_compliance_documents` so `effectiveDocStatus` is reused). A test certificate uploaded against a **GRN line item linked to this BOQ line item** surfaces here automatically ("From GRN").
  - **MB Sheet & RA Billing** — `boqc_ra_entries`: RA1/RA2/RA3 with new/previous/up-to-date quantities (server-recomputed via `recomputeRaCumulatives`) and an attached MB-sheet Excel.
- **BOQ Item Overview** (read-only): per-line-item dashboard — materials identified/approved, TDS uploaded, test certs present (direct or GRN-sourced), RA count, up-to-date, remaining, billed %, with Excel export.
- **AI route** `src/app/api/boq-materials/recommend/route.ts` (Node runtime, deploys as a Netlify function): uses `@anthropic-ai/sdk`, model `claude-sonnet-4-6`, forced tool-use for structured JSON; validates returned `material_id`s against the candidate set; falls back to the keyword scorer (`heuristicRecommend`) when `ANTHROPIC_API_KEY` is missing/quota-hit. **Add `ANTHROPIC_API_KEY` to `.env.local` + the Netlify env** (build + functions); without it the feature degrades to keyword matching.
- **GRN integration**: when a GRN line item is saved with a BOQ line item linked, `ensureBoqcMaterialFromGrn()` auto-adds that material under BOQ Item Compliance (pending, `source='grn'`) — idempotent (`ignoreDuplicates` on `(boq_line_item_id, material_id)`, never overwrites an existing/approved row) and best-effort (never blocks the GRN save).

### 3. Material GRN (`/material-grn`)
- Invoice-based goods receipt notes
- Multiple materials per invoice
- **BOQ line item link (optional)**: each line item can be linked to a BOQ line item (`grn_line_items.boq_line_item_id`, migration 031) via a searchable selector scoped to the invoice's site. On save (both create + edit paths), the received material is auto-added to BOQ Item Compliance for that line item (`ensureBoqcMaterialFromGrn`, see §2c), and the BOQ number appears on the MIR Overview Excel + per-MIR PDF.
- **Invoice Date** and **GRN Date** tracking (separate fields)
- Document uploads:
  - **Invoice level**: DC (Delivery Challan)
  - **Line item level**: Test Certificate, TDS (MIR removed)
- Supplier selection from master data
- GST calculation (5%, 12%, 18%)
- **Compliance Tracking**:
  - Invoice-level: DC document (counted in invoice totals)
  - Line item-level: Test Cert + TDS per material (2 docs each)
  - Auto-creates document placeholders for imported data on first access
- **Two-way sync with Documents Compliance module** (since migration 029):
  - On page load, `fetchMaterialComplianceMap(materialIds)` builds a `Map<material_id, { test_certificate?, tds? }>` from the material-level library and stores it in component state.
  - Line-item doc slots that have no per-invoice file fall back to the library state — they render `From compliance library: <filename>` with a clickable view link instead of the "Pending" warning.
  - When a user uploads at the GRN line-item level, `seedMaterialComplianceFromGrn()` populates the library row **only if its current status is `pending`** (i.e., the very first upload for that material seeds the library; subsequent uploads stay as per-invoice overrides).
  - Library `not_applicable` propagates to line-item slot rendering as `N/A from compliance library`.
- **Effective doc status helper**: `effectiveDocStatus(doc, libSlot)` in `src/lib/material-compliance.ts` unifies the rule across **badges, Standard GRN Excel, MIR Overview Excel, and MIR Reports PDF**. Returns `'uploaded' | 'na' | 'pending'`; uploads always win over NA. `docStatusYN()` adapts that to `'Y' | 'N' | 'NA'` for the export columns. **Always use this helper rather than open-coding the rule** — bugs have been re-introduced twice when call sites diverged.
  - The local adapter inside `src/app/material-grn/page.tsx` is `effectiveStatusFor(li, doc)` — it looks up the library slot via `complianceLibrary.get(li.material_id)?.[doc.document_type]` and delegates to `effectiveDocStatus`.
- The MIR doc-type and the invoice-level DC are **not** library-tracked and keep their original per-invoice semantics.
- **Export Reports**:
  - **Export Report**: Standard GRN report with all details. Test Cert / TDS columns are library-aware via `effectiveStatusFor`.
  - **MIR Overview**: Styled Excel export (via `xlsx-js-style`) with materials grouped by GRN date
    - Title row "MATERIAL INSPECTION REPORT" and site info row at top
    - MIR references (MIR 1, MIR 2, etc.) based on unique GRN dates, ascending by date (MIR 1 = earliest)
    - Column order is descending (latest date first), but MIR numbers are ascending by date
    - **BOQ Item** column (after Unit) — the linked BOQ line item number; `exportMIROverview` maps `grn_line_items.boq_line_item_id` → `boq_line_items.item_number`
    - Quantity distribution across dates
    - Compliance status (Y/N/NA) for DC, Test Cert, TDS — Test Cert / TDS are library-aware
    - Styled with header colors, borders, invoice grouping borders

### 3b. Documents Compliance (`/document-compliance`)
- Per-material master library of Test Certificate + TDS documents. Separate from the per-invoice docs in `grn_line_item_documents`.
- Table grouped by category. Each material row has two status cells (Test Cert | TDS), each in one of three states:
  - **Uploaded** — green badge + filename, with `View` (signed URL → new tab), `Replace`, and a revert-to-pending button.
  - **Pending** — slate badge + `Upload` button (file picker), plus `Mark N/A` link.
  - **Not applicable** — amber badge + `Mark pending` link to re-enable uploads.
- **Add materials** dialog: searchable multi-select against the list of materials not yet enrolled. Confirming creates 2 rows per material (one per doc type) at `status='pending'` via `enrolMaterials()`.
- **Export all as PDF**: builds a single merged PDF (`src/lib/material-compliance-pdf.ts`). Cover page + per-material section header + the actual document. PDFs are merged via `pdf-lib.copyPages()`. PNG / JPG are embedded as scaled pages via `embedPng` / `embedJpg`. Other formats (doc/docx/xls/xlsx) get a placeholder page. Same merge pattern as the MIR Reports PDF.
- **Storage path**: `compliance-docs/material-compliance/{material_id}/{doc_type}_{timestamp}.{ext}`. Lives alongside the existing `compliance-docs/grn_invoice/...` and `compliance-docs/grn_line_item/...` prefixes — no collisions.
- **Compliance docs are shared across tenants** today (no `tenant_id` on `material_compliance_documents`) — matches the master data model.

### 4. Inventory (`/inventory`)
- Aggregated material stock from GRN entries
- Track received vs consumed quantities
- Category-wise grouping

### 5. Expenses Recording (`/expenses`)
- **Material Tab**: Auto-fetched from Material GRN module by date (read-only)
  - Shows invoice numbers, suppliers, line items with amounts
  - Displays GST breakdown and totals
- **Manpower Tab**: Record manpower expenses with:
  - Cascading dropdowns: Contractor → Category → Gender
  - Number of persons, start time, end time
  - Auto-calculated hours and amount (hourly rate × hours × persons)
  - Remarks field for worker names
- **Equipment Tab**: Record equipment expenses with:
  - Cascading dropdowns: Supplier → Equipment (filtered by supplier)
  - Hours input with auto-calculated amount (hourly rate × hours)
  - Rate info displays daily rate and calculated hourly rate
  - Falls back to master_equipment hourly_rate if no rates defined
- **Other Tab**: Miscellaneous expenses
- **Export to Excel**: Daily expense report with all categories
  - Summary sheet with totals
  - Detailed sheets for each category (includes supplier for equipment)

### 6. Expense Dashboard (`/expense-dashboard`)
- Charts and analytics for expenses
- **Data Sources**:
  - **Material**: Fetched from `grn_invoices` + `grn_line_items` (using `grn_date`)
  - **Manpower/Equipment/Other**: Fetched from respective expense tables
- **Date range filtering**:
  - Preset options: Last 7/14/30/60/90 Days
  - **Custom date range**: From/To date selection for any period
- Category-wise breakdown (Material, Manpower, Equipment, Other)
- Last 7 days bar chart with daily totals

### 7. Supplier Invoices (`/supplier-invoices`)
- Consolidated view of supplier invoices from GRN
- Payment tracking with status (Pending, Partial, Paid)
- Features:
  - Site selection
  - Supplier summary cards with counts and amounts
  - Invoice detail view with DC document access
  - Payment confirmation with date, amount, reference
  - Partial payment support with balance tracking
  - Export to Excel with all payment details

### 8. Checklists (`/checklists`)
- Activity checklists per BOQ headline
- Status tracking (pending, in_progress, completed)

### 9. Reports (`/reports`)
Reports module with expandable submenu:
- **Overview** (`/reports`): General reports dashboard (under construction)
- **MIR Reports** (`/reports/mir`): Individual Material Inspection Reports
  - Site selector dropdown
  - MIR selector dropdown (format: "MIR 1 - 22 Jan 2026"), ascending date order (MIR 1 = earliest date)
  - Preview table showing materials for selected MIR
  - PDF download with:
    - Header: Site name, MIR reference, date
    - Table: S.No, Invoice No., Material, Qty, Unit, **BOQ Item** (linked line item number), DC, Test Cert, TDS
    - Footer: Signature sections (Prepared by / Approved by)

### 10. Workstation Management (`/workstations`)
- Track work progress at physical workstations (HT ROOM, ELE ROOM, FENCING, etc.)
- **Primary source for material consumption** - consumption recorded here appears in BOQ Management
- Features:
  - Site selector dropdown
  - Assign workstations to sites from master list
  - Workstation cards grid view (clickable)
  - Detail view with BOQ progress summary table:
    - Previous quantity (sum of all entries except latest)
    - New quantity (latest entry)
    - Upto-Date quantity (cumulative total)
  - Grand total display
  - Progress entries collapsible by date
  - Add/Edit progress dialog with:
    - Date picker
    - Cascading dropdowns: Headline → Line Item
    - Context display (unit, previous qty, BOQ qty)
    - Quantity input (optional - can record material-only entries)
    - Material consumption tracking with searchable dropdown
- Master Data (`/master-data/workstations`):
  - 29 predefined workstations seeded
  - Add/Edit/Delete workstation types

### 11. Master Data (`/master-data/*`)
- **Workstations** (`/master-data/workstations`): Workstation name, description
- **Materials** (`/master-data/materials`): Category, name, unit, description.
  - Page header has four buttons: **Template** (download an empty-but-headered .xlsx with example rows), **Import** (drag-drop or browse → preview dialog showing per-row action: New / Update / Restore / Skip — counts in summary tiles), **Export** (full active list, sorted Category → Name), **+ Add Material**.
  - Import matches existing rows on `(category, name)` case-insensitive. A match against a soft-deleted row reactivates it (handy for restoring deletions).
  - Inserts go in batches of 500 to stay under Supabase payload limits. Updates loop per-row because `supabase.update()` doesn't accept array payloads.
  - Helpers live in `src/lib/materials-excel.ts`: `parseMaterialsExcel`, `exportMaterialsXlsx`, `downloadMaterialsTemplate`. Header detection scans the first 10 rows for a row containing Category / Name / Unit in any column order — tolerates user re-arranging columns.
  - **Edit / Delete action buttons are labelled outline buttons**, not icon-only — see [[subtle-styles-and-labelled-buttons]] memory. Delete uses a shadcn `Dialog` for confirmation (not native `window.confirm`); soft-delete (`is_active = false`) — FK references in GRN line items and workstation consumption are preserved.
- **Suppliers** (`/master-data/suppliers`): Name, GSTIN, address, contact
- **Equipment Types** (`/master-data/equipment-types`): Equipment type names (JCB, Roller, Crane, etc.)
- **Equipment Rates** (`/master-data/equipment`):
  - Links supplier + equipment type
  - Daily rate, daily hours
  - Auto-calculated hourly rate displayed
  - Similar pattern to Manpower Rates
- **Labour Contractors** (`/master-data/labour-contractors`):
  - Contractor name, contact person, contact number, address
- **Manpower Categories** (`/master-data/manpower-categories`):
  - Category name (Mason, Helper, Carpenter, etc.), description
- **Manpower Rates** (`/master-data/manpower`):
  - Links contractor + category + gender
  - Daily rate, daily hours
  - Auto-calculated hourly rate displayed

## Database Tables

### Multi-Tenancy Tables (migration 028)
- `tenants` - customer companies (`company_code` typed at login, `company_name` shown on landing)
- `tenant_users` - per-tenant users with bcrypt `password_hash`, `role` (user/admin/superuser), `allowed_modules` TEXT[]
- `site_activation_codes` - single-use codes, FK to tenants, unique `code`, `used_at` + `used_by_site_id` consumed on /sites/new

### Core Tables
- `sites` - Construction sites
  - `tenant_id` (migration 028, NOT NULL after backfill) — every site belongs to exactly one tenant
- `packages` - BOQ packages per site (has `billing_type`: 'standard' | 'supply_installation')
- `boq_headlines` - BOQ section headers
- `boq_line_items` - BOQ line items
- `materials` - Materials per line item

### Compliance Tables (migration 029)
- `material_compliance_documents` - master compliance docs per material
  - Unique on `(material_id, doc_type)` where `doc_type ∈ ('test_certificate', 'tds')`
  - `status`: `'pending' | 'uploaded' | 'not_applicable'` (CHECK constrained)
  - `file_path`, `file_name`, `uploaded_at`, `uploaded_by`
  - Trigger `trg_material_compliance_updated_at` bumps `updated_at` on every UPDATE

### BOQ Item Compliance Tables (migrations 030–033)
Per-BOQ-line-item workflow (module §2c). Reached via `boq_line_items` (no `tenant_id` — tenancy flows through `packages.site_id → sites.tenant_id`). Permissive RLS + `update_updated_at_column()` triggers.
- `boqc_materials` - approved/identified materials per line item
  - `boq_line_item_id` (FK), `material_id` (nullable FK — null = free-text), denormalized `material_name`/`unit`, `estimated_quantity`
  - `source`: `'ai' | 'manual' | 'ai_edited' | 'grn'` (migration 033 added `'grn'`), `is_approved`, `shared_with_vendor_at`
  - **UNIQUE (boq_line_item_id, material_id)** — the conflict key for the idempotent GRN auto-add
- `boqc_documents` - TDS + Test Cert per `boqc_materials` row (mirrors `material_compliance_documents`; UNIQUE (boqc_material_id, doc_type)); files at `boq-item-compliance/{boqc_material_id}/{doc_type}_{ts}.{ext}`
- `boqc_ra_entries` - RA billing per line item: `ra_number`, `new_quantity` (only user-entered), server-recomputed `previous_quantity`/`upto_date_quantity`, `mb_sheet_file_path`; UNIQUE (boq_line_item_id, ra_number)

### GRN Tables (Invoice-based)
- `grn_invoices` - GRN invoice headers
  - site_id, supplier_id, invoice_number
  - invoice_date (actual invoice date), grn_date (GRN receipt date)
- `grn_line_items` - Materials per invoice
  - material_id, material_name, quantity, unit, rate, gst_rate
  - amount_without_gst, amount_with_gst (stored values, not computed)
  - `boq_line_item_id` (migration 031, nullable FK to `boq_line_items`, `ON DELETE SET NULL`) — optional link; drives the BOQ Item Compliance auto-add + the BOQ Item column on MIR reports
  - Note: Amounts are stored directly from Excel to preserve discounts
- `grn_invoice_dc` - Delivery challan documents (invoice-level)
- `grn_line_item_documents` - Test Cert, TDS per material (MIR removed from UI)

### Master Data Tables
- `master_materials` - Material master list
- `suppliers` - Supplier master list
- `master_equipment` - Equipment master (name, hourly_rate)
- `master_labour_contractors` - Labour contractors (name, contact_person, contact_number, address)
- `master_manpower_categories` - Manpower categories (name, description)
- `master_manpower` - Manpower rates
  - contractor_id (FK to master_labour_contractors)
  - category_id (FK to master_manpower_categories)
  - gender (male, female, any)
  - rate (daily rate)
  - daily_hours
- `master_equipment_rates` - Equipment rates (similar to manpower)
  - supplier_id (FK to suppliers)
  - equipment_id (FK to master_equipment)
  - rate (daily rate)
  - daily_hours

### Expense Tables
- `expense_manpower` - Manpower expenses
  - contractor_name, manpower_category, gender
  - num_persons, start_time, end_time
  - hours, rate (hourly), amount
  - notes (for worker names)
- `expense_equipment` - Equipment expenses
  - supplier_id, supplier_name (FK to suppliers)
  - equipment_id, equipment_name, hours, rate, amount
- `expense_other` - Other expenses

### Payment Tables
- `supplier_invoice_payments` - Payment tracking for supplier invoices
  - Supports: pending, partial, paid status
  - Tracks: payment_amount, payment_reference, paid_at, notes

### Workstation Tables
- `master_workstations` - Workstation types (name, description, is_active)
  - 29 predefined workstations seeded (HT ROOM, ELE ROOM, FENCING, etc.)
- `site_workstations` - Workstations assigned to sites
  - site_id, workstation_id, is_active
  - Unique constraint on (site_id, workstation_id)
- `workstation_boq_progress` - Progress tracking per workstation
  - site_workstation_id, boq_line_item_id, entry_date, quantity, notes
- `workstation_material_consumption` - Material usage per progress entry
  - workstation_boq_progress_id, material_id, material_name, quantity, unit
  - **Source of truth for BOQ line item consumption history**

### Data Flow: Workstation → BOQ

```
Workstations Module (/workstations)
    ↓ Records progress entries (quantity) + material consumption
    ↓
┌─────────────────────────────────────────────────────────────┐
│ workstation_boq_progress table                              │
│   - boq_line_item_id, quantity, entry_date                  │
│                                                             │
│ workstation_material_consumption table                      │
│   - material_name, quantity, unit                           │
└─────────────────────────────────────────────────────────────┘
    ↓
BOQ Management (/boq/[id]) reads:
    1. Progress: SUM(quantity) from workstation_boq_progress → "Upto Date"
    2. Consumption: workstation_material_consumption → "Consumption History"
```

## Supabase Storage Buckets
- `compliance-docs` - GRN documents (DC, MIR, Test Cert, TDS)

## Common Patterns

### Page Structure
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function PageName() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
      if (error) throw error
      setData(data || [])
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Page Title" />
      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Content */}
      </div>
    </div>
  )
}
```

### Data Fetching with Joins
```typescript
const { data, error } = await supabase
  .from('grn_invoices')
  .select(`
    *,
    supplier:suppliers(id, supplier_name, gstin)
  `)
  .eq('site_id', selectedSiteId)

// Note: Supabase returns joined relations as arrays
// Transform to single object if needed:
const transformedData = (data || []).map((item: any) => ({
  ...item,
  supplier: Array.isArray(item.supplier) ? item.supplier[0] : item.supplier
}))
```

### Cascading Lookups (Manpower Example)
```typescript
// Fetch with joins
const { data } = await supabase
  .from('master_manpower')
  .select(`
    *,
    labour_contractor:master_labour_contractors(id, name),
    manpower_category:master_manpower_categories(id, name)
  `)
  .eq('is_active', true)

// Filter categories by contractor
function getCategoriesForContractor(contractorId: string) {
  const categoryIds = manpowerList
    .filter(m => m.contractor_id === contractorId)
    .map(m => m.category_id)
  return manpowerCategories.filter(c => categoryIds.includes(c.id))
}
```

### File Upload to Storage
```typescript
const { error } = await supabase.storage
  .from('compliance-docs')
  .upload(filePath, file)
```

### View Uploaded File (Signed URL for private bucket)
```typescript
const { data } = await supabase.storage
  .from('compliance-docs')
  .createSignedUrl(filePath, 3600) // 1 hour expiry
window.open(data.signedUrl, '_blank')
```

### Tenant-scoping a Supabase query
```typescript
import { getSession, isSuperuser } from '@/lib/auth'

const session = getSession()
let query = supabase.from('sites').select('*').order('created_at', { ascending: false })

// Non-superuser tenants see only their own sites.
// `master_materials`, `material_compliance_documents` etc. are NOT tenant-scoped today —
// don't add tenant filters to them; users expect to see the shared list.
if (session && !isSuperuser(session)) {
  query = query.eq('tenant_id', session.tenant_id)
}
const { data, error } = await query
```

### Effective compliance status (library + per-line-item)
```typescript
import { effectiveDocStatus, docStatusYN, fetchMaterialComplianceMap } from '@/lib/material-compliance'

// Fetch once for a list of line items
const map = await fetchMaterialComplianceMap(materialIds)

// Per-doc derivation — use this everywhere you display or export a Test Cert / TDS status
const libSlot = map.get(li.material_id)?.[doc.document_type as 'test_certificate' | 'tds']
const effective = effectiveDocStatus(doc, libSlot) // 'uploaded' | 'na' | 'pending'
const yn = docStatusYN(effective)                  // 'Y' | 'N' | 'NA'
```

### Excel Export
```typescript
import * as XLSX from 'xlsx'

function exportToExcel() {
  const wb = XLSX.utils.book_new()

  // Create sheet from array of arrays
  const data = [['Header1', 'Header2'], ['Row1Col1', 'Row1Col2']]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }] // Column widths

  XLSX.utils.book_append_sheet(wb, ws, 'SheetName')
  XLSX.writeFile(wb, 'filename.xlsx')
}
```

### PDF Generation
```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function generatePDF() {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Report Title', 105, 20, { align: 'center' })

  // Subtitle/Info
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Site: Site Name', 14, 35)

  // Table with autoTable
  autoTable(doc, {
    startY: 50,
    head: [['S.No', 'Description', 'Value']],
    body: [
      [1, 'Item 1', '100'],
      [2, 'Item 2', '200'],
    ],
    headStyles: { fillColor: [51, 65, 85] }, // slate-700
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 30, halign: 'right' },
    }
  })

  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 20

  // Signature section
  doc.text('Prepared by: _______________', 14, finalY)
  doc.text('Approved by: _______________', 120, finalY)

  doc.save('report.pdf')
}
```

## Navigation
Navigation items are defined in:
- `src/components/layout/sidebar.tsx` - Desktop sidebar
- `src/components/layout/mobile-nav.tsx` - Mobile navigation

Both filter by `session.allowed_modules` (or pass-through for `superuser`) so users only see items they can actually open.

Main navigation items (in order):
- Home (`/` — module landing), Dashboard, Sites, BOQ Management, BOQ Progress, **BOQ Item Compliance**, **BOQ Item Overview**, RA Billing, Workstations, Material GRN, **Documents Compliance**, Inventory, Expenses Recording, Expense Dashboard, Supplier Invoices, Checklists

Reports submenu items (expandable group):
- Overview, MIR Reports

Master Data submenu items (expandable group):
- Workstations, Material List, Equipment Types, Equipment Rates, Labour Contractors, Manpower Categories, Manpower Rates, Suppliers

Admin section (gated by role, shown at the bottom of the sidebar):
- Manage Users (admin or superuser), Activation Codes (superuser only), Tenants (superuser only)

To add a new page:
1. Create page in `src/app/[page-name]/page.tsx`. The page renders inside `AuthGate` automatically via the root layout — no need to add an auth check.
2. Add a `ModuleKey` value + a `MODULES` entry + group membership in `src/lib/modules.ts`. The landing page, sidebar, mobile-nav, and `AuthGate` all consume this list. If the page is under `/admin/*` and role-gated, set `requires: 'admin' | 'superuser'`.
3. Add navigation entries to both `sidebar.tsx` and `mobile-nav.tsx` (matching `moduleKey`).
4. Add the new path to `moduleKeyForPath()` in `modules.ts` so `AuthGate` can resolve route → module.
5. Import required icon from lucide-react.

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
# Server-side only (NOT NEXT_PUBLIC). Powers the AI material recommendation route.
# Also add it to the Netlify environment (build + functions). Absent → keyword-match fallback.
ANTHROPIC_API_KEY=sk-ant-...
```

## Running Migrations
Migrations are in `supabase/migrations/`. Run them in Supabase SQL Editor in order.

Key migrations:
- `011_expenses.sql` - Base expense tables
- `014_grn_restructure.sql` - Invoice-based GRN structure
- `015_supplier_invoice_payments.sql` - Payment tracking
- `017_manpower_master_update.sql` - Manpower fields (rate, daily_hours, gender)
- `018_expense_manpower_update.sql` - Manpower expense time tracking fields
- `019_labour_contractors_and_categories.sql` - Labour contractors and categories tables
- `020_workstation_management.sql` - Workstation tables and 29 predefined workstations
- `021_grn_line_items_fix.sql` - Convert GRN amount columns from computed to stored values
- `022_grn_invoice_date.sql` - Add invoice_date column to grn_invoices
- `023_equipment_rates.sql` - Equipment rates table (supplier + equipment + rate), add supplier columns to expense_equipment
- `024_ra_billing_columns.sql` - Add 7 RA Billing columns to boq_line_items (rate, total_amount, gst_amount, total_amount_with_gst, actual_quantity, actual_amount, actual_amount_with_gst)
- `025_supply_installation_support.sql` - Add `billing_type` to packages, add 8 S&I columns to boq_line_items (qty_ext, supply_rate, installation_rate, supply_amount, installation_amount, actual_supply_amount, actual_installation_amount, actual_total_amount)
- `028_multi_tenant.sql` - Multi-tenancy: tenants, tenant_users (bcrypt), site_activation_codes, sites.tenant_id (backfilled to Cogneta). Seeds `Cogneta/Cogneta` (superuser) + `EFC/admin` (admin). Bcrypt hashes generated by `scripts/hash-seed-passwords.js` and inlined in the migration.
- `029_material_compliance.sql` - `material_compliance_documents` table + `updated_at` trigger; underpins the Documents Compliance module + the two-way sync with Material GRN.
- `030_boq_item_workflow.sql` - `boqc_materials` / `boqc_documents` / `boqc_ra_entries` (BOQ Item Compliance/Overview, module §2c) with permissive RLS + `updated_at` triggers.
- `031_grn_boq_line_item_link.sql` - add `grn_line_items.boq_line_item_id` (nullable FK, `ON DELETE SET NULL`) + index.
- `032_grant_boq_item_modules.sql` - grant `boq-item-compliance` + `boq-item-overview` to any `tenant_users` row that already has `boq` (superusers auto-see all).
- `033_boqc_source_grn.sql` - extend `boqc_materials.source` CHECK to allow `'grn'` (GRN auto-add provenance).

## Import/Utility Scripts

Two categories — one-off data imports live at `app/*.js`, the newer auth/data-update helpers live at `app/scripts/*.js`.

### `scripts/hash-seed-passwords.js`
Generates the bcrypt hashes used by migration 028's seed `INSERT INTO tenant_users`. Run once before applying the migration in Supabase SQL Editor; paste the printed `INSERT` block into the migration where indicated (already done for the shipped pilot — the hashes are inlined).

### `scripts/update-cogneta-name.js`
Template for **one-shot data updates** (non-DDL) via the anon key. Hand-parses `.env.local`, creates a Supabase client, runs a single UPDATE. Works because RLS is permissive — see the auth caveat. Copy this script and edit the query when you need to flip values in production data without asking the user to paste SQL. Don't use for schema changes (DDL still goes via Supabase SQL Editor).

### `import-data.js`
Import materials and suppliers from Excel to master data.
```bash
node import-data.js
```
- Reads from `../Materials and Suppliers.xlsx`
- Imports to `master_materials` and `suppliers` tables
- Handles duplicate detection

### `import-grn.js`
Import GRN invoices and line items from Excel.
```bash
node import-grn.js
```
- Reads from consolidated invoice Excel file
- Creates `grn_invoices` and `grn_line_items` entries
- Uses exact Rate, Amount (no GST), Amount with GST from Excel
- Excel columns: Invoice no., Supplier, Invoice Amount, Date, Material, Qty, Unit, Rate, Amount, Amount with GST

### `upload-invoices.js`
Upload invoice PDF documents to Supabase Storage (TCS-Vizag).
```bash
node upload-invoices.js
```
- Reads PDF files from invoice folder
- Matches filenames to invoice numbers (handles various formats)
- Uploads to `compliance-docs` bucket
- Creates/updates `grn_invoice_dc` records

### `upload-invoices-visakhapatnam.js`
Upload invoice PDF documents for TCS-Visakhapatnam site.
```bash
node upload-invoices-visakhapatnam.js
```
- Reads 142 PDFs from `../Invoices/11 Mar Invoices/Consolidated Invoices`
- Hardcoded site ID `a8ef40c8-18fe-4b7f-a352-4279f4bbd9d1`
- Normalized matching (strip non-alphanumeric, case-insensitive)
- Uploads to `compliance-docs` bucket at `grn-invoices/{siteId}/{invoiceId}/{filename}`
- Creates/updates `grn_invoice_dc` records

## Development
```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

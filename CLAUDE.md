# BOQ Management System - Project Documentation

## Overview
A construction project management application for tracking BOQ (Bill of Quantities), material receipts, inventory, expenses, and supplier invoices. Built with Next.js 16, React 19, Supabase, and Tailwind CSS.

## Tech Stack
- **Framework**: Next.js 16.1.1 (App Router)
- **UI**: React 19, Tailwind CSS 4, Shadcn UI components
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (for document uploads)
- **Icons**: Lucide React
- **Excel**: xlsx library for import/export
- **PDF**: jsPDF with jspdf-autotable for PDF generation
- **Charts**: Recharts
- **Forms**: React Hook Form
- **Notifications**: Sonner (toast)

## Project Structure
```
app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with Sidebar
│   │   ├── page.tsx            # Dashboard
│   │   ├── sites/              # Sites management
│   │   ├── boq/                # BOQ Management
│   │   ├── boq-progress/       # BOQ Progress tracking
│   │   ├── ra-billing/         # RA Billing (extended BOQ with rates/actuals)
│   │   ├── workstations/       # Workstation progress tracking
│   │   ├── material-grn/       # GRN (Goods Receipt Note)
│   │   ├── inventory/          # Inventory view
│   │   ├── expenses/           # Expense recording
│   │   ├── expense-dashboard/  # Expense analytics
│   │   ├── supplier-invoices/  # Supplier invoice payments
│   │   ├── checklists/         # Checklist management
│   │   ├── reports/            # Reports
│   │   │   └── mir/            # MIR Reports (PDF generation)
│   │   └── master-data/        # Master data
│   │       ├── workstations/   # Workstation types
│   │       ├── materials/      # Material master list
│   │       ├── equipment/      # Equipment master
│   │       ├── suppliers/      # Supplier master
│   │       ├── labour-contractors/   # Labour contractors
│   │       ├── manpower-categories/  # Manpower categories
│   │       └── manpower/       # Manpower rates
│   ├── components/
│   │   ├── layout/             # Sidebar, Mobile Nav, Header
│   │   └── ui/                 # Shadcn UI components
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── excel-parser.ts     # BOQ Excel import parser (multi-format)
│   │   ├── upto-date.ts        # Shared "Upto Date" computation (JMR-approved else workstation sum)
│   │   ├── checklist-parser.ts # Tolerant checklist Excel parser (handles 4 layout variants)
│   │   ├── checklist-pdf.ts    # Professional PDF generator for checklist submissions
│   │   └── utils.ts            # Utility functions (cn)
│   └── types/
│       └── database.ts         # TypeScript types
├── supabase/
│   ├── schema.sql              # Main database schema
│   └── migrations/             # Database migrations
└── public/                     # Static assets
```

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
  - **Upto Date**: JMR-driven with workstation fallback (since PR #3, computed via shared `lib/upto-date.ts`):
    - If at least one JMR with `status='approved'` exists for the line item → sum of `boq_jmr.approved_quantity` across those JMRs
    - Else → sum of `workstation_boq_progress.quantity` for that line item
  - **Remaining**: BOQ Qty - Upto Date
  - **Progress Bar**: Visual indicator with color coding
    - Red (0-25%): Behind schedule
    - Amber (25-75%): In progress
    - Green (75-100%): Near completion
    - Blue (>100%): Over-executed
- **JMR Tab**: per-line-item JMRs with status (draft/submitted/approved/disputed); approved JMRs flow into Upto Date
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
- **Site Summary card** at top of page (since PR #1) — shows Package | BOQ amount | Actual amount | Actual with GST per package + Total row, aggregated across all packages on the selected site
- **Actual source toggle** per package (since PR #4, column `packages.actual_source`):
  - `'execution'` (default): Actual Qty = Upto Date from BOQ Management; Actual Amt = Upto Date × rate; Actual w/ GST applies the line's GST percentage (`gst_amount / total_amount`); for S&I = `uptoDate × supply_rate + uptoDate × installation_rate`
  - `'template'`: stored Excel-template values (`actual_*` columns)
  - The toggle is a `Select` next to the site/package filters; on change it `update`s `packages.actual_source` and refetches
- **Export buttons**:
  - **Excel** — adapts columns to billing type
  - **PDF** (since PR #7) — landscape A4 via jsPDF + jspdf-autotable: dark slate header band + generated date, light info bar with site/package/billing type/source, 4 rounded summary cards, headline-grouped table (light-blue headline rows, slate subtotals, dark grand total), page footer "Page X of Y | Site - Package", signature block "Prepared by / Approved by"
  - Both exports are WYSIWYG with the actual source toggle
- Data comes from columns on `boq_line_items`:
  - Standard: `rate`, `total_amount`, `gst_amount`, `total_amount_with_gst`, `actual_quantity`, `actual_amount`, `actual_amount_with_gst`
  - S&I: `qty_ext`, `supply_rate`, `installation_rate`, `supply_amount`, `installation_amount`, `actual_supply_amount`, `actual_installation_amount`, `actual_total_amount`
- **Excel Parser** (`src/lib/excel-parser.ts`):
  - Detects billing type: S&I templates detected by SUPPLY/INSTALLATION header keywords
  - Detects extended 12-column template dynamically by scanning header keywords (RATE, AMOUNT, GST, ACTUAL)
  - Supports column offset detection (S.No may be in column A or B)
  - Supports multi-row headers (merges header row + continuation row)
  - Handles three BOQ Excel formats:
    - **Standard** (LA CIVIL WORK): Whole-number S.No = headline, decimal S.No (1.1, 1.2) = line items
    - **Letter sub-items** (LA PLANTATION): Letter-based S.No like "7.a", "7.b" = line items under parent headline
    - **Landscape** (LA LANDSCAPE): Headline rows have S.No but no data; actual data rows have **no S.No** — parser attaches these to the current headline
  - Rows without S.No: if a headline is active, attached as line items; otherwise grouped into orphan sections (e.g., "NT ITEMS", "Miscellaneous")
  - Total rows (description or S.No contains "total") are skipped and close the current headline
  - Orphan sections get auto-generated headline numbers after the last real headline

### 3. Material GRN (`/material-grn`)
- Invoice-based goods receipt notes
- Multiple materials per invoice
- **Invoice Date** and **GRN Date** tracking (separate fields)
- Document uploads:
  - **Invoice level**: DC (Delivery Challan)
  - **Line item level**: Test Certificate, TDS (MIR removed)
- Supplier selection from master data
- GST calculation (5%, 12%, 18%)
- **Important** (since PR #2): the form's two `.insert()` calls into `grn_line_items` compute and persist `amount_without_gst = qty × rate` and `amount_with_gst = amount_without_gst × (1 + gst/100)`. Migration 021 made these stored (not computed) columns to preserve discount-adjusted amounts from Excel imports; the form must always set them, otherwise list views render `₹0`. Pre-PR-#2 rows can be refreshed by re-saving them in the Edit dialog.
- **Compliance Tracking**:
  - Invoice-level: DC document (counted in invoice totals)
  - Line item-level: Test Cert + TDS per material (2 docs each)
  - Auto-creates document placeholders for imported data on first access
- **Export Reports**:
  - **Export Report**: Standard GRN report with all details
  - **MIR Overview**: Styled Excel export (via `xlsx-js-style`) with materials grouped by GRN date
    - Title row "MATERIAL INSPECTION REPORT" and site info row at top
    - MIR references (MIR 1, MIR 2, etc.) based on unique GRN dates, ascending by date (MIR 1 = earliest)
    - Column order is descending (latest date first), but MIR numbers are ascending by date
    - Quantity distribution across dates
    - Compliance status (Y/N/NA) for DC, Test Cert, TDS
    - Styled with header colors, borders, invoice grouping borders

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
- **Checklist Templates** library (since PR #8 — major rework). A template = name + description + ordered list of items + signatories. Items can optionally belong to a `section` so a single template can group items into subsections (e.g., Core cuttings has "Before start of work" / "During Execution" / "Post Completion").
- **Excel Upload** (`src/lib/checklist-parser.ts`): tolerant parser that handles all 4 demo layouts. Detects:
  - Title row by scanning the top 12 rows for the word "CHECKLIST"
  - Description column (`Item description` / `Item to Check` / `Item Desc`) — `S.No` column is one to its left
  - Subsection banners — a row whose S.No column says "S.No"/"Sr. No." while the description column holds a non-label value (e.g., "Before start of work")
  - Footer terminator — a `^Note\s*[:\-]?$` cell, **only after at least one item has already been collected** (avoids tripping on instruction rows like "Note: please tick where applicable" that sit above the items)
  - Signatories — cells matching `/repr[a-z]*tat[a-z]*\b|repres[a-z]*tive\b/i` (catches typos like "representavtibve")
  - Items renumbered per section (each section starts at 1) so sources with skipped numbers (1, 2, 3, 5, 7, 9) come out clean
- **PDF Export** (`src/lib/checklist-pdf.ts`): portrait A4, two modes:
  - **Blank PDF**: metadata fields print as labels with grey underlines for handwriting (Project / Make / Shop Drawing No / Date / BOQ Line Item No / Location / Building & Floor)
  - **Filled PDF**: opens metadata dialog → values populate next to labels
  - Items table grouped by section banners (light-blue full-width rows); Status and Remarks columns always blank for field sign-off
  - Notes block (if `notes_template` is set)
  - "Clearances Provided By" signatories table (Name | Date | Signature) — one row per signatory
  - Footer: template name + page X of Y
- **Signatories editor** in the create/edit dialog — defaults to 6 standard reps (C&W / Electrical / HVAC / Siemens / IT / Ostraca), per-template configurable
- **Bulk seed**: `app/seed-checklists.js` — one-shot script that loads `Core cuttings.xlsx` and `DB Installation check list.xlsx` from `../../Demo/Checklists/` into Supabase. Skips templates whose name already exists. Run with `node seed-checklists.js`.
- **Note**: the legacy "activity checklists per BOQ headline" feature (template-instance with status tracking on a specific BOQ headline) is separate from these standalone templates and uses different tables (`checklists`, `checklist_items`).

### 9. Reports (`/reports`)
Reports module with expandable submenu:
- **Overview** (`/reports`): General reports dashboard (under construction)
- **MIR Reports** (`/reports/mir`): Individual Material Inspection Reports
  - Site selector dropdown
  - MIR selector dropdown (format: "MIR 1 - 22 Jan 2026"), ascending date order (MIR 1 = earliest date)
  - Preview table showing materials for selected MIR
  - PDF download with:
    - Header: Site name, MIR reference, date
    - Table: S.No, Material, Qty, Unit, DC, Test Cert, TDS
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
- **Materials** (`/master-data/materials`): Category, name, unit, HSN code
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

### Core Tables
- `sites` - Construction sites
- `packages` - BOQ packages per site
  - `billing_type`: 'standard' | 'supply_installation' (migration 025)
  - `actual_source`: 'execution' | 'template' (migration 026, default 'execution') — drives RA Billing's Actual Qty source per package
- `boq_headlines` - BOQ section headers
- `boq_line_items` - BOQ line items
- `materials` - Materials per line item

### GRN Tables (Invoice-based)
- `grn_invoices` - GRN invoice headers
  - site_id, supplier_id, invoice_number
  - invoice_date (actual invoice date), grn_date (GRN receipt date)
- `grn_line_items` - Materials per invoice
  - material_id, material_name, quantity, unit, rate, gst_rate
  - amount_without_gst, amount_with_gst (stored values, not computed)
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

### JMR Tables
- `boq_jmr` - Joint Measurement Reports per BOQ line item
  - line_item_id, jmr_number, jmr_date, measurement_date
  - boq_quantity, executed_quantity, approved_quantity
  - customer_representative, contractor_representative, remarks
  - status: 'draft' | 'submitted' | 'approved' | 'disputed'
  - file_path, file_name (signed JMR doc in `compliance-docs` storage)
  - **Source of truth for "approved quantity"** — drives BOQ Upto Date and (via packages.actual_source) RA Billing actuals

### Checklist Template Tables (since PR #8)
- `checklist_templates` - Reusable checklist templates
  - name, description, notes_template
  - `signatories TEXT[]` (migration 027) — ordered list of role names for the PDF signature block; default = 6 standard reps
- `checklist_template_items` - Items within a template
  - template_id, item_no, description, sort_order
  - `section TEXT` nullable (migration 027) — groups items into subsections; PDF renders a banner row when section changes

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
    1. Progress: computeUptoDateMap(lineItemIds) from src/lib/upto-date.ts:
         - JMR-approved sum if any boq_jmr row with status='approved' exists for the line item
         - Else workstation_boq_progress quantity sum
    2. Consumption: workstation_material_consumption → "Consumption History"

RA Billing (/ra-billing) also reads computeUptoDateMap when packages.actual_source='execution',
overriding the stored boq_line_items.actual_* columns with computed values for display, totals,
summary cards, site summary, Excel export and PDF export.
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

Main navigation items:
- Dashboard, Sites, BOQ Management, BOQ Progress, RA Billing, Workstations, Material GRN, Inventory, Expenses Recording, Expense Dashboard, Supplier Invoices, Checklists

Reports submenu items (expandable group):
- Overview, MIR Reports

Master Data submenu items (expandable group):
- Workstations, Material List, Equipment Types, Equipment Rates, Labour Contractors, Manpower Categories, Manpower Rates, Suppliers

To add a new page:
1. Create page in `src/app/[page-name]/page.tsx`
2. Add navigation item to both sidebar.tsx and mobile-nav.tsx
3. Import required icon from lucide-react

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
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
- `026_actual_source_preference.sql` - Add `packages.actual_source` ('template' | 'execution', default 'execution', NOT NULL with backfill) — drives RA Billing's Actual Qty source per package
- `027_checklist_sections_signatories.sql` - Add `checklist_template_items.section` (nullable) and `checklist_templates.signatories` (TEXT[] with 6-rep default)

## Import/Utility Scripts

Located in `app/` directory for data import operations:

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

### `seed-checklists.js`
One-shot loader for the two starter checklist templates from the Demo folder.
```bash
node seed-checklists.js
```
- Reads `../../Demo/Checklists/Core cuttings.xlsx` (21 items, 3 sections) and `../../Demo/Checklists/DB Installation check list.xlsx` (19 items)
- Inlines a JS port of `src/lib/checklist-parser.ts` (so it runs without TS compile)
- Skips templates whose name already exists (by lowercase match)
- Run **after** migration 027 has been applied in Supabase

## Development
```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

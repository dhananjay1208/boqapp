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
- **Consumption History** (read-only):
  - Displays material consumption recorded from Workstations module
  - Shows material name, quantity, workstation name, date
  - No direct recording - consumption is managed via Workstations module

### 3. Material GRN (`/material-grn`)
- Invoice-based goods receipt notes
- Multiple materials per invoice
- **Invoice Date** and **GRN Date** tracking (separate fields)
- Document uploads:
  - **Invoice level**: DC (Delivery Challan)
  - **Line item level**: Test Certificate, TDS (MIR removed)
- Supplier selection from master data
- GST calculation (5%, 12%, 18%)
- **Export Reports**:
  - **Export Report**: Standard GRN report with all details
  - **MIR Overview**: Excel export with materials grouped by GRN date
    - MIR references (MIR 1, MIR 2, etc.) based on unique GRN dates
    - Quantity distribution across dates
    - Compliance status (Y/N/NA) for DC, Test Cert, TDS

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
- **Equipment Tab**: Equipment usage with hours and auto-calculated amount
- **Other Tab**: Miscellaneous expenses
- **Export to Excel**: Daily expense report with all categories
  - Summary sheet with totals
  - Detailed sheets for each category

### 6. Expense Dashboard (`/expense-dashboard`)
- Charts and analytics for expenses
- Date range filtering
- Category-wise breakdown

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
  - MIR selector dropdown (format: "MIR 1 - 22 Jan 2026")
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
- **Equipment** (`/master-data/equipment`): Equipment name, hourly rate
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

### Expense Tables
- `expense_manpower` - Manpower expenses
  - contractor_name, manpower_category, gender
  - num_persons, start_time, end_time
  - hours, rate (hourly), amount
  - notes (for worker names)
- `expense_equipment` - Equipment expenses
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

### Data Flow: Workstation → BOQ Consumption
```
Workstations Module (/workstations)
    ↓ Records progress + material consumption
workstation_material_consumption table
    ↓ Joined with workstation_boq_progress → site_workstations → master_workstations
BOQ Management (/boq/[id]) reads consumption history (read-only)
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
- Dashboard, Sites, BOQ Management, BOQ Progress, Workstations, Material GRN, Inventory, Expenses Recording, Expense Dashboard, Supplier Invoices, Checklists

Reports submenu items (expandable group):
- Overview, MIR Reports

Master Data submenu items (expandable group):
- Workstations, Material List, Equipment, Labour Contractors, Manpower Categories, Manpower Rates, Suppliers

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
Upload invoice PDF documents to Supabase Storage.
```bash
node upload-invoices.js
```
- Reads PDF files from invoice folder
- Matches filenames to invoice numbers (handles various formats)
- Uploads to `compliance-docs` bucket
- Creates/updates `grn_invoice_dc` records

## Development
```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

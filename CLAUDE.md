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
│   │   ├── material-grn/       # GRN (Goods Receipt Note)
│   │   ├── inventory/          # Inventory view
│   │   ├── expenses/           # Expense recording
│   │   ├── expense-dashboard/  # Expense analytics
│   │   ├── supplier-invoices/  # Supplier invoice payments
│   │   ├── checklists/         # Checklist management
│   │   ├── reports/            # Reports
│   │   └── master-data/        # Master data (suppliers, materials, etc.)
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

### 3. Material GRN (`/material-grn`)
- Invoice-based goods receipt notes
- Multiple materials per invoice
- Document uploads (DC, MIR, Test Certificate, TDS)
- Supplier selection from master data
- GST calculation (5%, 12%, 18%)

### 4. Inventory (`/inventory`)
- Aggregated material stock from GRN entries
- Track received vs consumed quantities
- Category-wise grouping

### 5. Expenses (`/expenses`, `/expense-dashboard`)
- Record expenses by category (Material, Manpower, Equipment, Other)
- Dashboard with charts and analytics
- Date range filtering

### 6. Supplier Invoices (`/supplier-invoices`)
- Consolidated view of supplier invoices from GRN
- Payment tracking with status (Pending, Partial, Paid)
- Features:
  - Site selection
  - Supplier summary cards with counts and amounts
  - Invoice detail view with DC document access
  - Payment confirmation with date, amount, reference
  - Partial payment support with balance tracking
  - Export to Excel with all payment details

### 7. Checklists (`/checklists`)
- Activity checklists per BOQ headline
- Status tracking (pending, in_progress, completed)

### 8. Master Data (`/master-data/*`)
- **Materials**: Category, name, unit, HSN code
- **Suppliers**: Name, GSTIN, address, contact
- **Equipment**: Equipment list for expenses
- **Manpower**: Manpower categories for expenses

## Database Tables

### Core Tables
- `sites` - Construction sites
- `packages` - BOQ packages per site
- `boq_headlines` - BOQ section headers
- `boq_line_items` - BOQ line items
- `materials` - Materials per line item

### GRN Tables (Invoice-based)
- `grn_invoices` - GRN invoice headers
- `grn_line_items` - Materials per invoice (with GST calculation)
- `grn_invoice_dc` - Delivery challan documents
- `grn_line_item_documents` - MIR, Test Cert, TDS per material

### Master Data Tables
- `master_materials` - Material master list
- `suppliers` - Supplier master list
- `master_equipment` - Equipment master
- `master_manpower` - Manpower categories

### Expense Tables
- `expense_material` - Material expenses
- `expense_manpower` - Manpower expenses
- `expense_equipment` - Equipment expenses
- `expense_other` - Other expenses

### Payment Tables
- `supplier_invoice_payments` - Payment tracking for supplier invoices
  - Supports: pending, partial, paid status
  - Tracks: payment_amount, payment_reference, paid_at, notes

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
```

### File Upload to Storage
```typescript
const { error } = await supabase.storage
  .from('compliance-docs')
  .upload(filePath, file)
```

### View Uploaded File
```typescript
const { data } = await supabase.storage
  .from('compliance-docs')
  .createSignedUrl(filePath, 3600) // 1 hour expiry
window.open(data.signedUrl, '_blank')
```

## Navigation
Navigation items are defined in:
- `src/components/layout/sidebar.tsx` - Desktop sidebar
- `src/components/layout/mobile-nav.tsx` - Mobile navigation

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

## Development
```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

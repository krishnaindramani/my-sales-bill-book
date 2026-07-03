# My Sales Bill Book — Personal Billing & Micro-ERP

A fully local, offline-first billing application built with Next.js 16, TypeScript, SQLite (better-sqlite3), Tailwind CSS, and Recharts.

## Quick Start

```bash
# 1. Install dependencies (already done if you cloned this)
npm install

# 2. Run in development mode
npm run dev

# 3. Open in your browser
open http://localhost:3000
```

## Production Run (fastest)
```bash
npm run build
npm start
```

## Project Structure
```
my-sales-bill-book/
├── app/                    # Next.js App Router pages + API routes
│   ├── layout.tsx          # Root layout with persistent sidebar
│   ├── dashboard/          # Overview dashboard with charts
│   ├── invoices/
│   │   ├── new/            # Invoice creation with live GST calculation
│   │   ├── open/           # Invoice list with filters and actions
│   │   └── [id]/           # Invoice detail view
│   ├── proforma/
│   │   ├── new/            # Proforma creation
│   │   └── view/           # Proforma list
│   ├── customers/          # Customer CRM with add/edit modal
│   ├── challan/
│   │   ├── new/            # Delivery challan creation
│   │   └── view/           # Challan list with status tracking
│   ├── account/
│   │   ├── purchase/
│   │   │   ├── new/        # Add purchase bill
│   │   │   └── view/       # Purchase bills list
│   │   ├── payment/        # Record sales payments
│   │   └── ledger/         # Full ledger with manual entries
│   ├── reports/            # Analytics: sales, purchases, customer-wise
│   └── api/                # REST API routes (server-side SQLite)
├── lib/
│   └── db.ts               # SQLite connection, schema, GST helpers, counters
├── types/
│   └── index.ts            # All TypeScript interfaces
├── data/
│   └── sales_book.db       # Auto-created SQLite database (gitignored)
└── next.config.ts
```

## Database
- Auto-created at `./data/sales_book.db` on first run
- Uses WAL journal mode for safe concurrent reads
- Full cascade deletes on invoice → items, challan → items, etc.
- All monetary values stored as REAL with 2-decimal precision

## GST Logic
- CGST + SGST (intra-state): tax split equally, stored as `cgst_percent` and `sgst_percent`
- IGST (inter-state): full tax as `igst_percent`
- Formula: `tax_amount = (qty × rate × tax%) / 100`
- Tax type auto-populated from customer profile, overridable per invoice

## Key Features
- ✅ Dashboard with Recharts area/bar charts
- ✅ Invoices with dynamic line items and live totals
- ✅ Proforma invoices (convert/expire workflow)
- ✅ Delivery challans with vehicle/driver tracking
- ✅ Customer CRM with outstanding balance tracking
- ✅ Purchase bills with vendor details
- ✅ Sales payment recording (links to invoice, auto-updates balance)
- ✅ Ledger with manual entry support and running balance
- ✅ Reports: sales/purchase monthly trend, customer-wise breakdown
- ✅ SQLite transactions for all multi-table writes (atomic + rollback-safe)
- ✅ Auto invoice/proforma/challan number sequencing
- ✅ Mark invoice as paid → auto ledger entry + customer outstanding update

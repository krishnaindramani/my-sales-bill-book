// ── Core Domain Types ───────────────────────────────────────────────────────

export type TaxType = "CGST_SGST" | "IGST";
export type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Cancelled";
export type ProformaStatus = "Active" | "Converted" | "Expired";
export type ChallanStatus = "Pending" | "Delivered" | "Returned";
export type PurchaseStatus = "Pending" | "Paid" | "Partial";
export type PaymentMode = "Cash" | "Cheque" | "UPI" | "NEFT" | "RTGS";
export type LedgerRefType = "INVOICE" | "PAYMENT" | "PURCHASE" | "MANUAL";

// ── Customer ────────────────────────────────────────────────────────────────
export interface Customer {
  id: number;
  name: string;
  company?: string | null;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  state_code?: string | null;
  tax_type: TaxType;
  outstanding: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerInput = Omit<Customer, "id" | "created_at" | "updated_at" | "outstanding">;

// ── Invoice Line Item ───────────────────────────────────────────────────────
export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  sl_no: number;
  particulars: string;
  hsn_sac?: string | null;
  qty: number;
  unit: string;
  rate: number;
  tax_percent: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  tax_amount: number;
  line_total: number;
}

// ── Invoice ─────────────────────────────────────────────────────────────────
export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id?: number | null;
  invoice_date?: string | null;
  due_date?: string | null;
  place_of_supply?: string | null;
  tax_type: TaxType;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  notes?: string | null;
  terms?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer_name?: string | null;
  items?: InvoiceItem[];
}

export interface InvoiceInput {
  customer_id?: number | null;
  invoice_date?: string | null;
  due_date?: string | null;
  place_of_supply?: string | null;
  tax_type: TaxType;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  grand_total: number;
  notes?: string | null;
  terms?: string | null;
  items: Omit<InvoiceItem, "id" | "invoice_id">[];
}

// ── Proforma ────────────────────────────────────────────────────────────────
export interface ProformaItem {
  id?: number;
  proforma_id?: number;
  sl_no: number;
  particulars: string;
  hsn_sac?: string | null;
  qty: number;
  unit: string;
  rate: number;
  tax_percent: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  tax_amount: number;
  line_total: number;
}

export interface Proforma {
  id: number;
  proforma_number: string;
  customer_id?: number | null;
  proforma_date?: string | null;
  valid_until?: string | null;
  place_of_supply?: string | null;
  tax_type: TaxType;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  grand_total: number;
  status: ProformaStatus;
  notes?: string | null;
  terms?: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  items?: ProformaItem[];
}

export interface ProformaInput {
  customer_id?: number | null;
  proforma_date?: string | null;
  valid_until?: string | null;
  place_of_supply?: string | null;
  tax_type: TaxType;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  grand_total: number;
  notes?: string | null;
  terms?: string | null;
  items: Omit<ProformaItem, "id" | "proforma_id">[];
}

// ── Challan ─────────────────────────────────────────────────────────────────
export interface ChallanItem {
  id?: number;
  challan_id?: number;
  sl_no: number;
  particulars: string;
  hsn_sac?: string | null;
  qty: number;
  unit: string;
}

export interface Challan {
  id: number;
  challan_number: string;
  customer_id?: number | null;
  invoice_id?: number | null;
  challan_date?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  delivery_address?: string | null;
  status: ChallanStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  items?: ChallanItem[];
}

export interface ChallanInput {
  customer_id?: number | null;
  invoice_id?: number | null;
  challan_date?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  items: Omit<ChallanItem, "id" | "challan_id">[];
}

// ── Purchase Bill ───────────────────────────────────────────────────────────
export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  sl_no: number;
  particulars: string;
  hsn_sac?: string | null;
  qty: number;
  unit: string;
  rate: number;
  tax_percent: number;
  tax_amount: number;
  line_total: number;
}

export interface PurchaseBill {
  id: number;
  bill_number?: string | null;
  vendor_name?: string | null;
  vendor_gstin?: string | null;
  bill_date?: string | null;
  due_date?: string | null;
  subtotal: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  status: PurchaseStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
}

// ── Sales Payment ───────────────────────────────────────────────────────────
export interface SalesPayment {
  id: number;
  invoice_id?: number | null;
  customer_id?: number | null;
  payment_date?: string | null;
  amount: number;
  payment_mode: PaymentMode;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
  invoice_number?: string | null;
  customer_name?: string | null;
}

// ── Ledger Entry ────────────────────────────────────────────────────────────
export interface LedgerEntry {
  id: number;
  entry_date?: string | null;
  account_head?: string | null;
  party_name?: string | null;
  ref_type?: LedgerRefType | null;
  ref_id?: number | null;
  description?: string | null;
  debit: number;
  credit: number;
  balance: number;
  created_at: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalInvoices: number;
  pendingInvoices: number;
  totalCustomers: number;
  totalRevenue: number;
  totalOutstanding: number;
  monthlyData: MonthlyData[];
}

export interface MonthlyData {
  month: string;
  revenue: number;
  invoices: number;
  paid: number;
}

// ── API Response Wrapper ────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Sidebar Navigation ──────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
  badge?: number;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

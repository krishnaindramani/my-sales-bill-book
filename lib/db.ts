/**
 * db.ts — Singleton Cloud PostgreSQL Pool Connection Manager
 * Fully asynchronous, optimized for Vercel Serverless runtimes.
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL or POSTGRES_URL environment variables inside configuration dashboard.");
}

// Strip out any trailing string literal delimiters automatically
const cleanConnectionString = connectionString.trim().replace(/^['"]|['"]$/g, "");

export const db = new Pool({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false, // Ensures TLS connection authorization paths match Supabase routing rules
  },
});

// ── Audit Log Helper ───────────────────────────────────────────────────────
export async function writeLog(action_type: string, description: string): Promise<void> {
  try {
    await db.query(
      `INSERT INTO activity_logs (action_type, description) VALUES ($1, $2)`,
      [action_type, description]
    );
  } catch (err) {
    console.error("Audit logging error encountered silently:", err);
  }
}

// ── Utility: Atomic Sequence Number Upgrades using Postgres Locking ────────
async function advanceCounter(counterName: string): Promise<number> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    
    // Lock the row to prevent race conditions across parallel lambdas
    const checkRes = await client.query(
      `SELECT current FROM counters WHERE name = $1 FOR UPDATE`,
      [counterName]
    );
    
    let currentVal = 0;
    if (checkRes.rows.length === 0) {
      await client.query(`INSERT INTO counters (name, current) VALUES ($1, 0)`, [counterName]);
    } else {
      currentVal = checkRes.rows[0].current;
    }

    const newVal = currentVal + 1;
    await client.query(`UPDATE counters SET current = $1 WHERE name = $2`, [newVal, counterName]);
    await client.query("COMMIT");
    return newVal;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function nextInvoiceNumber(prefix: string = "INV"): Promise<string> {
  const seq = await advanceCounter("invoice");
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export async function nextProformaNumber(prefix: string = "PRO"): Promise<string> {
  const seq = await advanceCounter("proforma");
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export async function nextChallanNumber(prefix: string = "DC"): Promise<string> {
  const seq = await advanceCounter("challan");
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// ── GST Calculation Helpers ─────────────────────────────────────────────────
export interface GstLineItem {
  qty: number;
  rate: number;
  tax_percent: number;
  tax_type: "CGST_SGST" | "IGST";
}

export interface GstLineResult {
  taxable: number;
  tax_amount: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
}

export function calcGstLine(item: GstLineItem): GstLineResult {
  const taxable = parseFloat((item.qty * item.rate).toFixed(2));
  const tax_amount = parseFloat(((taxable * item.tax_percent) / 100).toFixed(2));
  const half = item.tax_percent / 2;

  if (item.tax_type === "IGST") {
    return {
      taxable,
      tax_amount,
      cgst_percent: 0,
      sgst_percent: 0,
      igst_percent: item.tax_percent,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: tax_amount,
      line_total: parseFloat((taxable + tax_amount).toFixed(2)),
    };
  }

  const cgst_amount = parseFloat(((taxable * half) / 100).toFixed(2));
  const sgst_amount = parseFloat(((taxable * half) / 100).toFixed(2));
  return {
    taxable,
    tax_amount: parseFloat((cgst_amount + sgst_amount).toFixed(2)),
    cgst_percent: half,
    sgst_percent: half,
    igst_percent: 0,
    cgst_amount,
    sgst_amount,
    igst_amount: 0,
    line_total: parseFloat((taxable + cgst_amount + sgst_amount).toFixed(2)),
  };
}
import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";
import { CustomerInput } from "@/types";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT c.*,
         (SELECT COUNT(*)::integer FROM invoices WHERE customer_id = c.id) as invoice_count,
         (SELECT COALESCE(SUM(grand_total), 0)::double precision FROM invoices WHERE customer_id = c.id) as total_billed
       FROM customers c
       ORDER BY c.name ASC`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CustomerInput = await req.json();

    const insertResult = await db.query(
      `INSERT INTO customers
         (name, company, gstin, pan, email, phone, address, city, state, pincode, state_code, tax_type, notes)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        body.name,
        body.company ?? null,
        body.gstin ?? null,
        body.pan ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.address ?? null,
        body.city ?? null,
        body.state ?? null,
        body.pincode ?? null,
        body.state_code ?? null,
        body.tax_type ?? "CGST_SGST",
        body.notes ?? null,
      ]
    );

    const created = insertResult.rows[0];
    
    // Fire and forget logging payload updates securely
    await writeLog("CREATE_CUSTOMER", `Customer "${body.name}" added.`);
    
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
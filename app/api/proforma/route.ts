import { NextRequest, NextResponse } from "next/server";
import { db, nextProformaNumber } from "@/lib/db";
import { ProformaInput } from "@/types";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT p.*, c.name as customer_name
       FROM proformas p
       LEFT JOIN customers c ON c.id = p.customer_id
       ORDER BY p.created_at DESC`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body: ProformaInput = await req.json();
    const proforma_number = await nextProformaNumber("PRO");

    await client.query("BEGIN");

    // Insert proforma record and fetch auto-generated primary key using RETURNING
    const proformaInsertRes = await client.query(
      `INSERT INTO proformas
         (proforma_number, customer_id, proforma_date, valid_until, place_of_supply,
          tax_type, subtotal, total_cgst, total_sgst, total_igst, total_tax,
          grand_total, status, notes, terms)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Active', $13, $14)
       RETURNING id`,
      [
        proforma_number,
        body.customer_id ?? null,
        body.proforma_date ?? null,
        body.valid_until ?? null,
        body.place_of_supply ?? null,
        body.tax_type,
        body.subtotal,
        body.total_cgst,
        body.total_sgst,
        body.total_igst,
        body.total_tax,
        body.grand_total,
        body.notes ?? null,
        body.terms ?? null,
      ]
    );

    const proformaId = proformaInsertRes.rows[0].id;

    // Loop through individual line item objects using positional assignments
    for (const item of body.items) {
      await client.query(
        `INSERT INTO proforma_items
           (proforma_id, sl_no, particulars, hsn_sac, qty, unit, rate,
            tax_percent, cgst_percent, sgst_percent, igst_percent, tax_amount, line_total)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          proformaId,
          item.sl_no,
          item.particulars,
          item.hsn_sac ?? null,
          item.qty,
          item.unit,
          item.rate,
          item.tax_percent,
          item.cgst_percent,
          item.sgst_percent,
          item.igst_percent,
          item.tax_amount,
          item.line_total,
        ]
      );
    }

    await client.query("COMMIT");

    const createdRes = await db.query(
      `SELECT p.*, c.name as customer_name 
       FROM proformas p 
       LEFT JOIN customers c ON c.id = p.customer_id 
       WHERE p.id = $1`,
      [proformaId]
    );

    return NextResponse.json({ success: true, data: createdRes.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
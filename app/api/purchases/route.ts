import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query(`SELECT * FROM purchase_bills ORDER BY created_at DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();

    await client.query("BEGIN");

    // 1. Insert parent purchase bill details and read auto-generated item id array back
    const billInsertRes = await client.query(
      `INSERT INTO purchase_bills
         (bill_number, vendor_name, vendor_gstin, bill_date, due_date,
          subtotal, total_cgst, total_sgst, total_igst, total_tax,
          grand_total, amount_paid, balance_due, status, notes)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $11, 'Pending', $12)
       RETURNING id`,
      [
        body.bill_number ?? null,
        body.vendor_name ?? null,
        body.vendor_gstin ?? null,
        body.bill_date ?? null,
        body.due_date ?? null,
        body.subtotal ?? 0,
        body.total_cgst ?? 0,
        body.total_sgst ?? 0,
        body.total_igst ?? 0,
        body.total_tax ?? 0,
        body.grand_total ?? 0,
        body.notes ?? null,
      ]
    );

    const purchaseId = billInsertRes.rows[0].id;

    // 2. Insert child items if populated in request
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        await client.query(
          `INSERT INTO purchase_items
             (purchase_id, sl_no, particulars, hsn_sac, qty, unit, rate, tax_percent, tax_amount, line_total)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            purchaseId,
            item.sl_no,
            item.particulars ?? null,
            item.hsn_sac ?? null,
            item.qty ?? 1,
            item.unit ?? "Nos",
            item.rate ?? 0,
            item.tax_percent ?? 0,
            item.tax_amount ?? 0,
            item.line_total ?? 0,
          ]
        );
      }
    }

    // 3. Insert transactional double-entry ledger record
    await client.query(
      `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit)
       VALUES (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 'Purchase', $1, 'PURCHASE', $2, $3, 0, $4)`,
      [
        body.vendor_name ?? "Unknown Vendor",
        purchaseId,
        `Purchase Bill ${body.bill_number ?? "#" + purchaseId}`,
        body.grand_total ?? 0,
      ]
    );

    await client.query("COMMIT");

    const createdRes = await db.query(`SELECT * FROM purchase_bills WHERE id = $1`, [purchaseId]);
    
    return NextResponse.json({ success: true, data: createdRes.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
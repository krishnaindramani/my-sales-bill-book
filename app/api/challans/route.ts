import { NextRequest, NextResponse } from "next/server";
import { db, nextChallanNumber } from "@/lib/db";
import { ChallanInput } from "@/types";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT ch.*, c.name as customer_name
       FROM challans ch
       LEFT JOIN customers c ON c.id = ch.customer_id
       ORDER BY ch.created_at DESC`
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
    const body: ChallanInput = await req.json();
    const challan_number = await nextChallanNumber("DC");

    await client.query("BEGIN");

    // Insert challan record and fetch auto-generated id using RETURNING
    const challanInsertRes = await client.query(
      `INSERT INTO challans
         (challan_number, customer_id, invoice_id, challan_date, vehicle_number,
          driver_name, delivery_address, status, notes)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8)
       RETURNING id`,
      [
        challan_number,
        body.customer_id ?? null,
        body.invoice_id ?? null,
        body.challan_date ?? null,
        body.vehicle_number ?? null,
        body.driver_name ?? null,
        body.delivery_address ?? null,
        body.notes ?? null,
      ]
    );

    const challanId = challanInsertRes.rows[0].id;

    // Loop through items using parameterized values
    for (const item of body.items) {
      await client.query(
        `INSERT INTO challan_items (challan_id, sl_no, particulars, hsn_sac, qty, unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          challanId,
          item.sl_no,
          item.particulars,
          item.hsn_sac ?? null,
          item.qty,
          item.unit,
        ]
      );
    }

    await client.query("COMMIT");

    // Retrieve the fully compiled data payload for client confirmation response
    const createdRes = await db.query(
      `SELECT ch.*, c.name as customer_name 
       FROM challans ch 
       LEFT JOIN customers c ON c.id = ch.customer_id 
       WHERE ch.id = $1`,
      [challanId]
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
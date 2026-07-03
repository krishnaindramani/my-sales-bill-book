import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const challanId = Number(id);

    if (isNaN(challanId)) {
      return NextResponse.json({ success: false, error: "Invalid challan id" }, { status: 400 });
    }

    // Execute parent metadata record lookup and item subset fetches in parallel
    const [challanRes, itemsRes] = await Promise.all([
      db.query(
        `SELECT ch.*, c.name as customer_name, c.address as customer_address
         FROM challans ch
         LEFT JOIN customers c ON c.id = ch.customer_id
         WHERE ch.id = $1`,
        [challanId]
      ),
      db.query(
        `SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY sl_no ASC`,
        [challanId]
      )
    ]);

    const challan = challanRes.rows[0];
    if (!challan) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { ...challan, items: itemsRes.rows } 
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const challanId = Number(id);
    const body: { status: string } = await req.json();

    if (isNaN(challanId)) {
      return NextResponse.json({ success: false, error: "Invalid challan id" }, { status: 400 });
    }

    // Execute localized column modification utilizing PostgreSQL explicit syntax values
    await db.query(
      `UPDATE challans 
       SET status = $1, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
       WHERE id = $2`,
      [body.status, challanId]
    );

    const updatedRes = await db.query(
      `SELECT ch.*, c.name as customer_name 
       FROM challans ch 
       LEFT JOIN customers c ON c.id = ch.customer_id 
       WHERE ch.id = $1`,
      [challanId]
    );

    return NextResponse.json({ success: true, data: updatedRes.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const challanId = Number(id);

    if (isNaN(challanId)) {
      return NextResponse.json({ success: false, error: "Invalid challan id" }, { status: 400 });
    }

    // Deleting the challan record automatically cascades to child items via the DB constraints
    await db.query(`DELETE FROM challans WHERE id = $1`, [challanId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
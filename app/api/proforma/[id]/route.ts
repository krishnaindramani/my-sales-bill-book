import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proformaId = Number(id);

    if (isNaN(proformaId)) {
      return NextResponse.json({ success: false, error: "Invalid proforma id" }, { status: 400 });
    }

    // Process parent metadata profiles and item subsets concurrently over the network link
    const [proformaRes, itemsRes] = await Promise.all([
      db.query(
        `SELECT p.*, c.name as customer_name, c.company as customer_company, 
                    c.gstin as customer_gstin, c.address as customer_address, 
                    c.city as customer_city 
         FROM proformas p 
         LEFT JOIN customers c ON c.id = p.customer_id 
         WHERE p.id = $1`,
        [proformaId]
      ),
      db.query(
        `SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY sl_no ASC`,
        [proformaId]
      )
    ]);

    const proforma = proformaRes.rows[0];
    if (!proforma) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...proforma, items: itemsRes.rows } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proformaId = Number(id);
    const body: { status: string } = await req.json();

    if (isNaN(proformaId)) {
      return NextResponse.json({ success: false, error: "Invalid proforma id" }, { status: 400 });
    }

    await db.query(
      `UPDATE proformas 
       SET status = $1, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
       WHERE id = $2`,
      [body.status, proformaId]
    );

    await writeLog("UPDATE_PROFORMA", `Proforma ${id} status → ${body.status}.`);

    const updatedRes = await db.query(
      `SELECT p.*, c.name as customer_name 
       FROM proformas p 
       LEFT JOIN customers c ON c.id = p.customer_id 
       WHERE p.id = $1`,
      [proformaId]
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
    const proformaId = Number(id);

    if (isNaN(proformaId)) {
      return NextResponse.json({ success: false, error: "Invalid proforma id" }, { status: 400 });
    }

    const checkRes = await db.query(`SELECT proforma_number FROM proformas WHERE id = $1`, [proformaId]);
    const p = checkRes.rows[0] as { proforma_number: string } | undefined;

    // Table foreign keys will automatically cascade delete row items
    await db.query(`DELETE FROM proformas WHERE id = $1`, [proformaId]);
    await writeLog("DELETE_PROFORMA", `Proforma ${p?.proforma_number ?? id} deleted.`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";
import { CustomerInput } from "@/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = Number(id);

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, error: "Invalid customer id" }, { status: 400 });
    }

    // Execute core database queries concurrently to streamline operational performance
    const [customerRes, invoicesRes] = await Promise.all([
      db.query(`SELECT * FROM customers WHERE id = $1`, [customerId]),
      db.query(`SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`, [customerId])
    ]);

    const customer = customerRes.rows[0];
    if (!customer) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { customer, invoices: invoicesRes.rows } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = Number(id);
    const body: Partial<CustomerInput> = await req.json();

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, error: "Invalid customer id" }, { status: 400 });
    }

    await db.query(
      `UPDATE customers SET
        name = COALESCE($1, name), company = $2, gstin = $3, pan = $4,
        email = $5, phone = $6, address = $7, city = $8, state = $9,
        pincode = $10, state_code = $11, tax_type = COALESCE($12, tax_type),
        notes = $13, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = $14`,
      [
        body.name ?? null, body.company ?? null, body.gstin ?? null, body.pan ?? null,
        body.email ?? null, body.phone ?? null, body.address ?? null, body.city ?? null,
        body.state ?? null, body.pincode ?? null, body.state_code ?? null,
        body.tax_type ?? null, body.notes ?? null, customerId
      ]
    );

    const updatedRes = await db.query(`SELECT * FROM customers WHERE id = $1`, [customerId]);
    await writeLog("UPDATE_CUSTOMER", `Customer "${body.name ?? id}" updated.`);

    return NextResponse.json({ success: true, data: updatedRes.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = Number(id);

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, error: "Invalid customer id" }, { status: 400 });
    }

    const checkRes = await db.query(`SELECT name FROM customers WHERE id = $1`, [customerId]);
    const cust = checkRes.rows[0] as { name: string } | undefined;

    await db.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
    await writeLog("DELETE_CUSTOMER", `Customer "${cust?.name ?? id}" deleted.`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
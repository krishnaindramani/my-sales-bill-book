import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoiceId = Number(id);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ success: false, error: "Invalid invoice id" }, { status: 400 });
    }

    // Run parent invoice metadata and child item queries concurrently over the network link
    const [invoiceRes, itemsRes] = await Promise.all([
      db.query(
        `SELECT i.*, c.name as customer_name, c.company as customer_company,
                    c.gstin as customer_gstin, c.address as customer_address,
                    c.city as customer_city, c.state as customer_state,
                    c.phone as customer_phone
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.id = $1`,
        [invoiceId]
      ),
      db.query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sl_no ASC`,
        [invoiceId]
      )
    ]);

    const invoice = invoiceRes.rows[0];
    if (!invoice) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...invoice, items: itemsRes.rows } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const client = await db.connect();
  try {
    const { id } = await params;
    const invoiceId = Number(id);
    const body: { action?: string; status?: string; amount_paid?: number } = await req.json();

    if (isNaN(invoiceId)) {
      return NextResponse.json({ success: false, error: "Invalid invoice id" }, { status: 400 });
    }

    await client.query("BEGIN");

    // Fetch the target invoice row to read pricing totals safely inside the transaction loop
    const invRes = await client.query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
    const inv = invRes.rows[0] as {
      id: number; grand_total: number; customer_id: number | null;
      invoice_number: string; status: string; amount_paid: number;
    } | undefined;

    if (!inv) throw new Error("Invoice not found");

    if (body.action === "mark_paid") {
      const balanceToPay = inv.grand_total - inv.amount_paid;

      await client.query(
        `UPDATE invoices 
         SET status = 'Paid', amount_paid = grand_total, balance_due = 0,
             updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
         WHERE id = $1`,
        [invoiceId]
      );

      await client.query(
        `INSERT INTO sales_payments (invoice_id, customer_id, payment_date, amount, payment_mode, notes)
         VALUES ($1, $2, TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $3, 'Cash', 'Auto-marked from invoice')`,
        [invoiceId, inv.customer_id, balanceToPay]
      );

      let customerName = "Unknown";
      if (inv.customer_id) {
        // Use GREATEST(0, field) since MAX() is an aggregate function and fails on raw column modifications in Postgres
        await client.query(
          `UPDATE customers 
           SET outstanding = GREATEST(0, outstanding - $1), 
               updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
           WHERE id = $2`,
          [balanceToPay, inv.customer_id]
        );

        const custRes = await client.query(`SELECT name FROM customers WHERE id = $1`, [inv.customer_id]);
        if (custRes.rows[0]) customerName = custRes.rows[0].name;
      }

      await client.query(
        `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit)
         VALUES (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 'Cash', $1, 'PAYMENT', $2, $3, 0, $4)`,
        [
          customerName,
          invoiceId,
          `Payment received for Invoice ${inv.invoice_number}`,
          balanceToPay
        ]
      );

      await writeLog("MARK_PAID_INVOICE", `Invoice ${inv.invoice_number} marked as Paid.`);
    } else if (body.status) {
      await client.query(
        `UPDATE invoices 
         SET status = $1, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
         WHERE id = $2`,
        [body.status, invoiceId]
      );
      await writeLog("UPDATE_INVOICE", `Invoice ${inv.invoice_number} status changed to ${body.status}.`);
    }

    await client.query("COMMIT");

    const updatedRes = await db.query(
      `SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.id=$1`,
      [invoiceId]
    );

    return NextResponse.json({ success: true, data: updatedRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoiceId = Number(id);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ success: false, error: "Invalid invoice id" }, { status: 400 });
    }

    const checkRes = await db.query(`SELECT invoice_number FROM invoices WHERE id = $1`, [invoiceId]);
    const inv = checkRes.rows[0] as { invoice_number: string } | undefined;

    await db.query(`DELETE FROM invoices WHERE id = $1`, [invoiceId]);
    await writeLog("DELETE_INVOICE", `Invoice ${inv?.invoice_number ?? id} permanently deleted.`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
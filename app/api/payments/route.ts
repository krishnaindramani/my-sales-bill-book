import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");

    let query = `
      SELECT sp.*, c.name as customer_name, i.invoice_number
      FROM sales_payments sp
      LEFT JOIN customers c ON c.id = sp.customer_id
      LEFT JOIN invoices i ON i.id = sp.invoice_id
    `;
    const params: any[] = [];

    if (customerId) {
      query += ` WHERE sp.customer_id = $1`;
      params.push(Number(customerId));
    }

    query += ` ORDER BY sp.payment_date DESC, sp.id DESC`;

    // Fetch lists and total monetary amounts concurrently over the network pooler link
    const [paymentsRes, totalRes] = await Promise.all([
      db.query(query, params),
      db.query(`SELECT COALESCE(SUM(amount), 0)::double precision as total FROM sales_payments`)
    ]);

    return NextResponse.json({
      success: true,
      data: paymentsRes.rows,
      total_collected: totalRes.rows[0].total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { invoice_id, customer_id, payment_date, amount, payment_mode, reference_no, notes } = body;

    if (!customer_id || !amount) {
      return NextResponse.json({ success: false, error: "Missing required fields (customer_id, amount)" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Insert the payment log directly into the records table
    const insertRes = await client.query(
      `INSERT INTO sales_payments 
         (invoice_id, customer_id, payment_date, amount, payment_mode, reference_no, notes)
       VALUES ($1, $2, COALESCE($3, TO_CHAR(NOW(), 'YYYY-MM-DD')), $4, COALESCE($5, 'Cash'), $6, $7)
       RETURNING *`,
      [
        invoice_id ? Number(invoice_id) : null,
        Number(customer_id),
        payment_date ?? null,
        Number(amount),
        payment_mode ?? null,
        reference_no ?? null,
        notes ?? null,
      ]
    );
    const createdPayment = insertRes.rows[0];

    // 2. Fetch customer's name to pass into the general ledger
    const customerRes = await client.query(`SELECT name FROM customers WHERE id = $1`, [Number(customer_id)]);
    const customerName = customerRes.rows[0]?.name || "Unknown Customer";

    // 3. Update parent customer account balance
    await client.query(
      `UPDATE customers 
       SET outstanding = GREATEST(0, outstanding - $1), 
           updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
       WHERE id = $2`,
      [Number(amount), Number(customer_id)]
    );

    // 4. Update parent invoice balance and state if connected
    let invoiceNumberLabel = "";
    if (invoice_id) {
      const invRes = await client.query(`SELECT invoice_number, balance_due FROM invoices WHERE id = $1`, [Number(invoice_id)]);
      if (invRes.rows[0]) {
        const inv = invRes.rows[0];
        invoiceNumberLabel = ` for Invoice ${inv.invoice_number}`;
        
        await client.query(
          `UPDATE invoices 
           SET amount_paid = amount_paid + $1, 
               balance_due = GREATEST(0, balance_due - $1),
               status = CASE WHEN GREATEST(0, balance_due - $1) <= 0 THEN 'Paid' ELSE 'Pending' END,
               updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
           WHERE id = $2`,
          [Number(amount), Number(invoice_id)]
        );
      }
    }

    // 5. Build and attach transactional double-entry ledger rows
    await client.query(
      `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit)
       VALUES (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 'Cash', $1, 'PAYMENT', $2, $3, 0, $4)`,
      [
        customerName,
        createdPayment.id,
        `Payment received via ${payment_mode ?? "Cash"}${invoiceNumberLabel}`,
        Number(amount),
      ]
    );

    await client.query("COMMIT");

    await writeLog("CREATE_PAYMENT", `Payment of ₹${amount} received from ${customerName}.`);

    return NextResponse.json({ success: true, data: createdPayment }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
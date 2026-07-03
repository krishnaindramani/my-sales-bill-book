import { NextRequest, NextResponse } from "next/server";
import { db, nextInvoiceNumber, writeLog } from "@/lib/db";
import { InvoiceInput } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    
    let query = `
      SELECT i.*, c.name as customer_name, c.company as customer_company
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
    `;
    const params: any[] = [];

    if (status) {
      query += ` WHERE i.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY i.created_at DESC`;

    const result = await db.query(query, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json() as InvoiceInput & {
      invoice_number?: string;
      description?: string;
      bill_percentage?: number;
      dc_no?: string; dc_date?: string;
      order_no?: string; order_date?: string;
      round_off?: number; payable_amount?: number;
    };

    // Use manually entered invoice number if provided, else auto-generate
    const invoice_number = (body.invoice_number && body.invoice_number.trim())
      ? body.invoice_number.trim()
      : await nextInvoiceNumber("INV");

    await client.query("BEGIN");

    // Insert Invoice and collect generated primary key returning array rows
    const invoiceInsertRes = await client.query(
      `INSERT INTO invoices
         (invoice_number, customer_id, invoice_date, due_date, place_of_supply,
          tax_type, subtotal, total_cgst, total_sgst, total_igst, total_tax,
          grand_total, amount_paid, balance_due, status, notes, terms,
          description, bill_percentage, dc_no, dc_date, order_no, order_date,
          round_off, payable_amount)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $12, 'Pending', $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id`,
      [
        invoice_number,
        body.customer_id ?? null,
        body.invoice_date ?? null,
        body.due_date ?? null,
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
        body.description ?? null,
        body.bill_percentage ?? 100,
        body.dc_no ?? null,
        body.dc_date ?? null,
        body.order_no ?? null,
        body.order_date ?? null,
        body.round_off ?? 0,
        body.payable_amount ?? body.grand_total,
      ]
    );

    const invoiceId = invoiceInsertRes.rows[0].id;

    // Loop through individual line item objects using positional assignments
    for (const item of body.items) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, sl_no, particulars, hsn_sac, qty, unit, rate,
            tax_percent, cgst_percent, sgst_percent, igst_percent, tax_amount, line_total)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          invoiceId,
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

    if (body.customer_id) {
      // Step 1: Advance outstanding total parameters inside customer records
      await client.query(
        `UPDATE customers 
         SET outstanding = outstanding + $1, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
         WHERE id = $2`,
        [body.grand_total, body.customer_id]
      );

      // Step 2: Extract party profile name directly for matching ledger descriptions
      const custCheck = await client.query(`SELECT name FROM customers WHERE id = $1`, [body.customer_id]);
      const partyName = custCheck.rows[0]?.name || "Unknown Customer";

      // Step 3: Append matching records directly onto the primary ledger pipeline
      await client.query(
        `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit)
         VALUES (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 'Receivable', $1, 'INVOICE', $2, $3, $4, 0)`,
        [
          partyName,
          invoiceId,
          `Invoice ${invoice_number} raised`,
          body.grand_total
        ]
      );
    }

    await client.query("COMMIT");

    const createdRes = await db.query(
      `SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.id=$1`,
      [invoiceId]
    );

    await writeLog("CREATE_INVOICE", `Invoice ${invoice_number} created. Grand Total: ₹${body.grand_total}`);

    return NextResponse.json({ success: true, data: createdRes.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
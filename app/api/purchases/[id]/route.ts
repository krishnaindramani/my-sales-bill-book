import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const purchaseId = Number(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ success: false, error: "Invalid purchase id" }, { status: 400 });
    }

    // Execute core bill details lookup and sequential line item data parsing concurrently
    const [billRes, itemsRes] = await Promise.all([
      db.query(`SELECT * FROM purchase_bills WHERE id = $1`, [purchaseId]),
      db.query(`SELECT * FROM purchase_items WHERE purchase_id = $1 ORDER BY sl_no ASC`, [purchaseId])
    ]);

    const bill = billRes.rows[0];
    if (!bill) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...bill, items: itemsRes.rows } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const client = await db.connect();
  try {
    const { id } = await params;
    const purchaseId = Number(id);
    const body: { status?: string } = await req.json();

    if (isNaN(purchaseId)) {
      return NextResponse.json({ success: false, error: "Invalid purchase id" }, { status: 400 });
    }

    await client.query("BEGIN");

    if (body.status === "Paid") {
      const billRes = await client.query(
        `SELECT grand_total, vendor_name, bill_number FROM purchase_bills WHERE id = $1`, 
        [purchaseId]
      );
      const bill = billRes.rows[0] as { grand_total: number; vendor_name: string; bill_number: string | null } | undefined;

      await client.query(
        `UPDATE purchase_bills 
         SET status = 'Paid', amount_paid = grand_total, balance_due = 0, 
             updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
         WHERE id = $1`,
        [purchaseId]
      );

      if (bill) {
        const descriptionLabel = `Purchase payment - Bill #${bill.bill_number ?? purchaseId}`;
        
        await client.query(
          `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit) 
           VALUES (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 'Cash', $1, 'PURCHASE', $2, $3, $4, 0)`,
          [
            bill.vendor_name ?? "Unknown Vendor",
            purchaseId,
            descriptionLabel,
            bill.grand_total
          ]
        );

        await writeLog("PAY_PURCHASE", `Purchase bill ${bill.bill_number ?? purchaseId} from ${bill.vendor_name} marked Paid.`);
      }
    } else if (body.status) {
      const billNumberRes = await client.query(`SELECT bill_number FROM purchase_bills WHERE id = $1`, [purchaseId]);
      const billNumber = billNumberRes.rows[0]?.bill_number ?? purchaseId;

      await client.query(
        `UPDATE purchase_bills 
         SET status = $1, updated_at = TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') 
         WHERE id = $2`,
        [body.status, purchaseId]
      );
      
      await writeLog("UPDATE_PURCHASE", `Purchase bill ${billNumber} status → ${body.status}.`);
    }

    await client.query("COMMIT");

    const updatedRes = await db.query(`SELECT * FROM purchase_bills WHERE id = $1`, [purchaseId]);
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
    const purchaseId = Number(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ success: false, error: "Invalid purchase id" }, { status: 400 });
    }

    const checkRes = await db.query(`SELECT vendor_name, bill_number FROM purchase_bills WHERE id = $1`, [purchaseId]);
    const bill = checkRes.rows[0] as { vendor_name: string; bill_number: string } | undefined;

    // Table foreign key profiles automatically handle cascading deletion for row item children
    await db.query(`DELETE FROM purchase_bills WHERE id = $1`, [purchaseId]);
    await writeLog("DELETE_PURCHASE", `Purchase bill ${bill?.bill_number ?? id} from ${bill?.vendor_name ?? "Unknown"} deleted.`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
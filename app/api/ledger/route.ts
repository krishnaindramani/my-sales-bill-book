import { NextRequest, NextResponse } from "next/server";
import { db, writeLog } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account = searchParams.get("account");
    const party = searchParams.get("party");

    let query = `SELECT * FROM ledger_entries`;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCounter = 1;

    if (account) {
      conditions.push(`account_head = $${paramCounter}`);
      params.push(account);
      paramCounter++;
    }
    if (party) {
      conditions.push(`party_name ILIKE $${paramCounter}`);
      params.push(`%${party}%`); // ILIKE provides case-insensitive filtering on PostgreSQL
      paramCounter++;
    }

    if (conditions.length) {
      query += ` WHERE ` + conditions.join(" AND ");
    }
    query += ` ORDER BY created_at DESC`;

    // Process listing queries and structural math calculations in parallel
    const [entriesRes, summaryRes] = await Promise.all([
      db.query(query, params),
      db.query(
        `SELECT COALESCE(SUM(debit), 0)::double precision as total_debit, 
                COALESCE(SUM(credit), 0)::double precision as total_credit 
         FROM ledger_entries`
      )
    ]);

    return NextResponse.json({ 
      success: true, 
      data: entriesRes.rows, 
      summary: summaryRes.rows[0] 
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const insertResult = await db.query(
      `INSERT INTO ledger_entries (entry_date, account_head, party_name, ref_type, ref_id, description, debit, credit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.entry_date ?? null,
        body.account_head ?? null,
        body.party_name ?? null,
        body.ref_type ?? "MANUAL",
        body.ref_id ?? null,
        body.description ?? null,
        body.debit ?? 0,
        body.credit ?? 0,
      ]
    );

    const created = insertResult.rows[0];
    await writeLog(
      "CREATE_LEDGER", 
      `Manual ledger entry: ${body.description ?? ""} Dr:${body.debit ?? 0} Cr:${body.credit ?? 0}`
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const ledgerId = Number(id);

    if (!id || isNaN(ledgerId)) {
      return NextResponse.json({ success: false, error: "Valid id required" }, { status: 400 });
    }

    const checkRes = await db.query(`SELECT description FROM ledger_entries WHERE id = $1`, [ledgerId]);
    const entry = checkRes.rows[0] as { description: string } | undefined;

    await db.query(`DELETE FROM ledger_entries WHERE id = $1`, [ledgerId]);
    await writeLog("DELETE_LEDGER", `Ledger entry ${id} deleted: ${entry?.description ?? ""}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const search = searchParams.get("search");

    let query = `SELECT * FROM activity_logs`;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCounter = 1;

    if (action && action !== "All") {
      conditions.push(`action_type = $${paramCounter}`);
      params.push(action);
      paramCounter++;
    }
    if (search) {
      conditions.push(`description ILIKE $${paramCounter}`);
      params.push(`%${search}%`); // ILIKE provides case-insensitive filtering on PostgreSQL
      paramCounter++;
    }

    if (conditions.length) {
      query += ` WHERE ` + conditions.join(" AND ");
    }
    query += ` ORDER BY timestamp DESC LIMIT 500`;

    // Process logs fetch and count calculation concurrently over the connection pool
    const [logsRes, totalRes] = await Promise.all([
      db.query(query, params),
      db.query(`SELECT COUNT(*)::integer as cnt FROM activity_logs`)
    ]);

    return NextResponse.json({ 
      success: true, 
      data: logsRes.rows, 
      total: totalRes.rows[0].cnt 
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.query(`DELETE FROM activity_logs`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
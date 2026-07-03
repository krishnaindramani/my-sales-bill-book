import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DashboardStats, MonthlyData } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fire off basic metrics and time-series aggregation requests concurrently over the cloud link
    const [
      totalInvoicesRes,
      pendingInvoicesRes,
      totalCustomersRes,
      totalRevenueRes,
      totalOutstandingRes,
      monthlyRowsRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::integer as cnt FROM invoices`),
      db.query(`SELECT COUNT(*)::integer as cnt FROM invoices WHERE status IN ('Pending','Draft')`),
      db.query(`SELECT COUNT(*)::integer as cnt FROM customers`),
      db.query(`SELECT COALESCE(SUM(grand_total), 0)::double precision as total FROM invoices WHERE status='Paid'`),
      db.query(`SELECT COALESCE(SUM(balance_due), 0)::double precision as total FROM invoices WHERE status IN ('Pending','Draft')`),
      db.query(`
        SELECT
          TO_CHAR(COALESCE(invoice_date, created_at)::timestamp, 'YYYY-MM') as month,
          COUNT(*)::integer as invoices,
          COALESCE(SUM(grand_total), 0)::double precision as revenue,
          COALESCE(SUM(CASE WHEN status='Paid' THEN grand_total ELSE 0 END), 0)::double precision as paid
        FROM invoices
        WHERE COALESCE(invoice_date, created_at)::timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
        GROUP BY TO_CHAR(COALESCE(invoice_date, created_at)::timestamp, 'YYYY-MM')
        ORDER BY month ASC
      `)
    ]);

    const totalInvoices = totalInvoicesRes.rows[0].cnt;
    const pendingInvoices = pendingInvoicesRes.rows[0].cnt;
    const totalCustomers = totalCustomersRes.rows[0].cnt;
    const totalRevenue = totalRevenueRes.rows[0].total;
    const totalOutstanding = totalOutstandingRes.rows[0].total;
    const monthlyRows = monthlyRowsRes.rows as { month: string; invoices: number; revenue: number; paid: number }[];

    // Map monthly datasets securely
    const monthlyMap: Record<string, MonthlyData> = {};
    for (const row of monthlyRows) {
      if (!row.month) continue;
      const [y, m] = row.month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en-IN", {
        month: "short",
        year: "2-digit",
      });
      monthlyMap[row.month] = {
        month: label,
        invoices: row.invoices,
        revenue: parseFloat(row.revenue.toFixed(2)),
        paid: parseFloat(row.paid.toFixed(2)),
      };
    }

    // Generate balanced timeline matrix for the past 12 trailing months
    const monthlyData: MonthlyData[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[key]) {
        monthlyData.push(monthlyMap[key]);
      } else {
        monthlyData.push({
          month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
          invoices: 0,
          revenue: 0,
          paid: 0,
        });
      }
    }

    const stats: DashboardStats = {
      totalInvoices,
      pendingInvoices,
      totalCustomers,
      totalRevenue,
      totalOutstanding,
      monthlyData,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
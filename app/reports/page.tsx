"use client";

import { useEffect, useState } from "react";
import { RefreshCw, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface SalesSummary { month: string; invoices: number; subtotal: number; total_tax: number; grand_total: number; paid: number; outstanding: number; }
interface PurchaseSummary { month: string; bills: number; grand_total: number; paid: number; }
interface CustomerSummary { customer_name: string; invoice_count: number; total_billed: number; total_paid: number; outstanding: number; }

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a78bfa"];

function fmtMoney(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 6, fontSize: 12 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {typeof p.value === "number" && p.value > 100 ? fmtMoney(p.value) : p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"sales" | "purchases" | "customers">("sales");
  const [salesData, setSalesData] = useState<SalesSummary[]>([]);
  const [purchaseData, setPurchaseData] = useState<PurchaseSummary[]>([]);
  const [customerData, setCustomerData] = useState<CustomerSummary[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [invRes, purRes, custRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/purchases"),
        fetch("/api/customers"),
      ]);
      const [invJson, purJson, custJson] = await Promise.all([invRes.json(), purRes.json(), custRes.json()]);

      // Process sales data monthly
      if (invJson.success) {
        const monthMap: Record<string, SalesSummary> = {};
        for (const inv of invJson.data) {
          const dateStr = inv.invoice_date || inv.created_at?.slice(0, 10) || "";
          if (!dateStr || dateStr < dateFrom || dateStr > dateTo) continue;
          const month = dateStr.slice(0, 7);
          if (!monthMap[month]) {
            const label = new Date(month + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" });
            monthMap[month] = { month: label, invoices: 0, subtotal: 0, total_tax: 0, grand_total: 0, paid: 0, outstanding: 0 };
          }
          monthMap[month].invoices++;
          monthMap[month].subtotal += inv.subtotal ?? 0;
          monthMap[month].total_tax += inv.total_tax ?? 0;
          monthMap[month].grand_total += inv.grand_total ?? 0;
          if (inv.status === "Paid") monthMap[month].paid += inv.grand_total ?? 0;
          else monthMap[month].outstanding += inv.balance_due ?? 0;
        }
        setSalesData(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));
      }

      // Process purchase data monthly
      if (purJson.success) {
        const purMap: Record<string, PurchaseSummary> = {};
        for (const bill of purJson.data) {
          const dateStr = bill.bill_date || bill.created_at?.slice(0, 10) || "";
          if (!dateStr || dateStr < dateFrom || dateStr > dateTo) continue;
          const month = dateStr.slice(0, 7);
          if (!purMap[month]) {
            const label = new Date(month + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" });
            purMap[month] = { month: label, bills: 0, grand_total: 0, paid: 0 };
          }
          purMap[month].bills++;
          purMap[month].grand_total += bill.grand_total ?? 0;
          if (bill.status === "Paid") purMap[month].paid += bill.grand_total ?? 0;
        }
        setPurchaseData(Object.values(purMap).sort((a, b) => a.month.localeCompare(b.month)));
      }

      // Process per-customer summary
      if (custJson.success && invJson.success) {
        const custMap: Record<number, CustomerSummary> = {};
        for (const inv of invJson.data) {
          const cid = inv.customer_id;
          if (!cid) continue;
          const dateStr = inv.invoice_date || inv.created_at?.slice(0, 10) || "";
          if (!dateStr || dateStr < dateFrom || dateStr > dateTo) continue;
          if (!custMap[cid]) {
            const cust = custJson.data.find((c: { id: number; name: string }) => c.id === cid);
            custMap[cid] = { customer_name: cust?.name ?? "Unknown", invoice_count: 0, total_billed: 0, total_paid: 0, outstanding: 0 };
          }
          custMap[cid].invoice_count++;
          custMap[cid].total_billed += inv.grand_total ?? 0;
          custMap[cid].total_paid += inv.amount_paid ?? 0;
          custMap[cid].outstanding += inv.balance_due ?? 0;
        }
        setCustomerData(Object.values(custMap).sort((a, b) => b.total_billed - a.total_billed));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const totalSales = salesData.reduce((s, r) => s + r.grand_total, 0);
  const totalTax = salesData.reduce((s, r) => s + r.total_tax, 0);
  const totalPurchases = purchaseData.reduce((s, r) => s + r.grand_total, 0);
  const netProfit = totalSales - totalTax - totalPurchases;

  const pieData = salesData.map((d) => ({ name: d.month, value: parseFloat(d.grand_total.toFixed(2)) }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Sales, purchases and customer breakdowns</p>
        </div>
        <button className="btn-ghost" onClick={load}><RefreshCw size={13} /></button>
      </div>

      <div className="page-body">
        {/* Date Range */}
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 13, fontWeight: 600 }}>Date Range:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" className="input" style={{ width: 150 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span style={{ color: "var(--color-text-muted)" }}>to</span>
              <input type="date" className="input" style={{ width: 150 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {loading && <RefreshCw size={14} className="spin-slow" style={{ color: "var(--color-accent)" }} />}
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          {[
            { label: "Total Sales", val: fmtMoney(totalSales), color: "var(--color-accent)" },
            { label: "Total Tax Collected", val: fmtMoney(totalTax), color: "var(--color-amber)" },
            { label: "Total Purchases", val: fmtMoney(totalPurchases), color: "var(--color-red)" },
            { label: "Net (Sales − Tax − Purchases)", val: fmtMoney(netProfit), color: netProfit >= 0 ? "var(--color-green)" : "var(--color-red)" },
          ].map((k) => (
            <div key={k.label} className="stat-card">
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["sales", "purchases", "customers"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: "var(--radius-md)",
              fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid",
              background: tab === t ? "var(--color-accent)" : "var(--color-surface-2)",
              color: tab === t ? "#fff" : "var(--color-text-secondary)",
              borderColor: tab === t ? "var(--color-accent)" : "var(--color-border)",
              textTransform: "capitalize",
            }}>{t === "customers" ? "Customer Wise" : t === "purchases" ? "Purchases" : "Sales"}</button>
          ))}
        </div>

        {/* Sales Tab */}
        {tab === "sales" && (
          <>
            <div className="card" style={{ padding: "18px 18px 10px" }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Sales Breakdown</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={salesData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => "₹" + (v / 1000).toFixed(0) + "K"} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="subtotal" name="Taxable Value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="total_tax" name="Tax" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="paid" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th><th style={{ textAlign: "right" }}>Invoices</th>
                    <th style={{ textAlign: "right" }}>Taxable Value</th><th style={{ textAlign: "right" }}>Tax</th>
                    <th style={{ textAlign: "right" }}>Grand Total</th><th style={{ textAlign: "right" }}>Collected</th>
                    <th style={{ textAlign: "right" }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>No sales in selected range</td></tr>
                  ) : (
                    <>
                      {salesData.map((r) => (
                        <tr key={r.month}>
                          <td style={{ fontWeight: 600 }}>{r.month}</td>
                          <td style={{ textAlign: "right" }}>{r.invoices}</td>
                          <td style={{ textAlign: "right" }}>{fmtMoney(r.subtotal)}</td>
                          <td style={{ textAlign: "right", color: "var(--color-amber)" }}>{fmtMoney(r.total_tax)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(r.grand_total)}</td>
                          <td style={{ textAlign: "right", color: "var(--color-green)" }}>{fmtMoney(r.paid)}</td>
                          <td style={{ textAlign: "right", color: r.outstanding > 0 ? "var(--color-amber)" : "var(--color-text-muted)" }}>{fmtMoney(r.outstanding)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--color-border)", background: "var(--color-surface-2)" }}>
                        <td style={{ fontWeight: 800 }}>TOTAL</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{salesData.reduce((s, r) => s + r.invoices, 0)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(salesData.reduce((s, r) => s + r.subtotal, 0))}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-amber)" }}>{fmtMoney(totalTax)}</td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--color-accent-glow)" }}>{fmtMoney(totalSales)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-green)" }}>{fmtMoney(salesData.reduce((s, r) => s + r.paid, 0))}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-amber)" }}>{fmtMoney(salesData.reduce((s, r) => s + r.outstanding, 0))}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Purchases Tab */}
        {tab === "purchases" && (
          <>
            <div className="card" style={{ padding: "18px 18px 10px" }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Purchase Trend</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={purchaseData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => "₹" + (v / 1000).toFixed(0) + "K"} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="grand_total" name="Total Purchases" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th><th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Total Amount</th><th style={{ textAlign: "right" }}>Paid</th>
                    <th style={{ textAlign: "right" }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseData.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>No purchases in selected range</td></tr>
                  ) : (
                    purchaseData.map((r) => (
                      <tr key={r.month}>
                        <td style={{ fontWeight: 600 }}>{r.month}</td>
                        <td style={{ textAlign: "right" }}>{r.bills}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(r.grand_total)}</td>
                        <td style={{ textAlign: "right", color: "var(--color-green)" }}>{fmtMoney(r.paid)}</td>
                        <td style={{ textAlign: "right", color: "var(--color-amber)" }}>{fmtMoney(r.grand_total - r.paid)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Customer Wise Tab */}
        {tab === "customers" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card" style={{ padding: "18px 18px 10px" }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Sales by Customer</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData.slice(0, 6)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={(props) => `${props.name ?? ""} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Top Customers by Revenue</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {customerData.slice(0, 6).map((c, i) => (
                    <div key={c.customer_name} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length] + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: PIE_COLORS[i % PIE_COLORS.length] }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.customer_name}</p>
                        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.invoice_count} invoices</p>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: PIE_COLORS[i % PIE_COLORS.length] }}>{fmtMoney(c.total_billed)}</span>
                    </div>
                  ))}
                  {customerData.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No customer data in range</p>}
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Customer</th><th style={{ textAlign: "right" }}>Invoices</th>
                    <th style={{ textAlign: "right" }}>Total Billed</th><th style={{ textAlign: "right" }}>Total Paid</th>
                    <th style={{ textAlign: "right" }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {customerData.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>No customer invoice data</td></tr>
                  ) : (
                    customerData.map((c, i) => (
                      <tr key={c.customer_name}>
                        <td style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                        <td style={{ textAlign: "right" }}>{c.invoice_count}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(c.total_billed)}</td>
                        <td style={{ textAlign: "right", color: "var(--color-green)" }}>{fmtMoney(c.total_paid)}</td>
                        <td style={{ textAlign: "right", color: c.outstanding > 0 ? "var(--color-amber)" : "var(--color-text-muted)", fontWeight: c.outstanding > 0 ? 700 : 400 }}>{fmtMoney(c.outstanding)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

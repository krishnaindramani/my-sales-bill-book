"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, CheckCircle, Trash2, ShoppingCart } from "lucide-react";
import { PurchaseBill, PurchaseStatus } from "@/types";

function statusBadge(status: PurchaseStatus) {
  const map: Record<PurchaseStatus, string> = { Pending: "badge badge-amber", Paid: "badge badge-green", Partial: "badge badge-blue" };
  return <span className={map[status] ?? "badge badge-gray"}>{status}</span>;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 }); }
function buildPeriodOptions() {
  const opts = [{ label: "All Time", value: "" }];
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) opts.push({ label: `Year ${y}`, value: `year:${y}` });
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ label: d.toLocaleString("en-IN", { month: "short", year: "numeric" }), value: `month:${key}` });
  }
  return opts;
}
const PERIOD_OPTIONS = buildPeriodOptions();
const STATUSES: Array<"All" | PurchaseStatus> = ["All", "Pending", "Paid", "Partial"];
interface UndoState { id: number; timer: ReturnType<typeof setTimeout>; countdown: number; }

export default function ViewPurchasesPage() {
  const router = useRouter();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | PurchaseStatus>("All");
  const [periodFilter, setPeriodFilter] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/purchases");
    const json = await res.json();
    if (json.success) setBills(json.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => () => {
    if (undoState) clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [undoState]);

  async function markPaid(id: number) {
    setActing(id);
    await fetch(`/api/purchases/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Paid" }) });
    setActing(null);
    load();
  }

  function del(id: number) {
    if (undoState) {
      clearTimeout(undoState.timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (undoState.id !== id) fetch(`/api/purchases/${undoState.id}`, { method: "DELETE" });
    }
    setBills(prev => prev.filter(b => b.id !== id));
    let countdown = 5;
    const timer = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch(`/api/purchases/${id}`, { method: "DELETE" });
      setUndoState(null);
    }, 5000);
    countdownRef.current = setInterval(() => {
      countdown--;
      setUndoState(prev => prev ? { ...prev, countdown } : null);
      if (countdown <= 0 && countdownRef.current) clearInterval(countdownRef.current);
    }, 1000);
    setUndoState({ id, timer, countdown: 5 });
  }

  function handleUndo() {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setUndoState(null);
    load();
  }

  function matchesPeriod(b: PurchaseBill) {
    if (!periodFilter) return true;
    const dateStr = (b.bill_date ?? b.created_at ?? "").slice(0, 10);
    if (periodFilter.startsWith("year:"))  return dateStr.startsWith(periodFilter.slice(5));
    if (periodFilter.startsWith("month:")) return dateStr.startsWith(periodFilter.slice(6));
    return true;
  }

  const filtered = bills.filter(b => (filter === "All" || b.status === filter) && matchesPeriod(b));
  const totalPending = bills.filter(b => b.status === "Pending").reduce((s, b) => s + b.balance_due, 0);

  return (
    <div>
      {undoState && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", alignItems: "center", gap: 14, background: "#1e293b", color: "#fff", padding: "14px 22px", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", border: "1px solid #334155", fontSize: 14, fontWeight: 500 }}>
          <span>🗑 Purchase bill deleted.</span>
          <button onClick={handleUndo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Undo ({undoState.countdown}s)</button>
        </div>
      )}

      <div className="page-header">
        <div><h1 className="page-title">Purchase Bills</h1><p className="page-subtitle">Track vendor invoices and payables</p></div>
        <button className="btn-primary" onClick={() => router.push("/account/purchase/new")}><Plus size={15} /> Add Purchase Bill</button>
      </div>

      <div className="page-body">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[{ label: "Total Bills", val: bills.length.toString() }, { label: "Total Value", val: fmtMoney(bills.reduce((s,b) => s+b.grand_total,0)) }, { label: "Pending Payment", val: fmtMoney(totalPending), color: "var(--color-amber)" }].map(s => (
            <div key={s.label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-muted)" }}>{s.label}: </span>
              <span style={{ fontWeight: 700, color: s.color ?? "var(--color-text-primary)" }}>{s.val}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid", background: filter === s ? "var(--color-accent)" : "var(--color-surface-2)", color: filter === s ? "#fff" : "var(--color-text-secondary)", borderColor: filter === s ? "var(--color-accent)" : "var(--color-border)" }}>{s}</button>
          ))}
          <select className="select" style={{ width: "auto", minWidth: 150 }} value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn-ghost" onClick={load}><RefreshCw size={13} /></button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Bill #</th><th>Bill Date</th><th>Due Date</th><th style={{ textAlign:"right" }}>Subtotal</th><th style={{ textAlign:"right" }}>Tax</th><th style={{ textAlign:"right" }}>Grand Total</th><th style={{ textAlign:"right" }}>Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign:"center", padding:40 }}><RefreshCw size={18} className="spin-slow" style={{ display:"inline", color:"var(--color-accent)" }} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign:"center", padding:48 }}>
                  <ShoppingCart size={32} style={{ color:"var(--color-text-muted)", margin:"0 auto 10px", display:"block" }} />
                  <p style={{ color:"var(--color-text-muted)" }}>No purchase bills yet</p>
                  <button className="btn-primary" style={{ marginTop:14 }} onClick={() => router.push("/account/purchase/new")}><Plus size={14} /> Add First Purchase</button>
                </td></tr>
              ) : (
                filtered.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight:600 }}>{b.vendor_name ?? "—"}</td>
                    <td><span style={{ fontFamily:"monospace", fontSize:12 }}>{b.vendor_gstin ?? "—"}</span></td>
                    <td style={{ fontFamily:"monospace", fontSize:12 }}>{b.bill_number ?? "—"}</td>
                    <td>{fmtDate(b.bill_date)}</td>
                    <td style={{ color: b.due_date && new Date(b.due_date) < new Date() && b.status !== "Paid" ? "var(--color-red)" : "inherit" }}>{fmtDate(b.due_date)}</td>
                    <td style={{ textAlign:"right" }}>{fmtMoney(b.subtotal)}</td>
                    <td style={{ textAlign:"right", color:"var(--color-amber)" }}>{fmtMoney(b.total_tax)}</td>
                    <td style={{ textAlign:"right", fontWeight:700 }}>{fmtMoney(b.grand_total)}</td>
                    <td style={{ textAlign:"right", color: b.balance_due > 0 ? "var(--color-amber)" : "var(--color-text-muted)", fontWeight: b.balance_due > 0 ? 700 : 400 }}>{fmtMoney(b.balance_due)}</td>
                    <td>{statusBadge(b.status)}</td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        {b.status !== "Paid" && <button className="btn-ghost" title="Mark Paid" style={{ padding:5, color:"var(--color-green)" }} disabled={acting === b.id} onClick={() => markPaid(b.id)}><CheckCircle size={13} /></button>}
                        <button className="btn-ghost" title="Delete" style={{ padding:5, color:"var(--color-red)" }} onClick={() => del(b.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

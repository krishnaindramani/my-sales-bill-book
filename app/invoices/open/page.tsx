"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, CheckCircle, XCircle, RefreshCw, Eye, Trash2, FileText } from "lucide-react";
import { Invoice, InvoiceStatus } from "@/types";

function statusBadge(status: InvoiceStatus) {
  const map: Record<InvoiceStatus, string> = { Draft: "badge badge-gray", Pending: "badge badge-amber", Paid: "badge badge-green", Cancelled: "badge badge-red" };
  return <span className={map[status]}>{status}</span>;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Generate month options for last 3 years
function buildMonthOptions(): { label: string; value: string }[] {
  const opts: { label: string; value: string }[] = [{ label: "All Time", value: "" }];
  const now = new Date();
  // yearly options
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    opts.push({ label: `Year ${y}`, value: `year:${y}` });
  }
  // monthly options
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
    opts.push({ label, value: `month:${key}` });
  }
  return opts;
}

interface UndoState { id: number; timer: ReturnType<typeof setTimeout>; countdown: number; }

const STATUSES: Array<InvoiceStatus | "All"> = ["All", "Draft", "Pending", "Paid", "Cancelled"];
const MONTH_OPTIONS = buildMonthOptions();

export default function OpenInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [periodFilter, setPeriodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const url = statusFilter !== "All" ? `/api/invoices?status=${statusFilter}` : "/api/invoices";
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setInvoices(json.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (undoState) clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [undoState]);

  async function markPaid(id: number) {
    setActionId(id);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_paid" }) });
    setActionId(null);
    load();
  }

  async function cancel(id: number) {
    if (!confirm("Cancel this invoice?")) return;
    setActionId(id);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Cancelled" }) });
    setActionId(null);
    load();
  }

  function deleteInv(id: number) {
    // Cancel any existing undo first
    if (undoState) {
      clearTimeout(undoState.timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
      // fire the previous pending delete immediately if different id
      if (undoState.id !== id) {
        fetch(`/api/invoices/${undoState.id}`, { method: "DELETE" });
      }
    }

    // Remove from UI immediately (optimistic)
    setInvoices(prev => prev.filter(inv => inv.id !== id));

    let countdown = 5;
    const timer = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch(`/api/invoices/${id}`, { method: "DELETE" });
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
    load(); // re-fetch to restore the record
  }

  // Period filter logic
  function matchesPeriod(inv: Invoice): boolean {
    if (!periodFilter) return true;
    const dateStr = (inv.invoice_date ?? inv.created_at ?? "").slice(0, 10);
    if (!dateStr) return false;
    if (periodFilter.startsWith("year:")) {
      return dateStr.startsWith(periodFilter.slice(5));
    }
    if (periodFilter.startsWith("month:")) {
      return dateStr.startsWith(periodFilter.slice(6));
    }
    return true;
  }

  const filtered = invoices.filter(inv => {
    if (!matchesPeriod(inv)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoice_number.toLowerCase().includes(q) || (inv.customer_name ?? "").toLowerCase().includes(q);
  });

  const total = filtered.reduce((s, i) => s + i.grand_total, 0);
  const outstanding = filtered.filter(i => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + i.balance_due, 0);

  return (
    <div>
      {/* Undo Toast */}
      {undoState && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 999, display: "flex", alignItems: "center", gap: 14,
          background: "#1e293b", color: "#fff", padding: "14px 22px",
          borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid #334155", fontSize: 14, fontWeight: 500,
          animation: "fadeInUp 0.2s ease-out",
        }}>
          <span>🗑 Record deleted.</span>
          <button onClick={handleUndo} style={{
            background: "#6366f1", color: "#fff", border: "none", borderRadius: 7,
            padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13,
          }}>Undo ({undoState.countdown}s)</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Open Invoices</h1>
          <p className="page-subtitle">Browse, filter and manage all bills</p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/invoices/new")}>
          <Plus size={15} /> New Invoice
        </button>
      </div>

      <div className="page-body">
        {/* Summary */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Showing", val: filtered.length + " invoices" },
            { label: "Total Billed", val: fmtMoney(total) },
            { label: "Outstanding",  val: fmtMoney(outstanding), color: "var(--color-amber)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-muted)" }}>{s.label}: </span>
              <span style={{ fontWeight: 700, color: s.color ?? "var(--color-text-primary)" }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Search invoice # or customer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Period dropdown */}
          <select className="select" style={{ width: "auto", minWidth: 150 }} value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
            {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* Status tabs */}
          <div style={{ display: "flex", gap: 6 }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "6px 14px", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid",
                background: statusFilter === s ? "var(--color-accent)" : "var(--color-surface-2)",
                color: statusFilter === s ? "#fff" : "var(--color-text-secondary)",
                borderColor: statusFilter === s ? "var(--color-accent)" : "var(--color-border)",
              }}>{s}</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={load}><RefreshCw size={13} /></button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Business Name</th><th>Date</th><th>Due Date</th>
                <th>Grand Total</th><th>Paid</th><th>Balance</th><th>Tax</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: 40 }}>
                  <RefreshCw size={18} className="spin-slow" style={{ display: "inline", color: "var(--color-accent)" }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: 48 }}>
                  <FileText size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 10px", display: "block" }} />
                  <p style={{ color: "var(--color-text-muted)" }}>No invoices found</p>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => router.push("/invoices/new")}><Plus size={14} /> Create First Invoice</button>
                </td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id}>
                    <td><span style={{ fontWeight: 700, color: "var(--color-accent-glow)", fontFamily: "monospace", fontSize: 13 }}>{inv.invoice_number}</span></td>
                    <td style={{ fontWeight: 500 }}>{(inv as Invoice & { customer_company?: string }).customer_company || inv.customer_name || <span style={{ color: "var(--color-text-muted)" }}>Walk-in</span>}</td>
                    <td>{fmtDate(inv.invoice_date)}</td>
                    <td style={{ color: inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "Paid" ? "var(--color-red)" : "inherit" }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtMoney(inv.grand_total)}</td>
                    <td style={{ color: "var(--color-green)" }}>{fmtMoney(inv.amount_paid)}</td>
                    <td style={{ color: inv.balance_due > 0 ? "var(--color-amber)" : "var(--color-text-muted)", fontWeight: inv.balance_due > 0 ? 700 : 400 }}>{fmtMoney(inv.balance_due)}</td>
                    <td><span style={{ fontSize: 12, color: inv.tax_type === "IGST" ? "var(--color-amber)" : "var(--color-green)" }}>{inv.tax_type === "IGST" ? "IGST" : "CGST+SGST"}</span></td>
                    <td>{statusBadge(inv.status)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-ghost" title="View" style={{ padding: 5 }} onClick={() => router.push(`/invoices/${inv.id}`)}><Eye size={13} /></button>
                        {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                          <button className="btn-ghost" title="Mark Paid" style={{ padding: 5, color: "var(--color-green)" }} disabled={actionId === inv.id} onClick={() => markPaid(inv.id)}><CheckCircle size={13} /></button>
                        )}
                        {inv.status !== "Cancelled" && inv.status !== "Paid" && (
                          <button className="btn-ghost" title="Cancel" style={{ padding: 5, color: "var(--color-amber)" }} disabled={actionId === inv.id} onClick={() => cancel(inv.id)}><XCircle size={13} /></button>
                        )}
                        <button className="btn-ghost" title="Delete" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => deleteInv(inv.id)}><Trash2 size={13} /></button>
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

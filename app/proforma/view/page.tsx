"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2, FileText } from "lucide-react";
import { Proforma, ProformaStatus } from "@/types";

function statusBadge(status: ProformaStatus) {
  const map: Record<ProformaStatus, string> = { Active: "badge badge-green", Converted: "badge badge-purple", Expired: "badge badge-gray" };
  return <span className={map[status]}>{status}</span>;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
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
const STATUSES: Array<"All" | ProformaStatus> = ["All", "Active", "Converted", "Expired"];
interface UndoState { id: number; timer: ReturnType<typeof setTimeout>; countdown: number; }

export default function ViewProformaPage() {
  const router = useRouter();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | ProformaStatus>("All");
  const [periodFilter, setPeriodFilter] = useState("");
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/proforma");
    const json = await res.json();
    if (json.success) setProformas(json.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => () => {
    if (undoState) clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [undoState]);

  async function updateStatus(id: number, status: ProformaStatus) {
    await fetch(`/api/proforma/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  function del(id: number) {
    if (undoState) {
      clearTimeout(undoState.timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (undoState.id !== id) fetch(`/api/proforma/${undoState.id}`, { method: "DELETE" });
    }
    setProformas(prev => prev.filter(p => p.id !== id));
    let countdown = 5;
    const timer = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch(`/api/proforma/${id}`, { method: "DELETE" });
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

  function matchesPeriod(p: Proforma) {
    if (!periodFilter) return true;
    const dateStr = (p.proforma_date ?? p.created_at ?? "").slice(0, 10);
    if (periodFilter.startsWith("year:"))  return dateStr.startsWith(periodFilter.slice(5));
    if (periodFilter.startsWith("month:")) return dateStr.startsWith(periodFilter.slice(6));
    return true;
  }

  const filtered = proformas.filter(p => (filter === "All" || p.status === filter) && matchesPeriod(p));

  return (
    <div>
      {undoState && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", alignItems: "center", gap: 14, background: "#1e293b", color: "#fff", padding: "14px 22px", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", border: "1px solid #334155", fontSize: 14, fontWeight: 500 }}>
          <span>🗑 Proforma deleted.</span>
          <button onClick={handleUndo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Undo ({undoState.countdown}s)</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Proforma Invoices</h1>
          <p className="page-subtitle">Manage provisional quotations and estimates</p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/proforma/new")}><Plus size={15} /> New Proforma</button>
      </div>

      <div className="page-body">
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
            <thead><tr><th>Proforma #</th><th>Customer</th><th>Date</th><th>Valid Until</th><th>Grand Total</th><th>Tax</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40 }}><RefreshCw size={18} className="spin-slow" style={{ display: "inline", color: "var(--color-accent)" }} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 48 }}>
                  <FileText size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 10px", display: "block" }} />
                  <p style={{ color: "var(--color-text-muted)" }}>No proformas yet</p>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => router.push("/proforma/new")}><Plus size={14} /> Create First Proforma</button>
                </td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id}>
                    <td><span style={{ fontWeight: 700, color: "var(--color-accent-glow)", fontFamily: "monospace", fontSize: 13 }}>{p.proforma_number}</span></td>
                    <td>{p.customer_name ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td>{fmtDate(p.proforma_date)}</td>
                    <td style={{ color: p.valid_until && new Date(p.valid_until) < new Date() && p.status === "Active" ? "var(--color-red)" : "inherit" }}>{fmtDate(p.valid_until)}</td>
                    <td style={{ fontWeight: 700 }}>₹{p.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td><span style={{ fontSize: 12, color: p.tax_type === "IGST" ? "var(--color-amber)" : "var(--color-green)" }}>{p.tax_type === "IGST" ? "IGST" : "CGST+SGST"}</span></td>
                    <td>{statusBadge(p.status)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {p.status === "Active" && <><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 12, color: "var(--color-green)" }} onClick={() => updateStatus(p.id, "Converted")}>Convert</button><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 12, color: "var(--color-text-muted)" }} onClick={() => updateStatus(p.id, "Expired")}>Expire</button></>}
                        <button className="btn-ghost" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => del(p.id)}><Trash2 size={13} /></button>
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

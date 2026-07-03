"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Truck, Trash2, CheckCircle, RotateCcw } from "lucide-react";
import { Challan, ChallanStatus } from "@/types";

function statusBadge(status: ChallanStatus) {
  const map: Record<ChallanStatus, string> = { Pending: "badge badge-amber", Delivered: "badge badge-green", Returned: "badge badge-red" };
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
const STATUSES: Array<"All" | ChallanStatus> = ["All", "Pending", "Delivered", "Returned"];
interface UndoState { id: number; timer: ReturnType<typeof setTimeout>; countdown: number; }

export default function ViewChallansPage() {
  const router = useRouter();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | ChallanStatus>("All");
  const [periodFilter, setPeriodFilter] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/challans");
    const json = await res.json();
    if (json.success) setChallans(json.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => () => {
    if (undoState) clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [undoState]);

  async function updateStatus(id: number, status: ChallanStatus) {
    setActing(id);
    await fetch(`/api/challans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setActing(null);
    load();
  }

  function del(id: number) {
    if (undoState) {
      clearTimeout(undoState.timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (undoState.id !== id) fetch(`/api/challans/${undoState.id}`, { method: "DELETE" });
    }
    setChallans(prev => prev.filter(c => c.id !== id));
    let countdown = 5;
    const timer = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch(`/api/challans/${id}`, { method: "DELETE" });
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

  function matchesPeriod(c: Challan) {
    if (!periodFilter) return true;
    const dateStr = (c.challan_date ?? c.created_at ?? "").slice(0, 10);
    if (periodFilter.startsWith("year:"))  return dateStr.startsWith(periodFilter.slice(5));
    if (periodFilter.startsWith("month:")) return dateStr.startsWith(periodFilter.slice(6));
    return true;
  }

  const filtered = challans.filter(c => (filter === "All" || c.status === filter) && matchesPeriod(c));

  return (
    <div>
      {undoState && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", alignItems: "center", gap: 14, background: "#1e293b", color: "#fff", padding: "14px 22px", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", border: "1px solid #334155", fontSize: 14, fontWeight: 500 }}>
          <span>🗑 Challan deleted.</span>
          <button onClick={handleUndo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Undo ({undoState.countdown}s)</button>
        </div>
      )}

      <div className="page-header">
        <div><h1 className="page-title">Delivery Challans</h1><p className="page-subtitle">Track goods dispatches and deliveries</p></div>
        <button className="btn-primary" onClick={() => router.push("/challan/new")}><Plus size={15} /> New Challan</button>
      </div>

      <div className="page-body">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[{ label: "Total", val: challans.length }, { label: "Pending", val: challans.filter(c => c.status === "Pending").length, color: "var(--color-amber)" }, { label: "Delivered", val: challans.filter(c => c.status === "Delivered").length, color: "var(--color-green)" }, { label: "Returned", val: challans.filter(c => c.status === "Returned").length, color: "var(--color-red)" }].map(s => (
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
            <thead><tr><th>Challan #</th><th>Customer</th><th>Date</th><th>Vehicle</th><th>Driver</th><th>Delivery Address</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40 }}><RefreshCw size={18} className="spin-slow" style={{ display: "inline", color: "var(--color-accent)" }} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 48 }}>
                  <Truck size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 10px", display: "block" }} />
                  <p style={{ color: "var(--color-text-muted)" }}>No challans found</p>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => router.push("/challan/new")}><Plus size={14} /> Create First Challan</button>
                </td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ fontWeight: 700, color: "var(--color-accent-glow)", fontFamily: "monospace", fontSize: 13 }}>{c.challan_number}</span></td>
                    <td>{c.customer_name ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td>{fmtDate(c.challan_date)}</td>
                    <td>{c.vehicle_number ? <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{c.vehicle_number}</span> : <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td>{c.driver_name ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: "var(--color-text-secondary)" }}>{c.delivery_address ?? "—"}</td>
                    <td>{statusBadge(c.status)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {c.status === "Pending" && <button className="btn-ghost" title="Mark Delivered" style={{ padding: 5, color: "var(--color-green)" }} disabled={acting === c.id} onClick={() => updateStatus(c.id, "Delivered")}><CheckCircle size={13} /></button>}
                        {c.status === "Delivered" && <button className="btn-ghost" title="Mark Returned" style={{ padding: 5, color: "var(--color-amber)" }} disabled={acting === c.id} onClick={() => updateStatus(c.id, "Returned")}><RotateCcw size={13} /></button>}
                        <button className="btn-ghost" title="Delete" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => del(c.id)}><Trash2 size={13} /></button>
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

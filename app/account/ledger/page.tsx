"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw, BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { LedgerEntry } from "@/types";

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number) { return n === 0 ? "—" : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 }); }

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
const ACCOUNT_HEADS = ["All", "Sales", "Purchase", "Receivable", "Cash", "Payable", "MANUAL"];

interface LedgerSummary { total_debit: number; total_credit: number; }
interface UndoState { id: number; timer: ReturnType<typeof setTimeout>; countdown: number; }

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({ total_debit: 0, total_credit: 0 });
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState("All");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ entry_date: new Date().toISOString().split("T")[0], account_head: "Manual", party_name: "", description: "", debit: "", credit: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (account !== "All") params.set("account", account);
    const res = await fetch(`/api/ledger?${params}`);
    const json = await res.json();
    if (json.success) { setEntries(json.data); setSummary(json.summary ?? { total_debit: 0, total_credit: 0 }); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [account]);
  useEffect(() => () => {
    if (undoState) clearTimeout(undoState.timer);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [undoState]);

  async function handleAddEntry() {
    setAddSaving(true);
    try {
      const res = await fetch("/api/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_date: addForm.entry_date || null, account_head: addForm.account_head || "Manual", party_name: addForm.party_name || null, ref_type: "MANUAL", description: addForm.description || null, debit: parseFloat(addForm.debit) || 0, credit: parseFloat(addForm.credit) || 0 }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowAddModal(false);
      setAddForm({ entry_date: new Date().toISOString().split("T")[0], account_head: "Manual", party_name: "", description: "", debit: "", credit: "" });
      load();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setAddSaving(false); }
  }

  function delEntry(id: number) {
    if (undoState) {
      clearTimeout(undoState.timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (undoState.id !== id) fetch(`/api/ledger?id=${undoState.id}`, { method: "DELETE" });
    }
    setEntries(prev => prev.filter(e => e.id !== id));
    let countdown = 5;
    const timer = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch(`/api/ledger?id=${id}`, { method: "DELETE" });
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

  function matchesPeriod(e: LedgerEntry) {
    if (!periodFilter) return true;
    const dateStr = (e.entry_date ?? e.created_at ?? "").slice(0, 10);
    if (periodFilter.startsWith("year:"))  return dateStr.startsWith(periodFilter.slice(5));
    if (periodFilter.startsWith("month:")) return dateStr.startsWith(periodFilter.slice(6));
    return true;
  }

  const filtered = entries.filter(e => {
    if (!matchesPeriod(e)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.party_name ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q) || (e.account_head ?? "").toLowerCase().includes(q);
  });

  const withBalance = [...filtered].reverse().reduce<Array<LedgerEntry & { running: number }>>((acc, entry, i) => {
    const prev = i === 0 ? 0 : acc[i - 1].running;
    return [...acc, { ...entry, running: parseFloat((prev + entry.debit - entry.credit).toFixed(2)) }];
  }, []).reverse();

  const netBalance = summary.total_debit - summary.total_credit;

  return (
    <div>
      {undoState && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", alignItems: "center", gap: 14, background: "#1e293b", color: "#fff", padding: "14px 22px", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", border: "1px solid #334155", fontSize: 14, fontWeight: 500 }}>
          <span>🗑 Ledger entry deleted.</span>
          <button onClick={handleUndo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Undo ({undoState.countdown}s)</button>
        </div>
      )}

      <div className="page-header">
        <div><h1 className="page-title">Ledger</h1><p className="page-subtitle">Full double-entry accounting journal</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={() => setShowAddModal(true)}><Plus size={14} /> Manual Entry</button>
          <button className="btn-ghost" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          {[{ label: "Total Debit (Dr)", val: "₹" + summary.total_debit.toLocaleString("en-IN", { minimumFractionDigits: 2 }), color: "var(--color-accent)" }, { label: "Total Credit (Cr)", val: "₹" + summary.total_credit.toLocaleString("en-IN", { minimumFractionDigits: 2 }), color: "var(--color-green)" }, { label: "Net Balance", val: "₹" + netBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 }), color: netBalance >= 0 ? "var(--color-accent)" : "var(--color-red)" }, { label: "Total Entries", val: entries.length.toString(), color: "var(--color-text-primary)" }].map(k => (
            <div key={k.label} className="stat-card"><p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</p><p style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</p></div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ACCOUNT_HEADS.map(h => <button key={h} onClick={() => setAccount(h)} style={{ padding: "5px 12px", borderRadius: "var(--radius-md)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: "1px solid", background: account === h ? "var(--color-accent)" : "var(--color-surface-2)", color: account === h ? "#fff" : "var(--color-text-secondary)", borderColor: account === h ? "var(--color-accent)" : "var(--color-border)" }}>{h}</button>)}
          </div>
          <select className="select" style={{ width: "auto", minWidth: 150 }} value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input className="input" style={{ paddingLeft: 30, fontSize: 13 }} placeholder="Search party, description…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Account</th><th>Party</th><th>Description</th><th>Ref Type</th><th>Ref ID</th><th style={{ textAlign:"right" }}>Debit (Dr)</th><th style={{ textAlign:"right" }}>Credit (Cr)</th><th style={{ textAlign:"right" }}>Running Balance</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign:"center", padding:40 }}><RefreshCw size={18} className="spin-slow" style={{ display:"inline", color:"var(--color-accent)" }} /></td></tr>
              ) : withBalance.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign:"center", padding:48 }}>
                  <BookOpen size={32} style={{ color:"var(--color-text-muted)", margin:"0 auto 10px", display:"block" }} />
                  <p style={{ color:"var(--color-text-muted)" }}>No ledger entries yet</p>
                  <p style={{ color:"var(--color-text-muted)", fontSize:12, marginTop:6 }}>Entries appear automatically when invoices, payments and purchases are saved</p>
                </td></tr>
              ) : (
                withBalance.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace:"nowrap", fontSize:12 }}>{fmtDate(e.entry_date ?? e.created_at)}</td>
                    <td><span style={{ padding:"2px 8px", borderRadius:99, fontSize:11.5, fontWeight:600, background:"var(--color-surface-3)", color:"var(--color-text-secondary)" }}>{e.account_head ?? "—"}</span></td>
                    <td style={{ fontWeight:500, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.party_name ?? "—"}</td>
                    <td style={{ color:"var(--color-text-secondary)", fontSize:12.5, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.description ?? "—"}</td>
                    <td><span className={`badge ${e.ref_type === "INVOICE" ? "badge-purple" : e.ref_type === "PAYMENT" ? "badge-green" : e.ref_type === "PURCHASE" ? "badge-red" : "badge-gray"}`} style={{ fontSize:11 }}>{e.ref_type ?? "—"}</span></td>
                    <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--color-text-muted)" }}>{e.ref_id ?? "—"}</td>
                    <td style={{ textAlign:"right", color: e.debit > 0 ? "var(--color-accent-glow)" : "var(--color-text-muted)", fontWeight: e.debit > 0 ? 700 : 400 }}>{fmtMoney(e.debit)}</td>
                    <td style={{ textAlign:"right", color: e.credit > 0 ? "var(--color-green)" : "var(--color-text-muted)", fontWeight: e.credit > 0 ? 700 : 400 }}>{fmtMoney(e.credit)}</td>
                    <td style={{ textAlign:"right", fontWeight:700, color: e.running >= 0 ? "var(--color-accent-glow)" : "var(--color-red)" }}>{e.running >= 0 ? "₹" : "−₹"}{Math.abs(e.running).toLocaleString("en-IN", { minimumFractionDigits:2 })}</td>
                    <td><button className="btn-ghost" style={{ padding:5, color:"var(--color-red)" }} title="Delete" onClick={() => delEntry(e.id)}><Trash2 size={13} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="glass-modal animate-in" style={{ width:"100%", maxWidth:520 }}>
            <div style={{ padding:"18px 22px", borderBottom:"1px solid var(--color-border)", display:"flex", justifyContent:"space-between" }}>
              <h2 style={{ fontWeight:700, fontSize:16 }}>Manual Ledger Entry</h2>
              <button className="btn-ghost" style={{ padding:5 }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
              <div className="form-grid-2">
                <div><label className="label">Date</label><input type="date" className="input" value={addForm.entry_date} onChange={e => setAddForm({...addForm, entry_date: e.target.value})} /></div>
                <div><label className="label">Account Head</label><input className="input" placeholder="Cash, Sales…" value={addForm.account_head} onChange={e => setAddForm({...addForm, account_head: e.target.value})} /></div>
                <div><label className="label">Party Name</label><input className="input" placeholder="Customer / Vendor" value={addForm.party_name} onChange={e => setAddForm({...addForm, party_name: e.target.value})} /></div>
              </div>
              <div><label className="label">Description</label><input className="input" placeholder="Details…" value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} /></div>
              <div className="form-grid-2">
                <div><label className="label">Debit (Dr) ₹</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={addForm.debit} onChange={e => setAddForm({...addForm, debit: e.target.value, credit: ""})} /></div>
                <div><label className="label">Credit (Cr) ₹</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={addForm.credit} onChange={e => setAddForm({...addForm, credit: e.target.value, debit: ""})} /></div>
              </div>
            </div>
            <div style={{ padding:"14px 22px", borderTop:"1px solid var(--color-border)", display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddEntry} disabled={addSaving}><BookOpen size={14} /> {addSaving ? "Saving…" : "Add Entry"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

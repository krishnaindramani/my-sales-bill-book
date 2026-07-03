"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search, Trash2, ClipboardList, AlertCircle } from "lucide-react";

interface LogEntry {
  id: number;
  action_type: string;
  description: string | null;
  timestamp: string;
}

const ACTION_TYPES = ["All", "CREATE_INVOICE", "UPDATE_INVOICE", "DELETE_INVOICE", "MARK_PAID_INVOICE", "CREATE_PROFORMA", "UPDATE_PROFORMA", "DELETE_PROFORMA", "CREATE_CUSTOMER", "UPDATE_CUSTOMER", "DELETE_CUSTOMER", "CREATE_LEDGER", "DELETE_LEDGER", "PAY_PURCHASE", "UPDATE_PURCHASE", "DELETE_PURCHASE"];

function actionColor(type: string): string {
  if (type.startsWith("CREATE")) return "badge-green";
  if (type.startsWith("DELETE")) return "badge-red";
  if (type.startsWith("UPDATE") || type.startsWith("MARK") || type.startsWith("PAY")) return "badge-amber";
  return "badge-gray";
}

function fmtTs(s: string) {
  try {
    return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return s;
  }
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter !== "All") params.set("action", actionFilter);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/logs?${params}`);
    const json = await res.json();
    if (json.success) { setLogs(json.data); setTotal(json.total); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [actionFilter]);

  async function clearAll() {
    if (!confirm("Clear all activity logs? This cannot be undone.")) return;
    setClearing(true);
    await fetch("/api/logs", { method: "DELETE" });
    setClearing(false);
    load();
  }

  const displayed = logs.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (l.description ?? "").toLowerCase().includes(q) || l.action_type.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-subtitle">{total} total audit events recorded — all database transactions</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn-danger" onClick={clearAll} disabled={clearing}>
            <Trash2 size={13} /> {clearing ? "Clearing…" : "Clear All Logs"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Info banner */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", background: "var(--color-blue-dim)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--color-blue)" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>This audit trail automatically records every create, update and delete operation across invoices, customers, purchases, payments and ledger entries. Entries are written server-side and cannot be forged by the UI.</span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input className="input" style={{ paddingLeft: 30, fontSize: 13 }} placeholder="Search description…" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") load(); }}
            />
          </div>
          <select className="select" style={{ width: "auto", minWidth: 200 }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a === "All" ? "All Action Types" : a}</option>)}
          </select>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Showing", val: displayed.length },
            { label: "Creates", val: logs.filter(l => l.action_type.startsWith("CREATE")).length, color: "var(--color-green)" },
            { label: "Updates", val: logs.filter(l => l.action_type.startsWith("UPDATE") || l.action_type.startsWith("MARK") || l.action_type.startsWith("PAY")).length, color: "var(--color-amber)" },
            { label: "Deletes", val: logs.filter(l => l.action_type.startsWith("DELETE")).length, color: "var(--color-red)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "9px 14px", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-muted)" }}>{s.label}: </span>
              <span style={{ fontWeight: 700, color: s.color ?? "var(--color-text-primary)" }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Log Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 190 }}>Timestamp</th>
                <th style={{ width: 200 }}>Action Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 40 }}>
                  <RefreshCw size={18} className="spin-slow" style={{ display: "inline", color: "var(--color-accent)" }} />
                </td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 48 }}>
                  <ClipboardList size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 10px", display: "block" }} />
                  <p style={{ color: "var(--color-text-muted)" }}>No activity logged yet</p>
                  <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 6 }}>Start creating invoices, customers or purchases to see events here</p>
                </td></tr>
              ) : (
                displayed.map((log, idx) => (
                  <tr key={log.id}>
                    <td style={{ color: "var(--color-text-muted)", fontSize: 12, fontFamily: "monospace" }}>{total - idx}</td>
                    <td style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{fmtTs(log.timestamp)}</td>
                    <td>
                      <span className={`badge ${actionColor(log.action_type)}`} style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.02em" }}>
                        {log.action_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{log.description ?? "—"}</td>
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

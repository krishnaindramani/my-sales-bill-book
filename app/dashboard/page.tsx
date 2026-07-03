"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import {
  FileText, Clock, Users, TrendingUp, IndianRupee, AlertCircle, RefreshCw,
} from "lucide-react";
import { DashboardStats } from "@/types";

function fmt(n: number): string {
  if (n >= 10_00_000) return "₹" + (n / 10_00_000).toFixed(2) + "L";
  if (n >= 1_000) return "₹" + (n / 1_000).toFixed(1) + "K";
  return "₹" + n.toFixed(0);
}

function fmtFull(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  trend?: string;
}

function StatCard({ title, value, sub, icon, accent, trend }: StatCardProps) {
  return (
    <div className="stat-card animate-in" style={{ minWidth: 0 }}>
      {/* Glow blob */}
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        background: accent, borderRadius: "50%", opacity: 0.12, filter: "blur(24px)", pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            {title}
          </p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6 }}>{sub}</p>
          )}
          {trend && (
            <p style={{ fontSize: 12, color: accent, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={11} /> {trend}
            </p>
          )}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: accent + "22",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
      borderRadius: 10, padding: "10px 14px", fontSize: 13,
    }}>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 6, fontSize: 12 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name === "revenue" || p.name === "paid" ? fmt(p.value) : p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStats(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <RefreshCw size={22} className="spin-slow" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "var(--color-red)", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={18} /> {error}
      </div>
    );
  }

  const s = stats!;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, Anil 👋</h1>
          <p className="page-subtitle">Kumar Enterprises — billing snapshot at a glance</p>
        </div>
        <button className="btn-ghost" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <StatCard
            title="Total Invoices"
            value={s.totalInvoices}
            sub={`${s.pendingInvoices} pending`}
            icon={<FileText size={20} />}
            accent="var(--color-accent)"
            trend="All time"
          />
          <StatCard
            title="Pending Invoices"
            value={s.pendingInvoices}
            sub="Draft + Unpaid"
            icon={<Clock size={20} />}
            accent="var(--color-amber)"
          />
          <StatCard
            title="Total Customers"
            value={s.totalCustomers}
            icon={<Users size={20} />}
            accent="var(--color-green)"
          />
          <StatCard
            title="Revenue Collected"
            value={fmt(s.totalRevenue)}
            sub={fmtFull(s.totalRevenue)}
            icon={<IndianRupee size={20} />}
            accent="var(--color-green)"
            trend="Paid invoices"
          />
          <StatCard
            title="Outstanding"
            value={fmt(s.totalOutstanding)}
            sub={fmtFull(s.totalOutstanding)}
            icon={<AlertCircle size={20} />}
            accent="var(--color-red)"
          />
        </div>

        {/* Revenue Trend Chart */}
        <div className="card" style={{ padding: "20px 20px 10px" }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>Revenue Trend</p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Last 12 months — billed vs collected</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={s.monthlyData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorRevenue)" dot={false} />
              <Area type="monotone" dataKey="paid" name="paid" stroke="#10b981" strokeWidth={2} fill="url(#colorPaid)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Invoice Volume Chart */}
        <div className="card" style={{ padding: "20px 20px 10px" }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>Invoice Volume</p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Number of invoices raised per month</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="invoices" name="invoices" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
          {[
            { label: "New Invoice",  href: "/invoices/new",       color: "var(--color-accent)" },
            { label: "New Proforma", href: "/proforma/new",       color: "var(--color-blue)" },
            { label: "New Challan",  href: "/challan/new",        color: "var(--color-green)" },
            { label: "Add Customer", href: "/customers",          color: "var(--color-amber)" },
            { label: "Add Purchase", href: "/account/purchase/new", color: "var(--color-red)" },
            { label: "View Reports", href: "/reports",            color: "#a78bfa" },
          ].map((lnk) => (
            <a key={lnk.href} href={lnk.href} style={{
              display: "block", padding: "14px 16px",
              background: "var(--color-surface)",
              border: `1px solid var(--color-border)`,
              borderRadius: "var(--radius-lg)",
              color: lnk.color, fontWeight: 600, fontSize: 13.5,
              textDecoration: "none",
              transition: "box-shadow 0.15s, border-color 0.15s",
            }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = lnk.color + "60";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${lnk.color}30`;
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {lnk.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

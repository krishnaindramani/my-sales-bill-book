"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Edit2, Trash2, RefreshCw, Users, X, Save } from "lucide-react";
import { Customer, TaxType } from "@/types";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh",
  "Chandigarh","Puducherry",
];

interface CustomerWithExtra extends Customer {
  invoice_count?: number;
  total_billed?: number;
}

interface FormData {
  name: string; company: string; gstin: string; pan: string;
  email: string; phone: string; address: string; city: string;
  state: string; pincode: string; state_code: string;
  tax_type: TaxType; notes: string;
}

const emptyForm: FormData = {
  name: "", company: "", gstin: "", pan: "", email: "", phone: "",
  address: "", city: "", state: "", pincode: "", state_code: "",
  tax_type: "CGST_SGST", notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/customers");
    const json = await res.json();
    if (json.success) setCustomers(json.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name, company: c.company ?? "", gstin: c.gstin ?? "",
      pan: c.pan ?? "", email: c.email ?? "", phone: c.phone ?? "",
      address: c.address ?? "", city: c.city ?? "", state: c.state ?? "",
      pincode: c.pincode ?? "", state_code: c.state_code ?? "",
      tax_type: c.tax_type, notes: c.notes ?? "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        company: form.company || null,
        gstin: form.gstin || null,
        pan: form.pan || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        state_code: form.state_code || null,
        tax_type: form.tax_type,
        notes: form.notes || null,
      };
      const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowModal(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this customer? Their invoice records will not be deleted.")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.gstin ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered — manage profiles and billing relationships</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={15} /> Add Customer</button>
      </div>

      <div className="page-body">
        {/* Search */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Search name, company, GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={load}><RefreshCw size={13} /></button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Company</th><th>GSTIN</th><th>Phone</th>
                <th>City / State</th><th>Tax Type</th>
                <th style={{ textAlign: "right" }}>Billed</th>
                <th style={{ textAlign: "right" }}>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 40 }}>
                  <RefreshCw size={18} className="spin-slow" style={{ display: "inline", color: "var(--color-accent)" }} />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 48 }}>
                  <Users size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 10px", display: "block" }} />
                  <p style={{ color: "var(--color-text-muted)" }}>No customers yet</p>
                  <button className="btn-primary" style={{ marginTop: 14 }} onClick={openNew}><Plus size={14} /> Add First Customer</button>
                </td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.email}</div>}
                    </td>
                    <td>{c.company ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                    <td><span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.gstin ?? "—"}</span></td>
                    <td>{c.phone ?? "—"}</td>
                    <td>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td>
                      <span style={{ fontSize: 12, color: c.tax_type === "IGST" ? "var(--color-amber)" : "var(--color-green)" }}>
                        {c.tax_type === "IGST" ? "IGST" : "CGST+SGST"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      ₹{((c.total_billed ?? 0) as number).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: "right", color: c.outstanding > 0 ? "var(--color-amber)" : "var(--color-text-muted)", fontWeight: c.outstanding > 0 ? 700 : 400 }}>
                      ₹{c.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-ghost" style={{ padding: 5 }} title="Edit" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                        <button className="btn-ghost" style={{ padding: 5, color: "var(--color-red)" }} title="Delete" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="glass-modal animate-in" style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            {/* Modal header */}
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontWeight: 700, fontSize: 16 }}>{editing ? "Edit Customer" : "Add Customer"}</h2>
              <button className="btn-ghost" style={{ padding: 5 }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div style={{ padding: "10px 14px", background: "var(--color-red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", color: "var(--color-red)", fontSize: 13 }}>{error}</div>
              )}

              <div className="form-grid-2">
                <div>
                  <label className="label">Name *</label>
                  <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="input" placeholder="Business name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div>
                  <label className="label">GSTIN</label>
                  <input className="input" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label className="label">PAN</label>
                  <input className="input" placeholder="ABCDE1234F" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="contact@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" placeholder="+91 9999999999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <textarea className="input" style={{ height: 60, resize: "vertical" }} placeholder="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div className="form-grid-3">
                <div>
                  <label className="label">City</label>
                  <input className="input" placeholder="Mumbai" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">State</label>
                  <select className="select" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    <option value="">— Select State —</option>
                    {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" placeholder="400001" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
                <div>
                  <label className="label">State Code</label>
                  <input className="input" placeholder="27" value={form.state_code} onChange={(e) => setForm({ ...form, state_code: e.target.value })} style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label className="label">Default Tax Type</label>
                  <select className="select" value={form.tax_type} onChange={(e) => setForm({ ...form, tax_type: e.target.value as TaxType })}>
                    <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
                    <option value="IGST">IGST (Inter-state)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input" style={{ height: 60, resize: "vertical" }} placeholder="Any additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? "Saving…" : editing ? "Update Customer" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

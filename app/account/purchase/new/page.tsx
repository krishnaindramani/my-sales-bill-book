"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ChevronLeft, AlertCircle } from "lucide-react";

interface PurchaseLineItem {
  id: string;
  particulars: string;
  hsn_sac: string;
  qty: number | string;
  unit: string;
  rate: number | string;
  tax_percent: number | string;
  tax_amount: number;
  line_total: number;
}

function makeItem(): PurchaseLineItem {
  return {
    id: String(Date.now() + Math.random()),
    particulars: "", hsn_sac: "", qty: 1, unit: "Nos",
    rate: 0, tax_percent: 18, tax_amount: 0, line_total: 0,
  };
}

const UNITS = ["Nos", "Kg", "Ltr", "Mtr", "Box", "Set", "Pcs", "Pair", "Hrs", "Day", "Month"];
const TAX_RATES = [0, 5, 12, 18, 28];

function calcLine(item: PurchaseLineItem) {
  const qty = parseFloat(String(item.qty)) || 0;
  const rate = parseFloat(String(item.rate)) || 0;
  const taxPct = parseFloat(String(item.tax_percent)) || 0;
  const taxable = parseFloat((qty * rate).toFixed(2));
  const tax_amount = parseFloat(((taxable * taxPct) / 100).toFixed(2));
  const line_total = parseFloat((taxable + tax_amount).toFixed(2));
  return { tax_amount, line_total };
}

function fmtNum(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AddPurchasePage() {
  const router = useRouter();
  const [vendorName, setVendorName] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseLineItem[]>([makeItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(id: string, field: keyof PurchaseLineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        const { tax_amount, line_total } = calcLine(next);
        return { ...next, tax_amount, line_total };
      })
    );
  }

  const subtotal = parseFloat(
    items.reduce((s, i) => s + (parseFloat(String(i.qty)) || 0) * (parseFloat(String(i.rate)) || 0), 0).toFixed(2)
  );
  const totalTax = parseFloat(items.reduce((s, i) => s + i.tax_amount, 0).toFixed(2));
  const grandTotal = parseFloat((subtotal + totalTax).toFixed(2));

  async function handleSave() {
    setError(null);
    if (!vendorName.trim()) { setError("Vendor name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill_number: billNumber || null,
          vendor_name: vendorName,
          vendor_gstin: vendorGstin || null,
          bill_date: billDate || null,
          due_date: dueDate || null,
          subtotal,
          total_cgst: parseFloat((totalTax / 2).toFixed(2)),
          total_sgst: parseFloat((totalTax / 2).toFixed(2)),
          total_igst: 0,
          total_tax: totalTax,
          grand_total: grandTotal,
          notes: notes || null,
          items: items.map((item, idx) => ({
            sl_no: idx + 1,
            particulars: item.particulars,
            hsn_sac: item.hsn_sac || null,
            qty: parseFloat(String(item.qty)) || 0,
            unit: item.unit,
            rate: parseFloat(String(item.rate)) || 0,
            tax_percent: parseFloat(String(item.tax_percent)) || 0,
            tax_amount: item.tax_amount,
            line_total: item.line_total,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push("/account/purchase/view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={() => router.back()}><ChevronLeft size={16} /></button>
          <div>
            <h1 className="page-title">Add Purchase Bill</h1>
            <p className="page-subtitle">Record incoming purchase from a vendor</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save Bill"}
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--color-red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", color: "var(--color-red)", fontSize: 13.5 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Vendor Details */}
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Vendor & Bill Details</p>
          <div className="form-grid-3">
            <div>
              <label className="label">Vendor Name *</label>
              <input className="input" placeholder="Supplier / Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
            <div>
              <label className="label">Vendor GSTIN</label>
              <input className="input" placeholder="22AAAAA0000A1Z5" value={vendorGstin} onChange={(e) => setVendorGstin(e.target.value.toUpperCase())} style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="label">Vendor's Bill Number</label>
              <input className="input" placeholder="Their invoice ref" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Bill Date</label>
              <input type="date" className="input" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>Purchase Items</p>
            <button className="btn-secondary" onClick={() => setItems((p) => [...p, makeItem()])} style={{ padding: "6px 12px" }}>
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)" }}>
                  {["#", "Particulars", "HSN/SAC", "Qty", "Unit", "Rate (₹)", "Tax %", "Tax Amt (₹)", "Total (₹)", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "var(--color-text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--color-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)", fontWeight: 600, width: 32 }}>{idx + 1}</td>
                    <td style={{ padding: "6px 6px", minWidth: 200 }}>
                      <input className="input input-sm" placeholder="Item description" value={item.particulars} onChange={(e) => updateItem(item.id, "particulars", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 90 }}>
                      <input className="input input-sm" placeholder="HSN/SAC" value={item.hsn_sac} onChange={(e) => updateItem(item.id, "hsn_sac", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 72 }}>
                      <input className="input input-sm" type="number" min="0" step="0.01" value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} style={{ textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 80 }}>
                      <select className="select" style={{ padding: "5px 8px", fontSize: 13 }} value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 6px", width: 100 }}>
                      <input className="input input-sm" type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(item.id, "rate", e.target.value)} style={{ textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 80 }}>
                      <select className="select" style={{ padding: "5px 8px", fontSize: 13 }} value={item.tax_percent} onChange={(e) => updateItem(item.id, "tax_percent", e.target.value)}>
                        {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", width: 90, color: "var(--color-amber)", fontWeight: 500 }}>{fmtNum(item.tax_amount)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", width: 110, fontWeight: 700 }}>{fmtNum(item.line_total)}</td>
                    <td style={{ padding: "6px 8px", width: 36 }}>
                      <button className="btn-ghost" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => setItems((p) => p.length === 1 ? p : p.filter((i) => i.id !== item.id))} disabled={items.length === 1}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13.5 }}>
                <span style={{ color: "var(--color-text-secondary)" }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>₹{fmtNum(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "var(--color-text-muted)" }}>CGST</span>
                <span style={{ color: "var(--color-amber)" }}>₹{fmtNum(totalTax / 2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "var(--color-text-muted)" }}>SGST</span>
                <span style={{ color: "var(--color-amber)" }}>₹{fmtNum(totalTax / 2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-border)", paddingTop: 10, marginTop: 6, fontSize: 16, fontWeight: 800 }}>
                <span>Grand Total</span>
                <span style={{ color: "var(--color-accent-glow)" }}>₹{fmtNum(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes</label>
          <textarea className="input" style={{ height: 80, resize: "vertical" }} placeholder="Purchase notes, delivery conditions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "Saving…" : "Save Purchase Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

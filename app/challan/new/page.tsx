"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ChevronLeft, AlertCircle } from "lucide-react";
import { Customer, Invoice } from "@/types";

interface ChallanLine {
  id: string;
  particulars: string;
  hsn_sac: string;
  qty: number | string;
  unit: string;
}

function makeLine(): ChallanLine {
  return { id: String(Date.now() + Math.random()), particulars: "", hsn_sac: "", qty: 1, unit: "Nos" };
}

const UNITS = ["Nos", "Kg", "Ltr", "Mtr", "Box", "Set", "Pcs", "Pair", "Hrs", "Day", "Month"];

export default function NewChallanPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ChallanLine[]>([makeLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ]).then(([custJson, invJson]) => {
      if (custJson.success) setCustomers(custJson.data);
      if (invJson.success) setInvoices(invJson.data);
    });
  }, []);

  // Auto-fill address when customer selected
  useEffect(() => {
    if (customerId) {
      const c = customers.find((c) => c.id === Number(customerId));
      if (c) {
        const addr = [c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ");
        if (addr) setDeliveryAddress(addr);
      }
    }
  }, [customerId, customers]);

  function updateLine(id: string, field: keyof ChallanLine, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  async function handleSave() {
    setError(null);
    if (lines.some((l) => !l.particulars.trim())) { setError("All items need a description."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId || null,
          invoice_id: invoiceId || null,
          challan_date: challanDate || null,
          vehicle_number: vehicleNumber || null,
          driver_name: driverName || null,
          delivery_address: deliveryAddress || null,
          notes: notes || null,
          items: lines.map((l, idx) => ({
            sl_no: idx + 1,
            particulars: l.particulars,
            hsn_sac: l.hsn_sac || null,
            qty: parseFloat(String(l.qty)) || 0,
            unit: l.unit,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push("/challan/view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const customerInvoices = invoiceId === ""
    ? invoices.filter((i) => !customerId || i.customer_id === Number(customerId))
    : invoices;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={() => router.back()}><ChevronLeft size={16} /></button>
          <div>
            <h1 className="page-title">New Delivery Challan</h1>
            <p className="page-subtitle">Issue a goods dispatch document</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save Challan"}
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--color-red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", color: "var(--color-red)", fontSize: 13.5 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Details */}
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Challan Details</p>
          <div className="form-grid-3">
            <div>
              <label className="label">Customer</label>
              <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— No Customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Link to Invoice</label>
              <select className="select" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— No Invoice —</option>
                {customerInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} ({i.customer_name ?? "Walk-in"})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Challan Date</label>
              <input type="date" className="input" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Vehicle Number</label>
              <input className="input" placeholder="MH-12-AB-1234" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="label">Driver Name</label>
              <input className="input" placeholder="Driver's name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="label">Delivery Address</label>
            <textarea className="input" style={{ height: 70, resize: "vertical" }} placeholder="Full delivery address..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>
        </div>

        {/* Items Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>Goods / Items</p>
            <button className="btn-secondary" onClick={() => setLines((p) => [...p, makeLine()])} style={{ padding: "6px 12px" }}>
              <Plus size={14} /> Add Row
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)" }}>
                  {["#", "Particulars / Description", "HSN/SAC", "Qty", "Unit", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "var(--color-text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--color-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)", fontWeight: 600, width: 32 }}>{idx + 1}</td>
                    <td style={{ padding: "6px 6px", minWidth: 260 }}>
                      <input className="input input-sm" placeholder="Description of goods" value={line.particulars} onChange={(e) => updateLine(line.id, "particulars", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 100 }}>
                      <input className="input input-sm" placeholder="HSN/SAC" value={line.hsn_sac} onChange={(e) => updateLine(line.id, "hsn_sac", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 80 }}>
                      <input className="input input-sm" type="number" min="0" step="0.01" value={line.qty} onChange={(e) => updateLine(line.id, "qty", e.target.value)} style={{ textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 90 }}>
                      <select className="select" style={{ padding: "5px 8px", fontSize: 13 }} value={line.unit} onChange={(e) => updateLine(line.id, "unit", e.target.value)}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px", width: 36 }}>
                      <button className="btn-ghost" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => setLines((p) => p.length === 1 ? p : p.filter((l) => l.id !== line.id))} disabled={lines.length === 1}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes / Instructions</label>
          <textarea className="input" style={{ height: 70, resize: "vertical" }} placeholder="Handle with care, delivery instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "Saving…" : "Save Challan"}
          </button>
        </div>
      </div>
    </div>
  );
}

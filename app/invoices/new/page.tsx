"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ChevronLeft, AlertCircle, Printer } from "lucide-react";
import { Customer, TaxType } from "@/types";

interface LineItem {
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

function makeItem(): LineItem {
  return { id: String(Date.now() + Math.random()), particulars: "", hsn_sac: "", qty: 1, unit: "Nos", rate: 0, tax_percent: 18, tax_amount: 0, line_total: 0 };
}

// Pre-configured HSN/SAC quick-select for Kumar Enterprises
const HSN_PRESETS: { label: string; hsn: string; description: string }[] = [
  { label: "Aluminium Sliding Window",  hsn: "7610",    description: "Aluminium Sliding Window" },
  { label: "Aluminium Sliding Door",    hsn: "7610",    description: "Aluminium Sliding Door" },
  { label: "Glass Partition",           hsn: "70071900",description: "Glass Partition Work" },
  { label: "Ceiling Frame",             hsn: "7610",    description: "Ceiling Frame (Aluminium)" },
  { label: "All Type Glass Works",      hsn: "70071900",description: "All Type Glass Works & Fitting" },
  { label: "Aluminium Fitting",         hsn: "8302",    description: "Aluminium Fitting & Hardware" },
  { label: "MS Fabrication Work",       hsn: "7308",    description: "MS Fabrication Work" },
  { label: "Labour Charges",            hsn: "995461",  description: "Installation / Labour Charges" },
];

const TAX_RATES = [0, 5, 12, 18, 28];

function calcLine(item: LineItem) {
  const qty = parseFloat(String(item.qty)) || 0;
  const rate = parseFloat(String(item.rate)) || 0;
  const taxPct = parseFloat(String(item.tax_percent)) || 0;
  const taxable = parseFloat((qty * rate).toFixed(2));
  const tax_amount = parseFloat(((taxable * taxPct) / 100).toFixed(2));
  return { tax_amount, line_total: parseFloat((taxable + tax_amount).toFixed(2)) };
}

function fmtNum(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Convert number to Indian words
function numToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  function toWords(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " " + toWords(num%100) : "");
    if (num < 100000) return toWords(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " " + toWords(num%1000) : "");
    if (num < 10000000) return toWords(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " " + toWords(num%100000) : "");
    return toWords(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " " + toWords(num%10000000) : "");
  }
  return toWords(Math.floor(Math.abs(n))) + " Rupees Only";
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [dcNo, setDcNo] = useState("");
  const [dcDate, setDcDate] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [taxType, setTaxType] = useState<TaxType>("CGST_SGST");
  const [description, setDescription] = useState("");
  const [billPercentage, setBillPercentage] = useState<number | string>(100);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then(j => { if (j.success) setCustomers(j.data); });
  }, []);

  useEffect(() => {
    if (customerId) {
      const c = customers.find(c => c.id === Number(customerId));
      if (c) setTaxType(c.tax_type);
    }
  }, [customerId, customers]);

  const recalcItems = useCallback((list: LineItem[]): LineItem[] =>
    list.map(item => { const { tax_amount, line_total } = calcLine(item); return { ...item, tax_amount, line_total }; }), []);

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };
      const { tax_amount, line_total } = calcLine(next);
      return { ...next, tax_amount, line_total };
    }));
  }

  function applyHsnPreset(id: string, preset: typeof HSN_PRESETS[0]) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, particulars: preset.description, hsn_sac: preset.hsn };
      const { tax_amount, line_total } = calcLine(next);
      return { ...next, tax_amount, line_total };
    }));
  }

  // Totals
  const subtotal = parseFloat(items.reduce((s, i) => s + (parseFloat(String(i.qty)) || 0) * (parseFloat(String(i.rate)) || 0), 0).toFixed(2));
  const totalTax  = parseFloat(items.reduce((s, i) => s + i.tax_amount, 0).toFixed(2));
  const grandTotal = parseFloat((subtotal + totalTax).toFixed(2));
  const totalCgst  = taxType === "CGST_SGST" ? parseFloat((totalTax / 2).toFixed(2)) : 0;
  const totalSgst  = taxType === "CGST_SGST" ? parseFloat((totalTax / 2).toFixed(2)) : 0;
  const totalIgst  = taxType === "IGST" ? totalTax : 0;

  // Round-off
  const payableRaw   = grandTotal;
  const payableRound = Math.round(payableRaw);
  const roundOff     = parseFloat((payableRound - payableRaw).toFixed(2));

  async function handleSave(print = false) {
    setError(null);
    if (items.some(i => !i.particulars.trim())) { setError("All line items need a description (Particulars)."); return; }
    setSaving(true);
    try {
      const payload = {
        invoice_number:  invoiceNumber.trim() || undefined,
        customer_id:     customerId || null,
        invoice_date:    invoiceDate || null,
        due_date:        dueDate || null,
        dc_no:           dcNo || null,
        dc_date:         dcDate || null,
        order_no:        orderNo || null,
        order_date:      orderDate || null,
        place_of_supply: placeOfSupply || null,
        tax_type:        taxType,
        description:     description || null,
        bill_percentage: parseFloat(String(billPercentage)) || 100,
        subtotal, total_cgst: totalCgst, total_sgst: totalSgst,
        total_igst: totalIgst, total_tax: totalTax, grand_total: grandTotal,
        round_off: roundOff, payable_amount: payableRound,
        notes: notes || null,
        items: items.map((item, idx) => {
          const taxPct = parseFloat(String(item.tax_percent)) || 0;
          const half = taxType === "CGST_SGST" ? taxPct / 2 : 0;
          return {
            sl_no: idx + 1, particulars: item.particulars,
            hsn_sac: item.hsn_sac || null,
            qty: parseFloat(String(item.qty)) || 0, unit: item.unit,
            rate: parseFloat(String(item.rate)) || 0, tax_percent: taxPct,
            cgst_percent: half, sgst_percent: half,
            igst_percent: taxType === "IGST" ? taxPct : 0,
            tax_amount: item.tax_amount, line_total: item.line_total,
          };
        }),
      };

      const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (print) router.push(`/invoices/${json.data.id}?print=1`);
      else router.push("/invoices/open");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find(c => c.id === Number(customerId));

  return (
    <div>
      <div className="page-header no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={() => router.back()}><ChevronLeft size={16} /></button>
          <div>
            <h1 className="page-title">New Tax Invoice</h1>
            <p className="page-subtitle">Kumar Enterprises — create a new GST invoice</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save"}</button>
          <button className="btn-primary" onClick={() => handleSave(true)} disabled={saving}><Printer size={14} /> Save & Print</button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--color-red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", color: "var(--color-red)", fontSize: 13.5 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Invoice Meta */}
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Invoice Details</p>
          <div className="form-grid-3">
            <div>
              <label className="label">Business Name (M/S)</label>
              <select className="select" value={customerId} onChange={e => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Walk-in / No Customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Invoice Number <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>(manual — leave blank to auto)</span></label>
              <input className="input" placeholder="e.g. KE/2025-26/001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input type="date" className="input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="label">D.C. No.</label>
              <input className="input" placeholder="Delivery Challan No." value={dcNo} onChange={e => setDcNo(e.target.value)} />
            </div>
            <div>
              <label className="label">D.C. Date</label>
              <input type="date" className="input" value={dcDate} onChange={e => setDcDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Order No.</label>
              <input className="input" placeholder="Work Order / PO No." value={orderNo} onChange={e => setOrderNo(e.target.value)} />
            </div>
            <div>
              <label className="label">Order Date</label>
              <input type="date" className="input" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Bill Percentage (%)</label>
              <input className="input" type="number" min="1" max="100" step="0.01" placeholder="100" value={billPercentage} onChange={e => setBillPercentage(e.target.value)} />
            </div>
            <div>
              <label className="label">Tax Type</label>
              <select className="select" value={taxType} onChange={e => { const tt = e.target.value as TaxType; setTaxType(tt); setItems(prev => recalcItems(prev)); }}>
                <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
                <option value="IGST">IGST (Inter-state)</option>
              </select>
            </div>
          </div>

          {/* Customer preview */}
          {selectedCustomer && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--color-text-secondary)", display: "flex", gap: 24, flexWrap: "wrap" }}>
              {selectedCustomer.company && <span><strong>M/S:</strong> {selectedCustomer.company}</span>}
              {selectedCustomer.gstin && <span><strong>GSTIN:</strong> {selectedCustomer.gstin}</span>}
              {selectedCustomer.address && <span><strong>Addr:</strong> {selectedCustomer.address}</span>}
              {selectedCustomer.phone && <span><strong>Ph:</strong> {selectedCustomer.phone}</span>}
            </div>
          )}

          {/* Global Description */}
          <div style={{ marginTop: 14 }}>
            <label className="label">Description <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>(printed on invoice)</span></label>
            <textarea className="input" style={{ height: 64, resize: "vertical" }} placeholder="Supply and installation of aluminium sliding windows at site..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>Line Items</p>
              <select className="select" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }}
                value="" onChange={e => {
                  const preset = HSN_PRESETS.find(p => p.label === e.target.value);
                  if (preset) {
                    // apply to the last empty row, or add a new one
                    const emptyIdx = items.findIndex(i => !i.particulars.trim());
                    if (emptyIdx >= 0) applyHsnPreset(items[emptyIdx].id, preset);
                    else {
                      const newItem = makeItem();
                      const withNew = [...items, { ...newItem, particulars: preset.description, hsn_sac: preset.hsn }];
                      setItems(withNew.map(i => { const { tax_amount, line_total } = calcLine(i); return { ...i, tax_amount, line_total }; }));
                    }
                  }
                }}>
                <option value="">+ Quick-add item…</option>
                {HSN_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label} (HSN: {p.hsn})</option>)}
              </select>
            </div>
            <button className="btn-secondary" onClick={() => setItems(p => [...p, makeItem()])} style={{ padding: "6px 12px" }}>
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)" }}>
                  {["#", "Particular", "HSN/SAC", "Qty", "Unit", "Rate (₹)", "GST %", "GST Amt (₹)", "Amount (₹)", ""].map(h => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "var(--color-text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--color-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)", width: 28, fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: "6px 6px", minWidth: 200 }}>
                      <input className="input input-sm" placeholder="Description of goods/service" value={item.particulars} onChange={e => updateItem(item.id, "particulars", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 100 }}>
                      <input className="input input-sm" placeholder="HSN/SAC" value={item.hsn_sac} onChange={e => updateItem(item.id, "hsn_sac", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 70 }}>
                      <input className="input input-sm" type="number" min="0" step="0.01" value={item.qty} onChange={e => updateItem(item.id, "qty", e.target.value)} style={{ textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 72 }}>
                      <input className="input input-sm" placeholder="Nos" value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 100 }}>
                      <input className="input input-sm" type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, "rate", e.target.value)} style={{ textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 6px", width: 80 }}>
                      <select className="select" style={{ padding: "5px 8px", fontSize: 13 }} value={item.tax_percent} onChange={e => updateItem(item.id, "tax_percent", e.target.value)}>
                        {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", width: 90, color: "var(--color-amber)", fontWeight: 500 }}>{fmtNum(item.tax_amount)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", width: 110, fontWeight: 700 }}>{fmtNum(item.line_total)}</td>
                    <td style={{ padding: "6px 8px", width: 32 }}>
                      <button className="btn-ghost" style={{ padding: 5, color: "var(--color-red)" }} onClick={() => setItems(p => p.length === 1 ? p : p.filter(i => i.id !== item.id))} disabled={items.length === 1}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Panel */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 300 }}>
              <Row label="Total Amount (Taxable)" val={`₹${fmtNum(subtotal)}`} />
              {taxType === "CGST_SGST" ? (
                <>
                  <Row label="Total CGST Amount" val={`₹${fmtNum(totalCgst)}`} accent="var(--color-amber)" />
                  <Row label="Total SGST Amount" val={`₹${fmtNum(totalSgst)}`} accent="var(--color-amber)" />
                  <Row label="Total GST Amount"  val={`₹${fmtNum(totalTax)}`}  accent="var(--color-amber)" />
                </>
              ) : (
                <Row label="Total IGST Amount" val={`₹${fmtNum(totalIgst)}`} accent="var(--color-amber)" />
              )}
              <Row label="Net Amount" val={`₹${fmtNum(grandTotal)}`} bold />
              <Row label="R/O (Round Off)" val={`${roundOff >= 0 ? "+" : ""}₹${fmtNum(roundOff)}`} accent={roundOff >= 0 ? "var(--color-green)" : "var(--color-red)"} />
              <div style={{ borderTop: "2px solid var(--color-accent)", paddingTop: 10, marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}>
                <span>Total Payable Amount</span>
                <span style={{ color: "var(--color-accent)" }}>₹{payableRound.toLocaleString("en-IN")}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6, fontStyle: "italic" }}>
                {numToWords(payableRound)}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes</label>
          <textarea className="input" style={{ height: 70, resize: "vertical" }} placeholder="Thank you for your business!" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save"}</button>
          <button className="btn-primary" onClick={() => handleSave(true)} disabled={saving}><Printer size={14} /> Save & Print</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, bold, accent }: { label: string; val: string; bold?: boolean; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 13.5 }}>
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: accent ?? "var(--color-text-primary)" }}>{val}</span>
    </div>
  );
}

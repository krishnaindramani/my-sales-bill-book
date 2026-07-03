"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ChevronLeft, AlertCircle, CreditCard, RefreshCw } from "lucide-react";
import { Customer, Invoice, PaymentMode } from "@/types";

const PAYMENT_MODES: PaymentMode[] = ["Cash", "Cheque", "UPI", "NEFT", "RTGS"];

export default function AddPaymentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | string>("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/invoices?status=Pending").then((r) => r.json()),
    ]).then(([custJson, invJson]) => {
      if (custJson.success) setCustomers(custJson.data);
      if (invJson.success) setInvoices(invJson.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (customerId) {
      setFilteredInvoices(invoices.filter((i) => i.customer_id === Number(customerId) && i.balance_due > 0));
      setInvoiceId("");
      setAmount("");
    } else {
      setFilteredInvoices(invoices.filter((i) => i.balance_due > 0));
      setInvoiceId("");
      setAmount("");
    }
  }, [customerId, invoices]);

  useEffect(() => {
    if (invoiceId) {
      const inv = invoices.find((i) => i.id === Number(invoiceId));
      if (inv) {
        setAmount(inv.balance_due);
        if (!customerId && inv.customer_id) setCustomerId(inv.customer_id);
      }
    }
  }, [invoiceId, invoices]);

  async function handleSave() {
    setError(null);
    const amt = parseFloat(String(amount));
    if (!amt || amt <= 0) { setError("Enter a valid payment amount."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId || null,
          customer_id: customerId || null,
          payment_date: paymentDate || null,
          amount: amt,
          payment_mode: paymentMode,
          reference_no: referenceNo || null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push("/account/ledger");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedInvoice = invoiceId ? invoices.find((i) => i.id === Number(invoiceId)) : null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={() => router.back()}><ChevronLeft size={16} /></button>
          <div>
            <h1 className="page-title">Add Sales Payment</h1>
            <p className="page-subtitle">Record payment received from a customer</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <CreditCard size={15} /> {saving ? "Recording…" : "Record Payment"}
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--color-red-dim)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", color: "var(--color-red)", fontSize: 13.5 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
            <RefreshCw size={22} className="spin-slow" style={{ color: "var(--color-accent)" }} />
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>Payment Details</p>

              {/* Customer */}
              <div>
                <label className="label">Customer</label>
                <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— Any / Walk-in —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                </select>
              </div>

              {/* Invoice */}
              <div>
                <label className="label">Link to Invoice (optional)</label>
                <select className="select" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— No specific invoice —</option>
                  {filteredInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name ?? "Walk-in"} — Balance: ₹{inv.balance_due.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice preview */}
              {selectedInvoice && (
                <div style={{ padding: "10px 14px", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Invoice: </span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{selectedInvoice.invoice_number}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Grand Total: </span>
                      <span style={{ fontWeight: 600 }}>₹{selectedInvoice.grand_total.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Paid: </span>
                      <span style={{ fontWeight: 600, color: "var(--color-green)" }}>₹{selectedInvoice.amount_paid.toFixed(2)}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Balance: </span>
                      <span style={{ fontWeight: 700, color: "var(--color-amber)" }}>₹{selectedInvoice.balance_due.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-grid-2">
                {/* Amount */}
                <div>
                  <label className="label">Amount Received (₹) *</label>
                  <input
                    className="input"
                    type="number" min="0" step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ fontWeight: 700, fontSize: 16, color: "var(--color-accent-glow)" }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="label">Payment Date</label>
                  <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>

                {/* Mode */}
                <div>
                  <label className="label">Payment Mode</label>
                  <select className="select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                    {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Reference */}
                <div>
                  <label className="label">Reference / Cheque No.</label>
                  <input className="input" placeholder="UTR / Cheque number" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea className="input" style={{ height: 70, resize: "vertical" }} placeholder="Any remarks..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button className="btn-secondary" onClick={() => router.back()}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  <CreditCard size={14} /> {saving ? "Recording…" : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

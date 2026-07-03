"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, CheckCircle, XCircle, RefreshCw, Printer } from "lucide-react";
import { Invoice, InvoiceItem } from "@/types";

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function numToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero Rupees Only";
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

interface InvoiceDetail extends Invoice {
  customer_gstin?: string;
  customer_company?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_phone?: string;
  description?: string;
  bill_percentage?: number;
  dc_no?: string; dc_date?: string;
  order_no?: string; order_date?: string;
  round_off?: number;
  payable_amount?: number;
  items: InvoiceItem[];
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/invoices/${id}`);
    const json = await res.json();
    if (json.success) setInv(json.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Auto-print when ?print=1
  useEffect(() => {
    if (!loading && inv && searchParams.get("print") === "1") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, inv, searchParams]);

  async function markPaid() {
    setActing(true);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_paid" }) });
    setActing(false);
    load();
  }
  async function cancel() {
    if (!confirm("Cancel this invoice?")) return;
    setActing(true);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Cancelled" }) });
    setActing(false);
    load();
  }

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><RefreshCw size={22} className="spin-slow" style={{ color: "var(--color-accent)" }} /></div>;
  if (!inv) return <div style={{ padding: 40, color: "var(--color-red)" }}>Invoice not found.</div>;

  const statusColor: Record<string, string> = { Draft: "var(--color-text-secondary)", Pending: "var(--color-amber)", Paid: "var(--color-green)", Cancelled: "var(--color-red)" };
  const payable = inv.payable_amount ?? inv.grand_total;
  const roundOff = inv.round_off ?? 0;
  const cgst = inv.total_cgst ?? 0;
  const sgst = inv.total_sgst ?? 0;
  const igst = inv.total_igst ?? 0;

  return (
    <>
      {/* ── SCREEN VIEW ─────────────────────────────────────────────── */}
      <div className="screen-only">
        <div className="page-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn-ghost" onClick={() => router.back()}><ChevronLeft size={16} /></button>
            <div>
              <h1 className="page-title">{inv.invoice_number}</h1>
              <p className="page-subtitle" style={{ color: statusColor[inv.status] }}>● {inv.status}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost no-print" onClick={() => window.print()}><Printer size={14} /> Print</button>
            {inv.status !== "Paid" && inv.status !== "Cancelled" && (
              <button className="btn-primary" onClick={markPaid} disabled={acting} style={{ background: "var(--color-green)" }}><CheckCircle size={14} /> Mark as Paid</button>
            )}
            {inv.status !== "Cancelled" && inv.status !== "Paid" && (
              <button className="btn-secondary" onClick={cancel} disabled={acting}><XCircle size={14} /> Cancel</button>
            )}
          </div>
        </div>

        <div className="page-body">
          <div className="form-grid-2">
            <div className="card">
              <p style={{ fontWeight: 700, fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>BILL TO (M/S)</p>
              <p style={{ fontWeight: 700, fontSize: 15 }}>{inv.customer_company || inv.customer_name || "Walk-in"}</p>
              {inv.customer_address && <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 13 }}>{inv.customer_address}, {inv.customer_city}</p>}
              {inv.customer_gstin  && <p style={{ fontFamily: "monospace", fontSize: 12, marginTop: 4 }}>GSTIN: {inv.customer_gstin}</p>}
              {inv.description     && <p style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-secondary)" }}><strong>Desc:</strong> {inv.description}</p>}
            </div>
            <div className="card">
              {[
                ["Invoice No.",       inv.invoice_number],
                ["Invoice Date",      fmtDate(inv.invoice_date)],
                ["D.C. No & Date",    inv.dc_no ? `${inv.dc_no} / ${fmtDate(inv.dc_date)}` : "—"],
                ["Order No & Date",   inv.order_no ? `${inv.order_no} / ${fmtDate(inv.order_date)}` : "—"],
                ["Bill %",            `${inv.bill_percentage ?? 100}%`],
                ["Tax Type",          inv.tax_type === "IGST" ? "IGST" : "CGST + SGST"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sr</th><th>Particular</th><th>HSN/SAC</th>
                  <th style={{ textAlign: "right" }}>Qty</th><th>Unit</th>
                  <th style={{ textAlign: "right" }}>Rate</th><th style={{ textAlign: "right" }}>GST%</th>
                  <th style={{ textAlign: "right" }}>GST Amt.</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map(item => (
                  <tr key={item.id}>
                    <td style={{ color: "var(--color-text-muted)" }}>{item.sl_no}</td>
                    <td style={{ fontWeight: 500 }}>{item.particulars}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{item.hsn_sac ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{item.qty}</td>
                    <td>{item.unit}</td>
                    <td style={{ textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{item.tax_percent}%</td>
                    <td style={{ textAlign: "right", color: "var(--color-amber)" }}>₹{item.tax_amount.toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{item.line_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className="card" style={{ width: 340 }}>
              {[
                ["Total Amount",    fmtMoney(inv.subtotal), ""],
                ...(inv.tax_type === "CGST_SGST"
                  ? [["Total CGST Amount", fmtMoney(cgst), "var(--color-amber)"], ["Total SGST Amount", fmtMoney(sgst), "var(--color-amber)"], ["Total GST Amount", fmtMoney(inv.total_tax), "var(--color-amber)"]]
                  : [["Total IGST Amount", fmtMoney(igst), "var(--color-amber)"]]),
                ["Net Amount",     fmtMoney(inv.grand_total), ""],
                ["R/O (Round Off)", (roundOff >= 0 ? "+" : "") + fmtMoney(Math.abs(roundOff)), roundOff >= 0 ? "var(--color-green)" : "var(--color-red)"],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13.5 }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
                  <span style={{ fontWeight: 500, color: (c as string) || "var(--color-text-primary)" }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: "2px solid var(--color-accent)", paddingTop: 10, marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}>
                <span>Total Payable Amount</span>
                <span style={{ color: "var(--color-accent)" }}>₹{payable.toLocaleString("en-IN")}</span>
              </div>
              <p style={{ fontSize: 12, fontStyle: "italic", color: "var(--color-text-muted)", marginTop: 6 }}>{numToWords(payable)}</p>
              <div style={{ marginTop: 10, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Amount Paid</span>
                  <span style={{ color: "var(--color-green)", fontWeight: 600 }}>{fmtMoney(inv.amount_paid)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Balance Due</span>
                  <span style={{ color: inv.balance_due > 0 ? "var(--color-red)" : "var(--color-green)", fontWeight: 700 }}>{fmtMoney(inv.balance_due)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRINT CANVAS ────────────────────────────────────────────── */}
      <div className="print-invoice" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#000", padding: "10px 20px", maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 10 }}>
          <img src="/images/logo.png" alt="Kumar Enterprises" style={{ height: 64, objectFit: "contain", marginBottom: 6 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>KUMAR ENTERPRISES</div>
          <div style={{ fontSize: 11, marginTop: 3 }}>Specialist In: Aluminium Sliding Window Door, Partition, Ceiling Frame, Fitting &amp; All Type Glass Works.</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Address: 31/4/A/4B, Plot No. 7, Tiny Industries Estate Near Khadi Machine Chauk, Kondhwa Budruk, Pune 411048</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Mobile: 9822330636, 9850230682 &nbsp;|&nbsp; e-mail: kumarent2009@gmail.com</div>
        </div>

        {/* TAX INVOICE heading */}
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, borderBottom: "1px solid #000", paddingBottom: 6, marginBottom: 8, letterSpacing: 2 }}>TAX INVOICE</div>

        {/* Parties + Invoice Meta */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: "55%", verticalAlign: "top", paddingRight: 12 }}>
                <div><strong>M/S:</strong> {inv.customer_company || inv.customer_name || "—"}</div>
                <div style={{ marginTop: 3 }}><strong>Address:</strong> {[inv.customer_address, inv.customer_city, inv.customer_state].filter(Boolean).join(", ") || "—"}</div>
                {inv.description && <div style={{ marginTop: 3 }}><strong>Desc:</strong> {inv.description}</div>}
                <div style={{ marginTop: 3 }}><strong>GST No:</strong> {inv.customer_gstin || "—"}</div>
              </td>
              <td style={{ width: "45%", verticalAlign: "top", borderLeft: "1px solid #999", paddingLeft: 12 }}>
                <div><strong>Invoice No:</strong> {inv.invoice_number}</div>
                <div style={{ marginTop: 3 }}><strong>Invoice Date:</strong> {fmtDate(inv.invoice_date)}</div>
                <div style={{ marginTop: 3 }}><strong>D.C. No &amp; Date:</strong> {inv.dc_no ? `${inv.dc_no} / ${fmtDate(inv.dc_date)}` : "—"}</div>
                <div style={{ marginTop: 3 }}><strong>Order No &amp; Date:</strong> {inv.order_no ? `${inv.order_no} / ${fmtDate(inv.order_date)}` : "—"}</div>
                <div style={{ marginTop: 3 }}><strong>Bill Percentage:</strong> {inv.bill_percentage ?? 100}%</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: 0 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              {["Sr No.", "Particular", "HSN/SAC", "Qty", "Unit", "Rate", "GST %", "GST Amt.", "Amount"].map(h => (
                <th key={h} style={{ border: "1px solid #000", padding: "5px 7px", textAlign: h === "Sr No." ? "center" : ["Qty","Rate","GST Amt.","Amount"].includes(h) ? "right" : "left", fontSize: 11, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inv.items.map(item => (
              <tr key={item.id}>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "center" }}>{item.sl_no}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px" }}>{item.particulars}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", fontFamily: "monospace", fontSize: 11 }}>{item.hsn_sac ?? ""}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "right" }}>{item.qty}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px" }}>{item.unit}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "right" }}>{item.tax_percent}%</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "right" }}>₹{item.tax_amount.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "5px 7px", textAlign: "right", fontWeight: 700 }}>₹{item.line_total.toFixed(2)}</td>
              </tr>
            ))}
            {/* Empty filler rows for short invoices */}
            {Array.from({ length: Math.max(0, 5 - inv.items.length) }).map((_, i) => (
              <tr key={`filler-${i}`}>
                {Array.from({ length: 9 }).map((_, j) => <td key={j} style={{ border: "1px solid #000", padding: "14px 7px" }}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer: Bank + Totals */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
          <tbody>
            <tr>
              <td style={{ width: "55%", padding: "8px 10px", verticalAlign: "top", borderRight: "1px solid #000" }}>
                <div style={{ fontWeight: 700, marginBottom: 5 }}>Company&apos;s Bank Details:</div>
                <div><strong>Bank Name:</strong> Bank Of Baroda</div>
                <div style={{ marginTop: 2 }}><strong>A/C No:</strong> 15150200000552</div>
                <div style={{ marginTop: 2 }}><strong>Branch &amp; IFSC Code:</strong> Gultakdi, Pune &amp; BARB0GULTEK</div>
                <div style={{ marginTop: 10, fontStyle: "italic", fontSize: 11 }}>
                  <strong>Rupees:</strong> {numToWords(payable)}
                </div>
              </td>
              <td style={{ width: "45%", padding: "8px 10px", verticalAlign: "top" }}>
                <PrintTotal label="Total Amount"       val={`₹${(inv.subtotal ?? 0).toFixed(2)}`} />
                {inv.tax_type === "CGST_SGST" ? (
                  <>
                    <PrintTotal label="Total CGST Amount" val={`₹${cgst.toFixed(2)}`} />
                    <PrintTotal label="Total SGST Amount" val={`₹${sgst.toFixed(2)}`} />
                  </>
                ) : (
                  <PrintTotal label="Total IGST Amount" val={`₹${igst.toFixed(2)}`} />
                )}
                <PrintTotal label="Total GST Amount"   val={`₹${(inv.total_tax ?? 0).toFixed(2)}`} />
                <PrintTotal label="Net Amount"         val={`₹${(inv.grand_total ?? 0).toFixed(2)}`} />
                <PrintTotal label={`R/O ${roundOff >= 0 ? "(+)" : "(-)"}`} val={`₹${Math.abs(roundOff).toFixed(2)}`} />
                <div style={{ borderTop: "2px solid #000", paddingTop: 5, marginTop: 5, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                  <span>Total Payable Amount</span>
                  <span>₹{payable.toLocaleString("en-IN")}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", padding: "40px 10px 10px", borderRight: "1px solid #000", fontSize: 11 }}>Receiver&apos;s Sign:</td>
              <td style={{ width: "50%", padding: "40px 10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>For Kumar Enterprises:</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function PrintTotal({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
      <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
    </div>
  );
}

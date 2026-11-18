/**
 * Tax invoice / receipt
 * Same design as the rental agreement (see printDocument.ts): vendor header
 * with logo and shop address, numbered sections, footer with social links,
 * fixed print margins. Items and prices come from the order's cart snapshot
 * (rentalSummary) and payments from the order's payment track (getPayment).
 * Used by: order detail › Receipt (vendor)
 */

import { getPayment, type Order, type PaymentState } from "./orderFlow";
import { summaryFromOrder, durationLabel, formatLongDate, type RentalSummary } from "./rentalSummary";
import type { AgreementVendor } from "./agreementDocument";
import { iconSvg, type IconName } from "./agreementIcons";
import {
  GREEN, escapeDeep, isoDateMY, docHeader, docFooter, sectionHead, itemsTable, printDocument, openPrintWindow,
} from "./printDocument";

export type TaxProfile = {
  tin?: string;
  legalName?: string;
  brn?: string;
  address?: string;
  msicCode?: string;
  msicActivity?: string;
  sstNo?: string;
};

export type InvoiceVendor = AgreementVendor & { taxProfile?: TaxProfile };

export type InvoiceData = {
  orderId: string;
  vendor: InvoiceVendor;
  customerName: string;
  customerPhone?: string;
  rental: RentalSummary | null;
  fulfillment: "pickup" | "delivery";
  location?: string;
  timeSlot?: string | null;
  payment: PaymentState;
  /** Invoice date (when the order was placed). */
  createdAt: Date;
};

// ── Pure helpers (exported for testing) ─────────────────────────────────────

export function buildInvoiceNumber(orderId: string): string {
  return `INV-PK-${orderId.slice(0, 8).toUpperCase()}`;
}

export function formatMYR(amount: number): string {
  return amount.toFixed(2);
}

export function buildInvoiceMeta(date: Date, orderId: string) {
  return {
    invoiceNo: buildInvoiceNumber(orderId),
    dateStr: date.toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    timeStr: date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

/** "RM 144" or "RM 12.50", the same style as the cart. */
function rm(n: number): string {
  return `RM ${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** Build the receipt from a saved order. */
export function invoiceFromOrder(order: Order, vendor: InvoiceVendor): InvoiceData {
  const created = order.createdAt?.toDate?.() || (order.createdAt ? new Date(order.createdAt) : new Date());
  return {
    orderId: order.id,
    vendor,
    customerName: order.customerName || "General Public",
    customerPhone: order.customerPhone || undefined,
    rental: summaryFromOrder(order),
    fulfillment: order.fulfillmentType === "delivery" ? "delivery" : "pickup",
    location: order.pickupLocation || undefined,
    timeSlot: order.timeSlot,
    payment: getPayment(order),
    createdAt: isNaN(created.getTime()) ? new Date() : created,
  };
}

export type PaymentStatus = { tone: "paid" | "partial" | "due"; title: string; detail: string; figureLabel: string; figure: number };

/** Headline payment status, from the order's payment track. */
export function paymentStatus(p: PaymentState): PaymentStatus {
  if (p.depositOutcome === "kept" && p.rentalReceived) {
    return { tone: "paid", title: "Paid · Deposit kept", detail: `Rental ${rm(p.rental)} received. Security deposit ${rm(p.deposit)} kept by the supplier.`, figureLabel: "Amount retained", figure: p.rental + p.depositKept };
  }
  if (p.depositOutcome === "partial" && p.rentalReceived) {
    return { tone: "paid", title: "Paid · Deposit partly refunded", detail: `Rental ${rm(p.rental)} received. Deposit: ${rm(p.depositRefunded)} refunded, ${rm(p.depositKept)} kept.`, figureLabel: "Amount retained", figure: p.rental + p.depositKept };
  }
  if (p.depositOutcome === "refunded" && p.rentalReceived) {
    return { tone: "paid", title: "Paid · Deposit refunded", detail: `Rental ${rm(p.rental)} received. Security deposit ${rm(p.deposit)} refunded to the customer.`, figureLabel: "Rental paid", figure: p.rental };
  }
  if (p.fullyReceived) {
    return { tone: "paid", title: "Paid in full", detail: p.deposit > 0 ? `Rental ${rm(p.rental)} and refundable deposit ${rm(p.deposit)} received.` : "All charges received. Thank you.", figureLabel: "Amount paid", figure: p.total };
  }
  if (p.nothingReceived) {
    return { tone: "due", title: "Payment pending", detail: "No payment received yet.", figureLabel: "Amount due", figure: p.balanceDue };
  }
  const got = [p.depositReceived && `deposit ${rm(p.deposit)}`, p.rentalReceived && `rental ${rm(p.rental)}`].filter(Boolean).join(" and ");
  return { tone: "partial", title: "Partly paid", detail: `Received ${got}. The balance is still to be paid.`, figureLabel: "Balance due", figure: p.balanceDue };
}

// ── HTML ────────────────────────────────────────────────────────────────────

const TONES: Record<PaymentStatus["tone"], { fg: string; bg: string; border: string; icon: IconName }> = {
  paid: { fg: "#047857", bg: "#ecfdf5", border: "#6ee7b7", icon: "check" },
  partial: { fg: "#b45309", bg: "#fffbeb", border: "#fcd34d", icon: "shield" },
  due: { fg: "#b91c1c", bg: "#fef2f2", border: "#fca5a5", icon: "shield" },
};

const EXTRA_STYLES = `
  .status { display:flex; align-items:center; justify-content:space-between; gap:14px; border-radius:10px; padding:12px 14px; margin-top:14px; break-inside:avoid; }
  .kv { display:grid; grid-template-columns:repeat(3, 1fr); gap:0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-top:10px; }
  .kv div { padding:7px 10px; border-right:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb; }
  .kv div:nth-child(3n) { border-right:0; }
  .kv div:nth-last-child(-n+3) { border-bottom:0; }
  .kv b { display:block; color:#111827; font-size:10.5px; }
  table.items td { padding:5px 10px; }
  .party { padding:9px 12px; }`;

function supplierCard(v: InvoiceVendor) {
  const tp = v.taxProfile || {};
  const legal = tp.legalName?.trim();
  const display = legal || v.name;
  const trade = legal && legal !== v.name ? v.name : "";
  const address = tp.address || v.city || "";
  return `
    <div class="party"><div class="lbl">Supplier</div><b>${display}</b>
      ${trade ? `<div style="font-style:italic;color:#6b7280;">t/a ${trade}</div>` : ""}
      ${address ? `<div style="white-space:pre-line;">${address}</div>` : ""}
      ${v.phone ? `<div>Tel: ${v.phone}</div>` : ""}
      <div style="margin-top:4px;">TIN: <b style="display:inline;font-size:10.5px;color:#111827;">${tp.tin || "Not provided"}</b></div>
      ${tp.brn ? `<div>BRN (SSM): ${tp.brn}</div>` : ""}
      <div>${tp.sstNo ? `SST Reg.: ${tp.sstNo}` : "SST: Not applicable"} · MSIC: ${tp.msicCode || "7721"}</div>
      <div style="color:#6b7280;">${tp.msicActivity || "Rental and leasing of recreational and sports goods"}</div>
    </div>`;
}

function buyerCard(d: InvoiceData) {
  return `
    <div class="party"><div class="lbl">Buyer</div><b>${d.customerName}</b>
      ${d.customerPhone ? `<div>Tel: ${d.customerPhone}</div>` : ""}
      <div style="color:#6b7280;">TIN: General public (B2C)</div>
    </div>`;
}

function statusBox(s: PaymentStatus, p: PaymentState) {
  const t = TONES[s.tone];
  return `
    <div class="status" style="background:${t.bg};border:1.5px solid ${t.border};">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;color:${t.fg};">${iconSvg(t.icon, t.fg)}</span>
        <div>
          <div style="font-size:13px;font-weight:800;color:${t.fg};">${s.title}</div>
          <div style="color:#374151;">${s.detail}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:6px;">${paymentChips(p)}</div>
        </div>
      </div>
      <div style="text-align:right;white-space:nowrap;">
        <div class="lbl" style="color:${t.fg};margin:0;">${s.figureLabel}</div>
        <div style="font-size:18px;font-weight:900;color:${t.fg};">${rm(s.figure)}</div>
      </div>
    </div>`;
}

/** One line per payment: rental, deposit and balance due. */
function paymentChips(p: PaymentState) {
  const ok = (t: string) => `<span class="stamp">${iconSvg("check", "#16895B")} ${t}</span>`;
  const no = (t: string) => `<span class="stamp pending">${t}</span>`;
  const chips = [p.rentalReceived ? ok(`Rental ${rm(p.rental)} received`) : no(`Rental ${rm(p.rental)} not yet paid`)];
  if (p.deposit) {
    chips.push(
      p.depositOutcome === "kept" ? no(`Deposit ${rm(p.depositKept)} kept`)
      : p.depositOutcome === "partial" ? `${ok(`Deposit ${rm(p.depositRefunded)} refunded`)} ${no(`${rm(p.depositKept)} kept`)}`
      : p.depositOutcome === "refunded" ? ok(`Deposit ${rm(p.deposit)} refunded`)
      : p.depositReceived ? ok(`Deposit ${rm(p.deposit)} received, held`) : no(`Deposit ${rm(p.deposit)} not yet paid`));
  }
  chips.push(p.balanceDue ? no(`Balance due ${rm(p.balanceDue)}`) : ok("Balance due RM 0"));
  return chips.join("");
}

export function buildInvoiceHTML(raw: InvoiceData): string {
  const meta = buildInvoiceMeta(raw.createdAt, raw.orderId);
  const status = paymentStatus(raw.payment);
  const d = escapeDeep(raw);
  const r = d.rental;
  const period = r?.dates
    ? `${formatLongDate(r.dates.start)} – ${formatLongDate(r.dates.end)}${r.nights != null ? ` · ${durationLabel(r.nights)}` : ""}`
    : "As agreed";
  const invoiceDate = formatLongDate(isoDateMY(raw.createdAt));
  const sstRow = `
        <tr><td colspan="2" style="color:#4b5563;">SST (Sales and Service Tax)</td>
        <td style="text-align:right;color:#4b5563;white-space:nowrap;">${d.vendor.taxProfile?.sstNo ? "Included" : "RM 0 · Not applicable"}</td></tr>`;

  const content = `
    <div class="title">Tax Invoice / Receipt</div>
    <div class="sub">Issued to ${d.customerName} · ${period}</div>
    ${statusBox(escapeDeep(status), raw.payment)}

    <div class="sec">${sectionHead(1, "Supplier and Buyer")}
      <div style="display:flex;gap:12px;">${supplierCard(d.vendor)}${buyerCard(d)}</div>
    </div>

    <div class="sec">${sectionHead(2, "Invoice and Rental Details")}
      <div class="kv" style="margin-top:0;">
        <div><span class="lbl">Invoice no.</span><b class="mono">${meta.invoiceNo}</b></div>
        <div><span class="lbl">Invoice date</span><b>${invoiceDate}, ${meta.timeStr}</b></div>
        <div><span class="lbl">Order ref. · Type</span><b><span class="mono">${d.orderId.slice(0, 8).toUpperCase()}</span> · 01 Invoice · MYR</b></div>
        <div><span class="lbl">Rental period</span><b>${r?.dates ? `${formatLongDate(r.dates.start)} – ${formatLongDate(r.dates.end)}` : "As agreed"}</b></div>
        <div><span class="lbl">Duration</span><b>${r?.nights != null ? durationLabel(r.nights) : "—"}</b></div>
        <div><span class="lbl">${d.fulfillment === "delivery" ? "Delivery" : "Pickup"}</span><b>${d.location || "—"}${d.timeSlot ? ` · ${d.timeSlot}` : ""}</b></div>
      </div>
    </div>

    <div class="sec" style="break-inside:auto;page-break-inside:auto;">${sectionHead(3, "Items and Charges")}
      ${itemsTable(r, sstRow)}
    </div>

    <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #d1d5db;font-size:8.5px;color:#6b7280;line-height:1.6;break-inside:avoid;">
      <div>The security deposit is not a taxable supply. It is refunded when all items are returned in the same condition as collected.</div>
      <div>This is a computer-generated document issued by ${d.vendor.taxProfile?.legalName?.trim() || d.vendor.name} through Pacak Khemah. No signature is required.</div>
      <div>Pacak Khemah (pacakkhemah.com) provides the booking technology only and is not the seller in this transaction.</div>
    </div>`;

  return printDocument({
    title: `Invoice ${meta.invoiceNo}`,
    header: docHeader(d.vendor, "Tax Invoice / Receipt", [`No <span class="mono">${meta.invoiceNo}</span>`, `<span style="color:#6b7280;">${invoiceDate}</span>`]),
    footer: docFooter(d.vendor),
    content,
    extraStyles: EXTRA_STYLES,
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export function generateInvoicePDF(data: InvoiceData): void {
  openPrintWindow(buildInvoiceHTML(data));
}

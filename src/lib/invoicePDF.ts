export type InvoiceVendor = {
  name: string;
  phone?: string;
  city?: string;
  taxProfile?: {
    tin?: string;
    brn?: string;
    address?: string;
    msicCode?: string;
    msicActivity?: string;
    sstNo?: string;
  };
};

export type InvoiceItem = {
  name: string;
  qty: number;
  price: number;
  variantLabel?: string;
};

export type InvoiceData = {
  orderId: string;
  vendor: InvoiceVendor;
  customerName: string;
  customerPhone?: string;
  bookingDates: { start: string; end: string };
  pickupLocation: string;
  items: InvoiceItem[];
  rentalAmount: number;
  depositAmount?: number;
  serviceFee?: number;
  autoDiscount?: number;
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  totalAmount: number;
  paymentStatus?: string;
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

// ── HTML builder helpers ─────────────────────────────────────────────────────

function styles(): string {
  return `
<style>
  @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:#1a1a2e; font-size:11px; line-height:1.5; }
  .header-name { font-size:22px; font-weight:900; color:#062c24; text-transform:uppercase; letter-spacing:2px; }
  .header-line { height:3px; background:#062c24; margin-top:8px; margin-bottom:22px; }
  .badge { display:inline-block; font-size:9px; font-weight:700; text-transform:uppercase; padding:2px 7px; border-radius:99px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #e2e8f0; padding:8px 10px; }
  th { background:#f8fafc; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; text-align:left; }
  .total-row td { background:#062c24; color:#fff; font-weight:900; font-size:13px; }
  .footer { font-size:9px; color:#94a3b8; margin-top:28px; padding-top:12px; border-top:1px solid #e2e8f0; line-height:1.8; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>`;
}

function supplierBlock(vendor: InvoiceVendor): string {
  const tp = vendor.taxProfile || {};
  const address = tp.address || vendor.city || "";
  return `
    <div style="flex:1;min-width:0;">
      <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Supplier</p>
      <p style="font-size:13px;font-weight:900;color:#062c24;">${vendor.name}</p>
      ${address ? `<p style="font-size:10px;color:#475569;white-space:pre-line;">${address}</p>` : ""}
      ${vendor.phone ? `<p style="font-size:10px;color:#475569;">Tel: ${vendor.phone}</p>` : ""}
      <p style="font-size:10px;color:#475569;margin-top:4px;">TIN: <strong>${tp.tin || "NOT PROVIDED"}</strong></p>
      ${tp.brn ? `<p style="font-size:10px;color:#475569;">BRN (SSM): ${tp.brn}</p>` : ""}
      ${tp.sstNo ? `<p style="font-size:10px;color:#475569;">SST Reg.: ${tp.sstNo}</p>` : `<p style="font-size:10px;color:#475569;">SST: NOT APPLICABLE</p>`}
      <p style="font-size:10px;color:#475569;">MSIC: ${tp.msicCode || "7721"} — ${tp.msicActivity || "Rental and leasing of recreational and sports goods"}</p>
    </div>`;
}

function buyerBlock(data: InvoiceData): string {
  return `
    <div style="flex:1;min-width:0;">
      <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Buyer</p>
      <p style="font-size:13px;font-weight:900;color:#062c24;">${data.customerName || "General Public"}</p>
      ${data.customerPhone ? `<p style="font-size:10px;color:#475569;">Tel/IC: ${data.customerPhone}</p>` : `<p style="font-size:10px;color:#64748b;font-style:italic;">IC/TIN: General Public (B2C)</p>`}
    </div>`;
}

function metaBlock(meta: ReturnType<typeof buildInvoiceMeta>, data: InvoiceData): string {
  const paymentLabel: Record<string, string> = {
    unpaid: "Unpaid",
    deposit_paid: "Deposit Paid",
    full_paid: "Fully Paid",
    refunded: "Refunded",
    deposit_burnt: "Deposit Forfeited",
  };
  const ps = data.paymentStatus || "unpaid";
  const psColor = ps === "full_paid" || ps === "refunded" ? "#059669" :
                  ps === "deposit_paid" ? "#d97706" : "#dc2626";
  return `
    <div style="text-align:right;min-width:180px;">
      <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Invoice Details</p>
      <p style="font-size:11px;font-weight:700;color:#062c24;">No: ${meta.invoiceNo}</p>
      <p style="font-size:10px;color:#475569;">Date: ${meta.dateStr}</p>
      <p style="font-size:10px;color:#475569;">Time: ${meta.timeStr}</p>
      <p style="font-size:10px;color:#475569;">Currency: MYR</p>
      <p style="font-size:10px;color:#475569;">Type: 01 – Invoice</p>
      <p style="font-size:10px;font-weight:700;margin-top:6px;color:${psColor};">
        Payment: <span style="color:${psColor};">${paymentLabel[ps] || ps}</span>
      </p>
    </div>`;
}

function itemsTable(data: InvoiceData): string {
  const nights = (() => {
    try {
      const s = new Date(data.bookingDates.start);
      const e = new Date(data.bookingDates.end);
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
      return diff > 0 ? diff : 1;
    } catch { return 1; }
  })();

  const rows = data.items.map(i => `
    <tr>
      <td>${i.name}${i.variantLabel ? ` <span style="font-size:9px;color:#0d9488;">(${i.variantLabel})</span>` : ""} — ${nights} night${nights !== 1 ? "s" : ""}</td>
      <td style="text-align:center;">${i.qty}</td>
      <td style="text-align:right;">RM ${formatMYR(i.price)}/night</td>
      <td style="text-align:right;font-weight:700;">RM ${formatMYR(i.price * i.qty * nights)}</td>
    </tr>`).join("");

  const discountRows: string[] = [];
  if (data.autoDiscount) {
    discountRows.push(`
    <tr>
      <td colspan="3" style="color:#059669;font-size:10px;">Extended Stay Discount</td>
      <td style="text-align:right;color:#059669;font-weight:700;">− RM ${formatMYR(data.autoDiscount)}</td>
    </tr>`);
  }
  if (data.promoCode && data.promoDiscount) {
    const promoLabel = data.promoType === "fixed"
      ? `Promo "${data.promoCode}" (RM${data.promoDiscount} off)`
      : `Promo "${data.promoCode}"`;
    discountRows.push(`
    <tr>
      <td colspan="3" style="color:#059669;font-size:10px;">${promoLabel}</td>
      <td style="text-align:right;color:#059669;font-weight:700;">− RM ${formatMYR(data.promoDiscount)}</td>
    </tr>`);
  }

  const serviceFeeRow = data.serviceFee ? `
    <tr style="background:#f8fafc;">
      <td colspan="3" style="font-size:10px;color:#475569;">Service Fee (Delivery/Setup)</td>
      <td style="text-align:right;font-weight:600;">RM ${formatMYR(data.serviceFee)}</td>
    </tr>` : "";

  const rentalAmount = data.rentalAmount;
  const depositAmount = data.depositAmount || 0;

  const rentalRow = `
    <tr style="background:#f0fdf4;">
      <td colspan="3" style="font-weight:700;color:#062c24;">Rental Amount (Taxable Supply)</td>
      <td style="text-align:right;font-weight:800;color:#062c24;">RM ${formatMYR(rentalAmount)}</td>
    </tr>`;

  const depositRow = depositAmount ? `
    <tr style="background:#fffbeb;">
      <td colspan="3">
        Security Deposit
        <span class="badge" style="background:#fef3c7;color:#78350f;margin-left:6px;">REFUNDABLE</span>
        <span style="font-size:9px;color:#64748b;display:block;margin-top:2px;">Not a taxable supply — returned upon gear return in good condition</span>
      </td>
      <td style="text-align:right;font-weight:700;color:#92400e;">RM ${formatMYR(depositAmount)}</td>
    </tr>` : "";

  const sstRow = `
    <tr style="background:#f8fafc;">
      <td colspan="3" style="font-size:10px;color:#475569;">SST (Sales &amp; Service Tax)</td>
      <td style="text-align:right;font-size:10px;color:#475569;">RM 0.00 (Exempt / Not Applicable)</td>
    </tr>`;

  const totalRow = `
    <tr class="total-row">
      <td colspan="3" style="text-align:right;font-size:11px;">TOTAL PAYABLE</td>
      <td style="text-align:right;font-size:15px;">RM ${formatMYR(data.totalAmount)}</td>
    </tr>`;

  return `
  <table>
    <thead>
      <tr>
        <th style="width:45%;">Description</th>
        <th style="width:10%;text-align:center;">Qty</th>
        <th style="width:20%;text-align:right;">Unit Rate</th>
        <th style="width:25%;text-align:right;">Amount (MYR)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${discountRows.join("")}
      ${serviceFeeRow}
      ${rentalRow}
      ${depositRow}
      ${sstRow}
    </tbody>
    <tfoot>
      ${totalRow}
    </tfoot>
  </table>`;
}

function buildHTML(data: InvoiceData): string {
  const meta = buildInvoiceMeta(data.createdAt, data.orderId);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${meta.invoiceNo}</title>
${styles()}
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
  <div>
    <div class="header-name">${data.vendor.name}</div>
    <div style="font-size:11px;color:#475569;margin-top:2px;">TAX INVOICE / RECEIPT</div>
  </div>
</div>
<div class="header-line"></div>

<div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:20px;">
  ${supplierBlock(data.vendor)}
  ${buyerBlock(data)}
  ${metaBlock(meta, data)}
</div>

<div style="margin-bottom:14px;">
  <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Rental Period &amp; Pickup</div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:11px;">
    <span style="font-weight:700;">Period:</span> ${data.bookingDates.start} → ${data.bookingDates.end}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <span style="font-weight:700;">Pickup:</span> ${data.pickupLocation}
  </div>
</div>

<div style="margin-bottom:20px;">
  <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Items &amp; Charges</div>
  ${itemsTable(data)}
</div>

<div class="footer">
  <p><strong>Note:</strong> Security deposit (if any) is refundable upon return of all equipment in the same condition as collected.</p>
  <p>This is a computer-generated document. This invoice is issued by <strong>${data.vendor.name}</strong> via the Pacak Khemah platform.</p>
  <p>Pacak Khemah (pacakkhemah.com) is a technology platform provider and is NOT the seller under this transaction.</p>
  ${data.vendor.taxProfile?.tin ? `<p>Supplier TIN: ${data.vendor.taxProfile.tin} | Classification: 01 – Invoice | Currency: MYR</p>` : ""}
</div>

<script>window.onload = () => window.print();<\/script>
</body></html>`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function generateInvoicePDF(data: InvoiceData): void {
  const html = buildHTML(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

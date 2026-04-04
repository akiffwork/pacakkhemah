/**
 * Agreement PDF Generator
 * Shared utility for generating professional rental agreement PDFs
 * Used by: DocumentsTab (vendor), Agreement page (customer)
 */

type PDFVendor = {
  name: string;
  phone?: string;
  city?: string;
};

type PDFBooking = {
  items?: { name: string; qty: number; price?: number }[];
  dates?: { start: string; end: string };
  total?: number;
};

type PDFAgreement = {
  customerName: string;
  customerPhone?: string;
  refNo: string;
  signedDate: string;
  signedFull: string;
};

type PDFImages = {
  frontUrl?: string;
  backUrl?: string;
};

const DEFAULT_RULES = [
  "Equipment must be returned in the same condition as received.",
  "Renter is liable for full replacement cost of lost or damaged items.",
  "Late return will incur additional charges per day as agreed.",
  "The renter must inspect all equipment upon collection and report any defects immediately.",
  "Subletting or transferring the rented equipment to a third party is strictly prohibited.",
];

function buildHeader(vendorName: string) {
  return `
    <div class="header-name">${vendorName.toUpperCase()}</div>
    <div class="header-line"></div>`;
}

function buildFooter(vendor: PDFVendor) {
  return `
    <div class="footer">
      ${vendor.phone ? `<div>Phone: ${vendor.phone}</div>` : ""}
      ${vendor.city ? `<div>Location: ${vendor.city}</div>` : ""}
      <div>Platform: pacakkhemah.com</div>
    </div>`;
}

function buildStyles() {
  return `
<style>
  @page { size: A4; margin: 20mm 18mm 24mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color:#1a1a2e; font-size:11px; line-height:1.5; }
  .page { page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }
  .header-name { font-size: 22px; font-weight: 900; color: #062c24; text-transform: uppercase; letter-spacing: 2px; }
  .header-line { height: 3px; background: #062c24; margin-top: 8px; margin-bottom: 24px; }
  .section { margin-bottom: 20px; page-break-inside: avoid; }
  .section-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; }
  .footer { font-size: 9px; color: #888; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; line-height: 1.7; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>`;
}

function buildPage1(vendor: PDFVendor, agreement: PDFAgreement, booking: PDFBooking | null, rules: string[]) {
  const itemsRows = booking?.items?.length
    ? booking.items.map(i => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;font-size:11px;">${i.name}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;font-size:11px;">${i.qty}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-size:11px;">${i.price ? `RM${i.price * i.qty}` : ""}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" style="padding:12px;border:1px solid #ddd;color:#999;font-style:italic;font-size:11px;">Items as discussed via WhatsApp / Chat Record</td></tr>`;

  const rulesHtml = rules.map(r => `
    <li style="margin-bottom:6px;font-size:11px;color:#333;line-height:1.6;">${r}</li>`).join("");

  const dateRange = booking?.dates ? ` (${booking.dates.start} – ${booking.dates.end})` : "";

  return `
<div class="page">
  ${buildHeader(vendor.name)}

  <div style="margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;"><span style="color:#888;">Date:</span><span style="font-weight:700;">${agreement.signedDate}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;"><span style="color:#888;">Our Ref:</span><span style="font-weight:700;">${agreement.refNo}</span></div>
  </div>

  <h1 style="font-size:14px;font-weight:800;text-transform:uppercase;color:#062c24;margin-bottom:20px;">
    EQUIPMENT RENTAL AGREEMENT${dateRange}
  </h1>

  <div class="section">
    <div class="section-title">1) &nbsp; CONTRACTING PARTIES</div>
    <div style="margin-bottom:12px;">
      <p style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">The Vendor (Owner)</p>
      <p style="font-size:12px;font-weight:800;color:#062c24;">${vendor.name}</p>
      ${vendor.phone ? `<p style="font-size:11px;color:#444;">Phone: ${vendor.phone}</p>` : ""}
      ${vendor.city ? `<p style="font-size:11px;color:#444;">${vendor.city}</p>` : ""}
    </div>
    <div style="margin-bottom:12px;">
      <p style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;">The Customer (Renter)</p>
      <p style="font-size:12px;font-weight:800;color:#062c24;">${agreement.customerName}</p>
      ${agreement.customerPhone ? `<p style="font-size:11px;color:#444;">Phone: ${agreement.customerPhone}</p>` : ""}
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;padding:10px 14px;font-size:10px;color:#92400e;font-weight:600;line-height:1.6;">
      <strong>LEGAL NOTICE:</strong> This agreement is entered into solely between the Vendor and the Customer. "Pacak Khemah" is a technology platform provider and is NOT a party to this rental contract.
    </div>
  </div>

  <div class="section">
    <div class="section-title">2) &nbsp; SUBJECT OF RENTAL</div>
    <table>
      <thead><tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;">Description</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:center;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;width:60px;">Qty</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;width:100px;">Amount (RM)</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:10px 12px;border:1px solid #ddd;text-align:right;font-size:11px;font-weight:700;">Total Amount (RM)</td>
        <td style="padding:10px 12px;border:1px solid #ddd;text-align:right;font-size:13px;font-weight:900;color:#062c24;">${booking?.total ? `RM${booking.total}` : "—"}</td>
      </tr></tfoot>
    </table>
    <div style="margin-top:10px;"><span style="font-size:10px;color:#888;font-weight:700;">Rental Period:</span> <span style="font-size:11px;font-weight:700;">${booking?.dates?.start || "TBD"} — ${booking?.dates?.end || "TBD"}</span></div>
  </div>

  <div class="section">
    <div class="section-title">3) &nbsp; SERVICE TERMS AND CONDITIONS</div>
    <ul style="padding-left:20px;">${rulesHtml}</ul>
  </div>

  ${buildFooter(vendor)}
</div>`;
}

function buildPage2(vendor: PDFVendor, agreement: PDFAgreement) {
  return `
<div class="page" style="page-break-before:always;">
  ${buildHeader(vendor.name)}

  <div class="section">
    <div class="section-title">4) &nbsp; DECLARATION & ACKNOWLEDGEMENT</div>
    <p style="font-size:11px;color:#333;line-height:1.8;margin-bottom:16px;">
      I, <strong>${agreement.customerName}</strong>, hereby acknowledge that I have read, understood, and agreed to all the Terms & Conditions stated above.
      I certify that the identification documents provided are genuine and belong to me.
      I understand that my ID will be stored securely for verification purposes by the Vendor.
      I accept full responsibility for the rented equipment during the rental period and agree to return all items in the same condition as received.
    </p>
  </div>

  <div class="section">
    <div class="section-title">5) &nbsp; ACCEPTANCE</div>
    <p style="font-size:11px;color:#333;line-height:1.7;margin-bottom:28px;">
      The signatures below indicate acceptance of the details, terms, and conditions in this agreement and provide approval to rent the items as specified.
    </p>

    <div style="margin-bottom:40px;">
      <p style="font-size:11px;color:#333;margin-bottom:4px;">For, <strong>${vendor.name}</strong></p>
      <div style="margin-top:50px;border-top:1px solid #333;width:250px;padding-top:6px;">
        <p style="font-size:11px;font-weight:700;">${vendor.name}</p>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <p style="font-size:11px;font-weight:700;color:#333;margin-bottom:16px;">For <strong>Customer,</strong></p>
      <div style="display:flex;gap:40px;margin-bottom:20px;">
        <div style="flex:1;"><p style="font-size:10px;color:#888;margin-bottom:4px;">Signature:</p><div style="border-bottom:1px solid #333;height:40px;"></div></div>
      </div>
      <div style="display:flex;gap:40px;margin-bottom:20px;">
        <div style="flex:1;"><p style="font-size:10px;color:#888;margin-bottom:4px;">Name:</p><p style="font-size:12px;font-weight:700;border-bottom:1px solid #333;padding-bottom:4px;">${agreement.customerName}</p></div>
        <div style="flex:1;"><p style="font-size:10px;color:#888;margin-bottom:4px;">Phone:</p><p style="font-size:12px;font-weight:700;border-bottom:1px solid #333;padding-bottom:4px;">${agreement.customerPhone || "—"}</p></div>
      </div>
      <div style="display:flex;gap:40px;">
        <div style="flex:1;"><p style="font-size:10px;color:#888;margin-bottom:4px;">Date:</p><p style="font-size:12px;font-weight:700;border-bottom:1px solid #333;padding-bottom:4px;">${agreement.signedFull}</p></div>
        <div style="flex:1;"><p style="font-size:10px;color:#888;margin-bottom:4px;">Digitally Signed:</p><p style="font-size:10px;font-weight:600;color:#059669;">✓ Verified via Pacak Khemah Platform</p></div>
      </div>
    </div>
  </div>

  ${buildFooter(vendor)}
</div>`;
}

function buildICPage(vendor: PDFVendor, images: PDFImages) {
  if (!images.frontUrl || !images.backUrl) return "";
  return `
<div class="page" style="page-break-before:always;">
  ${buildHeader(vendor.name)}

  <h2 style="font-size:13px;font-weight:700;margin-bottom:20px;">6) &nbsp; IDENTITY VERIFICATION DOCUMENTS</h2>
  <p style="font-size:11px;color:#555;margin-bottom:20px;">The following identification documents were submitted by the Customer as part of the rental agreement verification process.</p>
  <div style="margin-bottom:24px;">
    <p style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;margin-bottom:8px;">Front — IC / MyKad</p>
    <img src="${images.frontUrl}" style="width:100%;max-height:280px;object-fit:contain;border:1px solid #ddd;" crossorigin="anonymous">
  </div>
  <div style="margin-bottom:24px;">
    <p style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;margin-bottom:8px;">Back — IC / MyKad</p>
    <img src="${images.backUrl}" style="width:100%;max-height:280px;object-fit:contain;border:1px solid #ddd;" crossorigin="anonymous">
  </div>

  ${buildFooter(vendor)}
</div>`;
}

export function generateAgreementPDF(
  vendor: PDFVendor,
  agreement: PDFAgreement,
  booking: PDFBooking | null,
  rules?: string[],
  images?: PDFImages,
) {
  const finalRules = rules?.length ? rules : DEFAULT_RULES;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Agreement ${agreement.refNo}</title>
${buildStyles()}
</head><body>
${buildPage1(vendor, agreement, booking, finalRules)}
${buildPage2(vendor, agreement)}
${images ? buildICPage(vendor, images) : ""}
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

/** Helper to generate ref number and formatted dates from a Date */
export function buildAgreementMeta(date: Date, uniqueId: string) {
  return {
    refNo: `PK-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}-${uniqueId.substring(0, 6).toUpperCase()}`,
    signedDate: date.toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    signedFull: date.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}
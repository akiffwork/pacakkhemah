/**
 * Agreement PDF
 * Prints the rental agreement with the same sections and wording as the
 * agreement page (see agreementDocument.ts). Header (logo, shop address) and
 * footer (contact + social links) repeat on every printed page.
 * Used by: Orders › Agreements and the order detail (vendor), Agreement page (customer)
 */

import { idLine } from "./customerId";
import { durationLabel, formatLongDate, rowAmount, type RentalSummary } from "./rentalSummary";
import {
  AGREEMENT_TITLE, SECTION_TITLES, declarationText, formatSignedAt, shopAddress, socialLinks,
  type AgreementDoc,
} from "./agreementDocument";
import { iconSvg } from "./agreementIcons";

const GREEN = "#062c24";
const ACCENT = "#16895B";
const HEADER_H = 32; // mm, space reserved on every page
const FOOTER_H = 18;

/** Escape text for HTML. Agreement data is typed by anyone with the link,
 *  so it must never be able to inject markup into the print window. */
function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deep-copy a value with every string HTML-escaped (Dates kept). */
export function escapeDeep<T>(v: T): T {
  if (typeof v === "string") return esc(v) as T;
  if (v instanceof Date) return v;
  if (Array.isArray(v)) return v.map(escapeDeep) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, escapeDeep(x)])) as T;
  }
  return v;
}

const httpsOnly = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "PK";
}

function styles() {
  return `
<style>
  /* No page margins: the header, footer and side padding are part of the
     document, so it prints the same with any browser margin setting. */
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { background:#fff; }
  body { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color:#1f2937; font-size:10.5px; line-height:1.55;
         max-width:210mm; margin:0 auto; overflow-wrap:anywhere; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .hdr { position:fixed; top:0; left:0; right:0; height:${HEADER_H}mm; padding:10mm 16mm 0; background:#fff; max-width:210mm; margin:0 auto; }
  .hdr-in { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:4mm; border-bottom:2px solid ${GREEN}; }
  .ftr { position:fixed; bottom:0; left:0; right:0; height:${FOOTER_H}mm; padding:0 16mm 8mm; background:#fff; max-width:210mm; margin:0 auto; display:flex; flex-direction:column; justify-content:flex-end; }
  .ftr-in { display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:3mm; border-top:1px solid #d1d5db; font-size:8.5px; color:#6b7280; }
  .socials { display:flex; flex-wrap:wrap; gap:4px 12px; }
  .socials span { display:inline-flex; align-items:center; gap:4px; color:#374151; }
  table.layout { width:100%; border-collapse:collapse; }
  table.layout > thead td { height:${HEADER_H + 4}mm; }
  table.layout > tfoot td { height:${FOOTER_H + 2}mm; }
  table.layout > tbody > tr > td { padding:0 16mm; vertical-align:top; }
  .title { font-size:19px; font-weight:800; color:${GREEN}; letter-spacing:-0.2px; }
  .sub { font-size:10px; color:#6b7280; margin-top:2px; }
  .sec { margin-top:16px; break-inside:avoid; page-break-inside:avoid; }
  .sec-h { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .sec-n { font-size:9px; font-weight:800; color:#fff; background:${GREEN}; border-radius:4px; padding:2px 5px; letter-spacing:0.5px; }
  .sec-t { font-size:10.5px; font-weight:800; color:${GREEN}; text-transform:uppercase; letter-spacing:1.2px; }
  .sec-rule { flex:1; height:1px; background:#e5e7eb; }
  .lbl { font-size:8px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; }
  .party { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
  .party b { font-size:12px; color:${GREEN}; display:block; margin-bottom:2px; }
  .party div { color:#374151; }
  ol.terms { padding-left:18px; }
  ol.terms li { margin-bottom:5px; padding-left:2px; }
  table.items { width:100%; border-collapse:collapse; }
  table.items th { padding:7px 10px; background:#f3f4f6; border:1px solid #e5e7eb; font-size:8.5px; font-weight:700; color:#4b5563; text-transform:uppercase; letter-spacing:0.6px; }
  table.items td { padding:7px 10px; border:1px solid #e5e7eb; vertical-align:top; }
  .note { font-size:8.5px; color:#6b7280; margin-top:5px; }
  .decl { background:#f9fafb; border-left:3px solid ${ACCENT}; padding:10px 12px; border-radius:0 6px 6px 0; }
  .sig { flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; break-inside:avoid; }
  .sig-name { font-family: Georgia, 'Times New Roman', serif; font-style:italic; font-size:19px; color:#111827; border-bottom:1px solid #9ca3af; padding:6px 0 4px; margin:4px 0 6px; min-height:34px; }
  .stamp { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:700; color:${ACCENT}; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:99px; padding:2px 8px; }
  .pending { color:#92400e; background:#fffbeb; border-color:#fde68a; }
  .verify { margin-top:10px; display:flex; justify-content:space-between; gap:10px; font-size:9px; color:#4b5563; border:1px dashed #d1d5db; border-radius:6px; padding:7px 10px; }
  .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-weight:700; color:#111827; letter-spacing:0.5px; }
</style>`;
}

function header(d: AgreementDoc) {
  const v = d.vendor;
  const logo = httpsOnly(v.image) || (v.image?.startsWith("/") ? v.image : undefined);
  return `
<div class="hdr"><div class="hdr-in">
  <div style="display:flex;align-items:center;gap:10px;min-width:0;">
    ${logo
      ? `<img src="${logo}" alt="" style="width:13mm;height:13mm;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">`
      : `<div style="width:13mm;height:13mm;border-radius:8px;background:${GREEN};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">${initials(v.name)}</div>`}
    <div style="min-width:0;">
      <div style="font-size:15px;font-weight:800;color:${GREEN};line-height:1.2;">${v.name}</div>
      <div style="font-size:9px;color:#4b5563;display:flex;align-items:center;gap:4px;margin-top:2px;">${iconSvg("globe", ACCENT)} ${shopAddress(v.slug)}</div>
      ${v.city ? `<div style="font-size:9px;color:#6b7280;">${v.city}</div>` : ""}
    </div>
  </div>
  <div style="text-align:right;white-space:nowrap;">
    <div style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${ACCENT};text-transform:uppercase;">Rental Agreement</div>
    ${d.refNo ? `<div style="font-size:9px;color:#374151;margin-top:2px;">Ref <span class="mono">${d.refNo}</span></div>` : ""}
    ${d.customerSignedAt ? `<div style="font-size:9px;color:#6b7280;">${formatLongDate(isoDate(d.customerSignedAt))}</div>` : ""}
  </div>
</div></div>`;
}

function footer(d: AgreementDoc) {
  const links = socialLinks(d.vendor);
  return `
<div class="ftr"><div class="ftr-in">
  <div class="socials">${links.map(l => `<span>${iconSvg(l.icon, GREEN)} ${l.label}</span>`).join("") || `<span>${d.vendor.name}</span>`}</div>
  <div style="white-space:nowrap;">Issued via <b style="color:${GREEN};">Pacak Khemah</b> · pacakkhemah.com</div>
</div></div>`;
}

function isoDate(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // YYYY-MM-DD
}

function sectionHead(n: number) {
  return `<div class="sec-h"><span class="sec-n">${String(n).padStart(2, "0")}</span><span class="sec-t">${SECTION_TITLES[n - 1]}</span><span class="sec-rule"></span></div>`;
}

function itemsTable(r: RentalSummary | null) {
  const sub = "font-size:9.5px;color:#4b5563;margin-top:2px;font-weight:400;";
  const lines = r?.lines || [];
  const free = r?.freeItems || [];
  const body = lines.length || free.length
    ? lines.map(i => {
        const extras = [
          i.variantLabel ? `<div style="${sub}">${i.variantColor && /^#[0-9a-f]{3,8}$/i.test(i.variantColor) ? `<span style="display:inline-block;width:8px;height:8px;border-radius:99px;border:1px solid #9ca3af;background:${i.variantColor};margin-right:5px;vertical-align:-1px;"></span>` : ""}${i.variantLabel}</div>` : "",
          i.calc ? `<div style="${sub}color:#6b7280;">${i.calc}</div>` : "",
          i.includes.length ? `<div style="${sub}border-left:2px solid #d1d5db;padding-left:7px;">${i.includes.map(li => `Includes: ${li.qty} × ${li.name}${li.variantLabel ? ` (${li.variantLabel})` : ""}`).join("<br>")}</div>` : "",
        ].join("");
        const setup = i.setupFee != null ? `
        <tr><td style="padding-left:22px;color:#4b5563;font-size:9.5px;">Add-on: setup at campsite</td><td></td>
        <td style="text-align:right;color:#4b5563;font-size:9.5px;">${i.setupFee ? `RM ${i.setupFee}` : "Included"}</td></tr>` : "";
        return `
        <tr><td style="font-weight:700;color:#111827;">${i.name}${extras}</td>
        <td style="text-align:center;">${i.qty}</td>
        <td style="text-align:right;font-weight:700;color:#111827;white-space:nowrap;">${i.amount != null ? `RM ${i.amount}` : "—"}</td></tr>${setup}`;
      }).join("") + free.map(f => `
        <tr><td style="font-weight:700;color:#111827;">${f.name}</td><td style="text-align:center;">${f.qty}</td>
        <td style="text-align:right;"><span style="font-size:8px;background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:99px;font-weight:700;">FREE ITEM</span></td></tr>`).join("")
    : `<tr><td colspan="3" style="color:#6b7280;font-style:italic;">Items as discussed via WhatsApp / chat</td></tr>`;

  const rows = (r?.rows || []).map(row => {
    if (row.kind === "total") return `
        <tr style="background:${GREEN};"><td colspan="2" style="border-color:${GREEN};text-align:right;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.6px;">${row.label}</td>
        <td style="border-color:${GREEN};text-align:right;font-size:13px;font-weight:900;color:#fff;white-space:nowrap;">${rowAmount(row)}</td></tr>`;
    const color = row.kind === "discount" ? "#047857" : row.kind === "strong" ? GREEN : "#4b5563";
    const weight = row.kind === "strong" ? 800 : 600;
    const code = row.code ? ` <span style="font-size:8.5px;border:1px dashed #6b7280;color:#111827;padding:1px 5px;border-radius:4px;margin-left:4px;">${row.code}</span>` : "";
    return `
        <tr${row.kind === "strong" ? ' style="background:#f0fdf4;"' : ""}><td colspan="2" style="font-weight:${weight};color:${color};">${row.label}${code}</td>
        <td style="text-align:right;font-weight:${weight + 100};color:${color};white-space:nowrap;">${rowAmount(row)}</td></tr>`;
  }).join("");

  return `
    <table class="items">
      <thead><tr><th style="text-align:left;">Item</th><th style="width:48px;">Qty</th><th style="text-align:right;width:96px;">Amount</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot>${rows}</tfoot>
    </table>
    ${r?.note ? `<p class="note">${r.note}</p>` : ""}`;
}

/** "Validity. Text…" → bold lead-in. */
function clause(t: string) {
  const m = t.match(/^([^.]{2,40})\.\s+(.*)$/);
  return m ? `<b style="color:#111827;">${m[1]}.</b> ${m[2]}` : t;
}

function signatures(d: AgreementDoc) {
  const vendorBox = `
    <div class="sig">
      <div class="lbl">The Vendor (Owner)</div>
      <div class="sig-name">${d.vendor.name}</div>
      <div><span class="stamp">${iconSvg("check", ACCENT)} Digitally signed</span></div>
      <div style="margin-top:6px;color:#374151;">${d.vendorSignedAt ? formatSignedAt(d.vendorSignedAt) : "On issue"}</div>
      <div style="font-size:9px;color:#6b7280;">Issued through the Vendor's Pacak Khemah account</div>
    </div>`;
  const signed = !!d.customerSignedAt;
  const customerBox = `
    <div class="sig">
      <div class="lbl">The Customer (Renter)</div>
      <div class="sig-name">${signed ? d.customerSignature || d.customer.name : ""}</div>
      <div>${signed
        ? `<span class="stamp">${iconSvg("check", ACCENT)} Digitally signed</span>`
        : `<span class="stamp pending">Awaiting signature</span>`}</div>
      <div style="margin-top:6px;color:#374151;">${signed ? formatSignedAt(d.customerSignedAt) : "&nbsp;"}</div>
      <div style="font-size:9px;color:#6b7280;">${d.customer.name}${d.customer.idNumber ? ` · ${idLine(d.customer.idType, d.customer.idNumber)}` : ""}</div>
    </div>`;
  return `
    <div style="display:flex;gap:12px;">${vendorBox}${customerBox}</div>
    ${d.verificationCode || d.refNo ? `
    <div class="verify">
      <span style="display:inline-flex;align-items:center;gap:5px;">${iconSvg("shield", GREEN)} Signed electronically on Pacak Khemah. This document is valid without a handwritten signature.</span>
      <span style="white-space:nowrap;">${d.verificationCode ? `Verification <span class="mono">${d.verificationCode}</span>` : `Ref <span class="mono">${d.refNo}</span>`}</span>
    </div>` : ""}`;
}

function photosPage(d: AgreementDoc) {
  const p = d.photos;
  if (!p?.frontUrl || !p?.backUrl) return "";
  return `
    <div style="break-before:page;page-break-before:always;">
      <div class="sec-h"><span class="sec-n">A</span><span class="sec-t">Appendix: Identity Documents</span><span class="sec-rule"></span></div>
      <p style="color:#4b5563;margin-bottom:12px;">Identification photos submitted by the Customer with this agreement (agreements signed before ID numbers replaced photo uploads).</p>
      <div class="lbl">Front — IC / MyKad</div>
      <img src="${p.frontUrl}" alt="" style="width:100%;max-height:85mm;object-fit:contain;border:1px solid #e5e7eb;margin-bottom:14px;">
      <div class="lbl">Back — IC / MyKad</div>
      <img src="${p.backUrl}" alt="" style="width:100%;max-height:85mm;object-fit:contain;border:1px solid #e5e7eb;">
    </div>`;
}

/** The full print document. Exported for tests. */
export function buildAgreementHTML(raw: AgreementDoc): string {
  const photos = raw.photos && httpsOnly(raw.photos.frontUrl) && httpsOnly(raw.photos.backUrl) ? raw.photos : undefined;
  const d = escapeDeep({ ...raw, photos });
  const r = d.rental;
  const idText = d.customer.idNumber ? idLine(d.customer.idType, d.customer.idNumber) : "";
  const period = r?.dates
    ? `${formatLongDate(r.dates.start)} – ${formatLongDate(r.dates.end)}${r.nights != null ? ` · ${durationLabel(r.nights)}` : ""}`
    : "As agreed in chat";

  const content = `
    <div class="title">${AGREEMENT_TITLE}</div>
    <div class="sub">Between ${d.vendor.name} and ${d.customer.name || "the Customer"} · ${period}</div>

    <div class="sec">${sectionHead(1)}
      <div style="display:flex;gap:12px;">
        <div class="party"><div class="lbl">The Vendor (Owner)</div><b>${d.vendor.name}</b>
          <div>${shopAddress(d.vendor.slug)}</div>
          ${d.vendor.phone ? `<div>Phone: ${d.vendor.phone}</div>` : ""}
          ${d.vendor.city ? `<div>${d.vendor.city}</div>` : ""}
        </div>
        <div class="party"><div class="lbl">The Customer (Renter)</div><b>${d.customer.name || "—"}</b>
          ${d.customer.phone ? `<div>Phone: ${d.customer.phone}</div>` : ""}
          ${idText ? `<div>${idText}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="sec">${sectionHead(2)}
      <div style="margin-bottom:6px;"><span class="lbl" style="display:inline;">Rental period</span> &nbsp;<b style="color:#111827;">${period}</b></div>
      ${itemsTable(r)}
    </div>

    <div class="sec">${sectionHead(3)}
      <p style="color:#6b7280;margin-bottom:6px;">Set by ${d.vendor.name}.</p>
      <ol class="terms">${d.vendorTerms.map(t => `<li>${t}</li>`).join("")}</ol>
    </div>

    <div class="sec">${sectionHead(4)}
      <ol class="terms">${d.generalTerms.map(t => `<li>${clause(t)}</li>`).join("")}</ol>
    </div>

    <div class="sec">${sectionHead(5)}
      <p class="decl">${declarationText(d.customer, idText)}</p>
    </div>

    <div class="sec">${sectionHead(6)}
      ${signatures(d)}
    </div>
    ${photosPage(d)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${AGREEMENT_TITLE}${d.refNo ? ` ${d.refNo}` : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
${styles()}
</head><body>
${header(d)}
${footer(d)}
<table class="layout">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td></td></tr></tfoot>
  <tbody><tr><td>${content}</td></tr></tbody>
</table>
<script>
  window.onload = async () => {
    try { await document.fonts.ready; } catch (e) {}
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; })));
    window.print();
  };
<\/script>
</body></html>`;
}

export function generateAgreementPDF(doc: AgreementDoc) {
  const html = buildAgreementHTML(doc);
  // Open via blob: URL so the print window has a real origin (pacakkhemah.com)
  // instead of null (about:blank). Null-origin windows block external image
  // loads (shop logo, older agreements' IC photos).
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

/** Reference number and dates from a Date. */
export function buildAgreementMeta(date: Date, uniqueId: string) {
  return {
    refNo: `PK-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}-${uniqueId.substring(0, 6).toUpperCase()}`,
    signedDate: date.toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    signedFull: date.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

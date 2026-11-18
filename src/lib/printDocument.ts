// src/lib/printDocument.ts
// Shared print layout for Pacak Khemah documents (rental agreement, receipt):
// vendor header with logo and shop address, footer with contact and social
// links, numbered sections and the items table. The header and footer repeat
// on every printed page with fixed margins, whatever the print settings.

import { formatLongDate, rowAmount, type RentalSummary } from "./rentalSummary";
import { shopAddress, socialLinks, type AgreementVendor } from "./agreementDocument";
import { iconSvg } from "./agreementIcons";

export const GREEN = "#062c24";
export const ACCENT = "#16895B";
const HEADER_H = 32; // mm reserved on every page
const FOOTER_H = 18;

/** Escape text for HTML. Document data can be typed by customers, so it must
 *  never be able to inject markup into the print window. */
export function esc(v: string): string {
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

export const httpsOnly = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "PK";
}

/** YYYY-MM-DD in Malaysia time. */
export function isoDateMY(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function baseStyles(extra = "") {
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
  .party { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; min-width:0; }
  .party b { font-size:12px; color:${GREEN}; display:block; margin-bottom:2px; }
  .party div { color:#374151; }
  table.items { width:100%; border-collapse:collapse; }
  table.items th { padding:7px 10px; background:#f3f4f6; border:1px solid #e5e7eb; font-size:8.5px; font-weight:700; color:#4b5563; text-transform:uppercase; letter-spacing:0.6px; }
  table.items td { padding:7px 10px; border:1px solid #e5e7eb; vertical-align:top; }
  .note { font-size:8.5px; color:#6b7280; margin-top:5px; }
  .stamp { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:700; color:${ACCENT}; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:99px; padding:2px 8px; }
  .pending { color:#92400e; background:#fffbeb; border-color:#fde68a; }
  .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-weight:700; color:#111827; letter-spacing:0.5px; }
  ${extra}
</style>`;
}

/** Vendor header. `right` lines are already-escaped HTML. */
export function docHeader(v: AgreementVendor, label: string, right: string[]) {
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
    <div style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:${ACCENT};text-transform:uppercase;">${label}</div>
    ${right.map(r => `<div style="font-size:9px;color:#374151;margin-top:1px;">${r}</div>`).join("")}
  </div>
</div></div>`;
}

export function docFooter(v: AgreementVendor) {
  const links = socialLinks(v);
  return `
<div class="ftr"><div class="ftr-in">
  <div class="socials">${links.map(l => `<span>${iconSvg(l.icon, GREEN)} ${l.label}</span>`).join("") || `<span>${v.name}</span>`}</div>
  <div style="white-space:nowrap;">Issued via <b style="color:${GREEN};">Pacak Khemah</b> · pacakkhemah.com</div>
</div></div>`;
}

export function sectionHead(n: number | string, title: string) {
  return `<div class="sec-h"><span class="sec-n">${typeof n === "number" ? String(n).padStart(2, "0") : n}</span><span class="sec-t">${title}</span><span class="sec-rule"></span></div>`;
}

/** Items and price rows, exactly as the cart showed them. `extraRows` go before the total. */
export function itemsTable(r: RentalSummary | null, extraRows = "") {
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
    if (row.kind === "total") return `${extraRows}
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

/** Whole print document: fixed header/footer around the content. */
export function printDocument(opts: { title: string; header: string; footer: string; content: string; extraStyles?: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
${baseStyles(opts.extraStyles)}
</head><body>
${opts.header}
${opts.footer}
<table class="layout">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td></td></tr></tfoot>
  <tbody><tr><td>${opts.content}</td></tr></tbody>
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

/** Open the document in a new tab and print it. A blob: URL gives the window
 *  a real origin so external images (logo, photos) can load. */
export function openPrintWindow(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { formatLongDate };

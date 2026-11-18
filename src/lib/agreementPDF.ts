/**
 * Agreement PDF
 * Prints the rental agreement with the same sections and wording as the
 * agreement page (see agreementDocument.ts). Header (logo, shop address) and
 * footer (contact + social links) repeat on every printed page.
 * Used by: Orders › Agreements and the order detail (vendor), Agreement page (customer)
 */

import { idLine } from "./customerId";
import { durationLabel, formatLongDate } from "./rentalSummary";
import {
  AGREEMENT_TITLE, SECTION_TITLES, declarationText, formatSignedAt, shopAddress,
  type AgreementDoc,
} from "./agreementDocument";
import { iconSvg } from "./agreementIcons";
import {
  ACCENT, GREEN, escapeDeep, httpsOnly, isoDateMY, docHeader, docFooter, sectionHead as head,
  itemsTable, printDocument, openPrintWindow,
} from "./printDocument";

export { escapeDeep };

const EXTRA_STYLES = `
  ol.terms { padding-left:18px; }
  ol.terms li { margin-bottom:5px; padding-left:2px; }
  .decl { background:#f9fafb; border-left:3px solid ${ACCENT}; padding:10px 12px; border-radius:0 6px 6px 0; }
  .sig { flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; break-inside:avoid; }
  .sig-name { font-family: Georgia, 'Times New Roman', serif; font-style:italic; font-size:19px; color:#111827; border-bottom:1px solid #9ca3af; padding:6px 0 4px; margin:4px 0 6px; min-height:34px; }
  .verify { margin-top:10px; display:flex; justify-content:space-between; gap:10px; font-size:9px; color:#4b5563; border:1px dashed #d1d5db; border-radius:6px; padding:7px 10px; }`;

function sectionHead(n: number) {
  return head(n, SECTION_TITLES[n - 1]);
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

  const right = [
    d.refNo ? `Ref <span class="mono">${d.refNo}</span>` : "",
    d.customerSignedAt ? `<span style="color:#6b7280;">${formatLongDate(isoDateMY(d.customerSignedAt))}</span>` : "",
  ].filter(Boolean);
  return printDocument({
    title: `${AGREEMENT_TITLE}${d.refNo ? ` ${d.refNo}` : ""}`,
    header: docHeader(d.vendor, "Rental Agreement", right),
    footer: docFooter(d.vendor),
    content,
    extraStyles: EXTRA_STYLES,
  });
}

export function generateAgreementPDF(doc: AgreementDoc) {
  openPrintWindow(buildAgreementHTML(doc));
}

/** Reference number and dates from a Date. */
export function buildAgreementMeta(date: Date, uniqueId: string) {
  return {
    refNo: `PK-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}-${uniqueId.substring(0, 6).toUpperCase()}`,
    signedDate: date.toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    signedFull: date.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

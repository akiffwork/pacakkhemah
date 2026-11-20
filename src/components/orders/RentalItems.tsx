import { rowAmount, type RentalSummary } from "@/lib/rentalSummary";
import { Private, usePrivacy } from "@/lib/privacy";

/**
 * Items, add-ons, free items and price rows — the cart as the customer saw it.
 * Shared by the vendor's order details and the customer's agreement page.
 */
export default function RentalItems({ summary, emptyText = "Items as discussed in WhatsApp / chat" }: { summary: RentalSummary; emptyText?: string }) {
  const { lines, freeItems, rows, note } = summary;
  const privacy = usePrivacy();
  return (
    <>
      <div className="flex flex-col">
        {lines.length === 0 && freeItems.length === 0 && <p className="text-sm text-slate-600 italic pb-3">{emptyText}</p>}
        {lines.map((item, i) => (
          <div key={i} className={`flex flex-col gap-1 py-3 ${i > 0 ? "border-t border-slate-200" : "pt-0"}`}>
            <div className="flex justify-between gap-3">
              <span className="text-sm font-semibold">{item.qty} × {item.name}</span>
              {item.amount != null && <span className="text-sm font-semibold whitespace-nowrap"><Private kind="money">RM {item.amount}</Private></span>}
            </div>
            {item.variantLabel && (
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                {item.variantColor && <span className="w-3 h-3 rounded-full border border-slate-400 shrink-0" style={{ backgroundColor: item.variantColor }} aria-hidden="true"></span>}
                <span>{item.variantLabel}</span>
              </div>
            )}
            {item.calc && <p className="text-[13px] text-slate-500">{privacy.money(item.calc)}</p>}
            {item.includes.length > 0 && (
              <div className="border-l-2 border-slate-300 pl-2.5 flex flex-col gap-0.5 text-[13px] text-slate-600">
                {item.includes.map((li, j) => (
                  <span key={j} className="flex items-center gap-1.5">
                    Includes: {li.qty} × {li.name}{li.variantLabel ? ` (${li.variantLabel})` : ""}
                    {li.variantColor && <span className="w-2.5 h-2.5 rounded-full border border-slate-400 shrink-0" style={{ backgroundColor: li.variantColor }} aria-hidden="true"></span>}
                  </span>
                ))}
              </div>
            )}
            {item.setupFee != null && (
              <div className="flex justify-between gap-3 text-[13px] text-slate-600">
                <span>Add-on: setup at campsite</span>
                {item.setupFee ? <span className="whitespace-nowrap"><Private kind="money">RM {item.setupFee}</Private></span> : null}
              </div>
            )}
          </div>
        ))}
        {freeItems.map((f, i) => (
          <div key={`free-${i}`} className={`flex justify-between items-center gap-3 py-3 ${lines.length || i > 0 ? "border-t border-slate-200" : "pt-0"}`}>
            <span className="text-sm font-semibold">{f.qty} × {f.name}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">Free item</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-3 flex flex-col gap-2 text-sm">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between items-center gap-3 ${r.kind === "strong" || r.kind === "total" ? "border-t border-slate-200 pt-2" : ""}`}>
            <span className={`flex items-center gap-2 ${r.kind === "total" ? "text-[15px] font-bold" : r.kind === "strong" ? "font-semibold" : "text-slate-600"}`}>
              {privacy.money(r.label)}
              {r.code && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-dashed border-slate-500">{r.code}</span>}
            </span>
            <span className={`whitespace-nowrap ${r.kind === "total" ? "text-xl font-bold text-[#062c24]" : r.kind === "discount" ? "font-semibold text-emerald-800" : "font-semibold"}`}>
              {r.text ? r.text : <Private kind="money">{rowAmount(r)}</Private>}
            </span>
          </div>
        ))}
        {note && <p className="text-xs text-slate-600">{note}</p>}
      </div>
    </>
  );
}

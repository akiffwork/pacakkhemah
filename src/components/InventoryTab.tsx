"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import GearFlyerModal from "@/components/GearFlyerModal";
import ItemEditor from "@/components/inventory/ItemEditor";
import DiscountsScreen from "@/components/inventory/DiscountsScreen";
import { BottomSheet } from "@/components/orders/OrderSheets";
import {
  type GearItem, type Discount,
  categoryOf, usedCategories, itemStatus, needsAttention, itemPriceLine, matchesSearch, discountState,
} from "@/lib/inventory";

type InventoryTabProps = { vendorId: string };

type VendorBits = { services?: { setup?: { enabled?: boolean } }; pickup?: string[]; gear_count?: number };

const statusDot = { live: "bg-emerald-700", warn: "bg-amber-600", blocked: "bg-red-700", paused: "bg-slate-400" };
const statusText = { live: "text-emerald-800", warn: "text-amber-800", blocked: "text-red-800", paused: "text-slate-600" };
const rowBorder = { live: "border-slate-200", warn: "border-amber-300", blocked: "border-red-300", paused: "border-slate-200" };

export default function InventoryTab({ vendorId }: InventoryTabProps) {
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [vendor, setVendor] = useState<VendorBits>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<GearItem | "new" | null>(null);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [showFlyer, setShowFlyer] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<{ item: GearItem; upcoming: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  useEffect(() => {
    const gearUnsub = onSnapshot(query(collection(db, "gear"), where("vendorId", "==", vendorId)),
      snap => { setAllGear(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted)); setLoading(false); },
      e => { console.error("Gear listener error:", e); setLoading(false); });
    const discUnsub = onSnapshot(collection(db, "vendors", vendorId, "discounts"),
      snap => setDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Discount)).filter(d => !d.deleted)),
      e => console.error("Discounts listener error:", e));
    const vendorUnsub = onSnapshot(doc(db, "vendors", vendorId), snap => setVendor((snap.data() || {}) as VendorBits));
    return () => { gearUnsub(); discUnsub(); vendorUnsub(); };
  }, [vendorId]);

  // Keep vendors/{id}.gear_count in step: the welcome tour and the shop-setup
  // checklist read it, and nothing else maintained it.
  useEffect(() => {
    if (loading) return;
    const live = allGear.filter(g => !g.paused).length;
    if (vendor.gear_count !== live) updateDoc(doc(db, "vendors", vendorId), { gear_count: live }).catch(() => {});
  }, [allGear, loading, vendor.gear_count, vendorId]);

  const cats = useMemo(() => usedCategories(allGear), [allGear]);
  const attention = allGear.filter(needsAttention);
  const pausedCount = allGear.filter(g => g.paused).length;
  const activeDiscounts = discounts.filter(d => discountState(d).state === "active").length;

  const visible = useMemo(() => allGear
    .filter(g => matchesSearch(g, search))
    .filter(g => filter === "all" ? true : filter === "attention" ? needsAttention(g) : filter === "paused" ? !!g.paused : categoryOf(g).toLowerCase() === filter.toLowerCase())
    .sort((a, b) => a.name.localeCompare(b.name)), [allGear, search, filter]);

  const grouped = useMemo(() => {
    const order = usedCategories(visible);
    return order.map(c => ({ cat: c, items: visible.filter(g => categoryOf(g) === c) }));
  }, [visible]);

  async function setPaused(ids: string[], paused: boolean) {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, "gear", id), { paused }));
      await batch.commit();
      showToast(`${ids.length} item${ids.length === 1 ? "" : "s"} ${paused ? "paused" : "live again"}`);
      setSelected([]); setSelectMode(false);
    } catch (e) { console.error(e); showToast("Could not update the items", "error"); }
    finally { setBusy(false); }
  }

  async function duplicate(item: GearItem) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = item;
      await addDoc(collection(db, "gear"), { ...rest, name: `${item.name} (copy)`, paused: true, deleted: false });
      setEditing(null);
      showToast("Copy created. It is paused until you check it.");
    } catch (e) { console.error(e); showToast("Could not duplicate the item", "error"); }
  }

  async function askDelete(item: GearItem) {
    setDeleting({ item, upcoming: null });
    try {
      const snap = await getDocs(query(collection(db, "orders"), where("vendorId", "==", vendorId)));
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = snap.docs.map(d => d.data()).filter(o =>
        !o.deleted && (o.status === "pending" || o.status === "confirmed" || o.status === "conflict") &&
        (o.bookingDates?.end || "") >= today &&
        (o.items || []).some((i: { id?: string }) => i.id === item.id)).length;
      setDeleting({ item, upcoming });
    } catch { setDeleting({ item, upcoming: 0 }); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "gear", deleting.item.id), { deleted: true });
      setDeleting(null); setEditing(null);
      showToast("Item deleted");
    } catch { showToast("Could not delete the item", "error"); }
    finally { setBusy(false); }
  }

  const chips: { key: string; label: string; tone?: "warn" }[] = [
    { key: "all", label: `All · ${allGear.length}` },
    ...(attention.length ? [{ key: "attention", label: `Needs attention · ${attention.length}`, tone: "warn" as const }] : []),
    ...cats.map(c => ({ key: c, label: `${c} · ${allGear.filter(g => categoryOf(g) === c).length}` })),
    ...(pausedCount ? [{ key: "paused", label: `Paused · ${pausedCount}` }] : []),
  ];

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black text-[#062c24] uppercase">Inventory</h2>
          <p className="text-xs font-semibold text-slate-600">Your gear, packages and discounts</p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="min-h-11 px-4 rounded-xl bg-[#062c24] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#0a4135] shrink-0">
          <i className="fas fa-plus" aria-hidden="true"></i>Add item
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowDiscounts(true)} className="flex-1 min-h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-[13px] font-semibold flex items-center justify-between hover:bg-slate-50">
          <span>Discounts{discounts.length ? ` · ${activeDiscounts} active` : ""}</span>
          <i className="fas fa-chevron-right text-slate-500" aria-hidden="true"></i>
        </button>
        <button type="button" onClick={() => setShowFlyer(true)} className="min-h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50">Flyer</button>
        {allGear.length > 0 && (
          <button type="button" onClick={() => { setSelectMode(m => !m); setSelected([]); }} aria-pressed={selectMode}
            className={`min-h-11 px-3.5 rounded-xl text-[13px] font-semibold ${selectMode ? "bg-slate-800 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {selectMode ? "Done" : "Select"}
          </button>
        )}
      </div>

      {allGear.length > 0 && (
        <>
          <div className="relative">
            <label htmlFor="inv-search" className="sr-only">Search items</label>
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" aria-hidden="true"></i>
            <input id="inv-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items"
              className="w-full min-h-11 bg-white border border-slate-300 rounded-xl pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {chips.map(c => (
              <button key={c.key} type="button" aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}
                className={`min-h-10 px-3.5 rounded-xl text-[13px] whitespace-nowrap ${filter === c.key ? "bg-[#062c24] text-white font-bold"
                  : c.tone === "warn" ? "bg-amber-100 border border-amber-300 text-amber-900 font-bold" : "bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"}`}>
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-[88px] bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : allGear.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700" aria-hidden="true"><i className="fas fa-campground text-xl"></i></div>
          <p className="text-sm font-bold text-slate-800">No items yet</p>
          <p className="text-[13px] text-slate-600">Add your first tent or item. You only need a photo, a name, a price and how many you own.</p>
          <button type="button" onClick={() => setEditing("new")} className="mt-2 min-h-11 px-4 rounded-xl bg-[#062c24] text-white text-sm font-bold">Add your first item</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-slate-800">No items match</p>
          <p className="text-[13px] text-slate-600 mt-1">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="flex flex-col gap-2">
              <h3 style={{ textTransform: "none" }} className="text-[15px] font-extrabold text-slate-600">{cat} · {items.length}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {items.map(g => {
                  const st = itemStatus(g);
                  const cover = g.images?.[0] || g.img;
                  const isSel = selected.includes(g.id);
                  return (
                    <button key={g.id} type="button"
                      onClick={() => selectMode ? setSelected(s => isSel ? s.filter(x => x !== g.id) : [...s, g.id]) : setEditing(g)}
                      aria-pressed={selectMode ? isSel : undefined}
                      className={`text-left rounded-2xl border p-3 flex items-center gap-3 hover:border-slate-400 ${g.paused ? "bg-slate-50" : "bg-white"} ${isSel ? "border-[#062c24] ring-2 ring-emerald-200" : rowBorder[st.kind]}`}>
                      {selectMode && (
                        <span className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center ${isSel ? "bg-[#062c24] border-[#062c24] text-white" : "border-slate-400 bg-white"}`} aria-hidden="true">
                          {isSel && <i className="fas fa-check text-xs"></i>}
                        </span>
                      )}
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" className={`w-16 h-16 rounded-xl object-cover shrink-0 ${g.paused ? "opacity-60" : ""}`} />
                      ) : (
                        <span className="w-16 h-16 rounded-xl bg-amber-50 border border-dashed border-amber-500 text-amber-800 flex items-center justify-center shrink-0" aria-hidden="true"><i className="fas fa-camera"></i></span>
                      )}
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className={`text-[15px] font-bold truncate ${g.paused ? "text-slate-600" : "text-slate-900"}`}>{g.name}</span>
                        <span className="text-[13px] text-slate-600 truncate">{itemPriceLine(g)}</span>
                        <span className={`text-xs font-bold flex items-center gap-1.5 ${statusText[st.kind]}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[st.kind]}`} aria-hidden="true"></span>
                          <span className="truncate">{st.label}</span>
                        </span>
                      </span>
                      {!selectMode && <i className="fas fa-chevron-right text-slate-400 shrink-0" aria-hidden="true"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {selectMode && (
        <div className="fixed left-0 right-0 bottom-[68px] z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-xl mx-auto px-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-2.5 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-700 px-1.5 flex-1">{selected.length ? `${selected.length} selected` : "Tap items to select"}</span>
              <button type="button" disabled={!selected.length || busy} onClick={() => setPaused(selected, true)} className="min-h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-[13px] font-bold disabled:opacity-50">Pause</button>
              <button type="button" disabled={!selected.length || busy} onClick={() => setPaused(selected, false)} className="min-h-11 px-3.5 rounded-xl bg-[#062c24] text-white text-[13px] font-bold disabled:opacity-50">Make live</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ItemEditor
          key={editing === "new" ? "new" : editing.id}
          vendorId={vendorId}
          item={editing === "new" ? null : editing}
          allGear={allGear}
          setupEnabledForShop={!!vendor.services?.setup?.enabled}
          pickupPoints={vendor.pickup || []}
          onClose={() => setEditing(null)}
          onSaved={msg => showToast(msg)}
          onError={msg => showToast(msg, "error")}
          onDuplicate={duplicate}
          onDelete={askDelete}
        />
      )}

      {showDiscounts && <DiscountsScreen vendorId={vendorId} discounts={discounts} gear={allGear} onClose={() => setShowDiscounts(false)} onToast={showToast} />}

      {deleting && (
        <BottomSheet title={`Delete ${deleting.item.name}?`} onClose={() => setDeleting(null)}>
          {deleting.upcoming === null ? (
            <p className="text-sm text-slate-600">Checking upcoming bookings…</p>
          ) : deleting.upcoming > 0 ? (
            <div className="bg-amber-100 border border-amber-300 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
              This item is in {deleting.upcoming} upcoming booking{deleting.upcoming === 1 ? "" : "s"}. Pausing hides it from your shop and keeps those bookings intact.
            </div>
          ) : (
            <p className="text-sm text-slate-600 -mt-1">It is removed from your shop. Past orders keep their details. This cannot be undone here.</p>
          )}
          <div className="flex flex-col gap-2.5">
            {!deleting.item.paused && (
              <button type="button" disabled={busy} onClick={async () => { await setPaused([deleting.item.id], true); setDeleting(null); setEditing(null); }}
                className="min-h-13 w-full rounded-2xl bg-[#062c24] text-white text-[15px] font-bold disabled:opacity-50">Pause instead</button>
            )}
            <button type="button" disabled={busy || deleting.upcoming === null} onClick={confirmDelete}
              className="min-h-13 w-full rounded-2xl border border-red-300 bg-white text-red-800 text-[15px] font-bold disabled:opacity-50">Delete item</button>
          </div>
        </BottomSheet>
      )}

      {showFlyer && <GearFlyerModal vendorId={vendorId} onClose={() => setShowFlyer(false)} />}

      {toast && (
        <div role="status" className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[700] max-w-[90vw] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[13px] font-semibold ${toast.type === "success" ? "bg-emerald-700" : "bg-red-700"}`}>
          <i className={`fas ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`} aria-hidden="true"></i>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

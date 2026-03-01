"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, deleteDoc, writeBatch, orderBy, updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

type GearItem = {
  id: string; name: string; stock: number;
  img?: string; category?: string; type?: string; deleted?: boolean;
};

type Booking = {
  id: string; itemId?: string; qty?: number;
  start: string; end: string; type?: string;
  customer?: string; phone?: string; reason?: string;
};

type DetailData = {
  id: string; itemName: string; start: string; end: string;
  customer?: string; phone?: string; reason?: string; qty?: number;
};

export default function CalendarPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [pickupLocs, setPickupLocs] = useState<string[]>([]);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [view, setView] = useState<"week" | "month">("week");
  const [entryType, setEntryType] = useState<"booking" | "block">("booking");
  const [showSheet, setShowSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editReason, setEditReason] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [pickupHub, setPickupHub] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const dateRangeRef = useRef<any>(null);
  const fpRef = useRef<any>(null);

  // Auth + load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = "/store"; return; }
      const snap = await getDocs(query(collection(db, "vendors"), where("owner_uid", "==", u.uid)));
      if (!snap.empty) {
        const vid = snap.docs[0].id;
        const vData = snap.docs[0].data();
        setVendorId(vid);
        setPickupLocs(vData.pickup || []);
        setPickupHub(vData.pickup?.[0] || "");
        await loadData(vid);
      }
    });
    return () => unsub();
  }, []);

  async function loadData(vid: string) {
    const gSnap = await getDocs(query(collection(db, "gear"), where("vendorId", "==", vid)));
    const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted);
    setAllGear(gear);

    const aSnap = await getDocs(collection(db, "vendors", vid, "availability"));
    const bks = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).filter(b => b.start && b.end);
    setBookings(bks);
    setLoading(false);
  }

  // Flatpickr date range
  useEffect(() => {
    if (!dateRangeRef.current) return;
    fpRef.current = flatpickr(dateRangeRef.current, {
      mode: "range", minDate: "today", dateFormat: "Y-m-d",
    });
    return () => fpRef.current?.destroy();
  }, [showSheet]);

  // Categories
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();

  function adjQty(id: string, delta: number, max = 999) {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min((prev[id] || 0) + delta, max)),
    }));
  }

  function blockAllStock() {
    const newQtys: Record<string, number> = {};
    allGear.forEach(g => { newQtys[g.id] = g.stock; });
    setQuantities(newQtys);
  }

  async function saveEntry() {
    const dateVal = dateRangeRef.current?.value || "";
    const dates = dateVal.split(" to ");
    if (!dates[0]) return alert("Please select a date range.");

    const batch = writeBatch(db);
    let hasData = false;

    Object.entries(quantities).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const ref = doc(collection(db, "vendors", vendorId!, "availability"));
        batch.set(ref, {
          itemId, qty,
          start: dates[0], end: dates[1] || dates[0],
          type: entryType,
          customer: entryType === "booking" ? custName : null,
          phone: entryType === "booking" ? custPhone : null,
          reason: entryType === "block" ? blockReason : null,
        });
        hasData = true;
      }
    });

    if (!hasData) return alert("Select at least 1 item.");
    await batch.commit();
    setShowSheet(false);
    setQuantities({});
    setCustName(""); setCustPhone(""); setBlockReason("");
    await loadData(vendorId!);
    alert("Saved!");
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry? Stock will be restored.")) return;
    await deleteDoc(doc(db, "vendors", vendorId!, "availability", id));
    setShowDetail(false);
    await loadData(vendorId!);
  }

  async function updateEntry() {
    if (!detailData || !vendorId) return;
    const isBlock = !detailData.customer && !!detailData.reason;
    await updateDoc(doc(db, "vendors", vendorId, "availability", detailData.id), {
      ...(isBlock ? { reason: editReason } : { customer: editName, phone: editPhone }),
    });
    setDetailData(prev => prev ? {
      ...prev,
      ...(isBlock ? { reason: editReason } : { customer: editName, phone: editPhone }),
    } : null);
    setIsEditing(false);
    await loadData(vendorId);
  }

  // FullCalendar events
  const calendarEvents = bookings.map(b => {
    const item = allGear.find(g => g.id === b.itemId);
    let endDate = b.end;
    try {
      const d = new Date(b.end);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        endDate = d.toISOString().split("T")[0];
      }
    } catch { return null; }
    return {
      id: b.id,
      title: item ? `${item.name} (x${b.qty})` : "Item Deleted",
      start: b.start, end: endDate,
      backgroundColor: b.type === "block" ? "#fee2e2" : "#dbeafe",
      borderColor: "transparent",
      textColor: b.type === "block" ? "#ef4444" : "#2563eb",
      extendedProps: { ...b, itemName: item?.name || "Unknown" },
    };
  }).filter(Boolean);

  // Week view - next 7 days
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i);
    return d;
  });

  const monthDisplay = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="pb-24 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc" }}>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/store" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#062c24] transition-colors">
            <i className="fas fa-arrow-left"></i>
          </Link>
          <div>
            <h1 className="text-xl font-black text-[#062c24] leading-none">Schedule</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{monthDisplay}</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {["week", "month"].map(v => (
            <button key={v} onClick={() => setView(v as "week" | "month")}
              className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${view === v ? "bg-white text-[#062c24] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              {v}
            </button>
          ))}
        </div>
      </header>

      {/* Week View */}
      {view === "week" && (
        <div className="max-w-3xl mx-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12"><i className="fas fa-spinner fa-spin text-slate-300 text-2xl"></i></div>
          ) : weekDays.map(d => {
            const dateStr = d.toISOString().split("T")[0];
            const active = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
            return (
              <div key={dateStr} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-black text-[#062c24]">{d.getDate()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  </div>
                  {active.length > 0 && (
                    <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[8px] font-black uppercase">{active.length} Activities</span>
                  )}
                </div>
                <div className="space-y-2">
                  {active.length === 0 ? (
                    <p className="text-[10px] text-slate-300 italic pl-1">No bookings</p>
                  ) : active.map(b => {
                    const item = allGear.find(g => g.id === b.itemId);
                    const isBlock = b.type === "block";
                    return (
                      <div key={b.id} onClick={() => {
                        setDetailData({
  id: b.id,
  itemName: item?.name || "Unknown",
  start: b.start,
  end: b.end,
  customer: b.customer,
  phone: b.phone,
  reason: b.reason,
  qty: b.qty,
});
                        setShowDetail(true);
                      }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer ${isBlock ? "bg-red-50 border border-red-100" : "bg-blue-50 border border-blue-100"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${isBlock ? "bg-red-400" : "bg-blue-400"}`}></div>
                          <div>
                            <p className={`text-[9px] font-black uppercase ${isBlock ? "text-red-700" : "text-blue-800"}`}>
                              {isBlock ? (b.reason || "Blocked") : (b.customer || "Unknown")}
                            </p>
                            <p className={`text-[8px] font-medium ${isBlock ? "text-red-400" : "text-blue-400"}`}>
                              {item?.name || "Item"} (x{b.qty})
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white rounded-[2rem] p-4 shadow-xl border border-slate-100 overflow-hidden">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: "prev", center: "title", right: "next" }}
              height="auto"
              events={calendarEvents as any}
              dateClick={info => {
                fpRef.current?.setDate([info.dateStr, info.dateStr]);
                setShowSheet(true);
              }}
            />
          </div>
          <div className="mt-4 flex justify-center gap-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[9px] font-bold text-slate-500 uppercase">Booking</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[9px] font-bold text-slate-500 uppercase">Blocked</span></div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setShowSheet(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#062c24] text-white rounded-full flex items-center justify-center text-2xl shadow-2xl z-40 hover:scale-110 transition-transform">
        <i className="fas fa-plus"></i>
      </button>

      {/* Action Sheet */}
      {showSheet && (
        <>
          <div className="fixed inset-0 bg-[#062c24]/80 backdrop-blur-sm z-[100]" onClick={() => setShowSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] z-[101] max-h-[90vh] flex flex-col shadow-2xl">
            <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setShowSheet(false)}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
            </div>

            {/* Sheet Header */}
            <div className="px-6 pb-4 flex-none border-b border-slate-50">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-2xl font-black text-[#062c24] uppercase">New Entry</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {(["booking", "block"] as const).map(t => (
                    <button key={t} onClick={() => setEntryType(t)}
                      className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${entryType === t ? `bg-white shadow-sm ${t === "booking" ? "text-emerald-600" : "text-red-500"}` : "text-slate-400"}`}>
                      {t === "booking" ? "Booking" : "Time Off"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3 border border-slate-100">
                <i className="fas fa-calendar-alt text-emerald-500 text-lg ml-2"></i>
                <input ref={dateRangeRef} className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" placeholder="Select Dates" />
              </div>
            </div>

            {/* Sheet Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: "none" }}>
              {entryType === "booking" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Customer Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Name"
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100" />
                    <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone"
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div className="relative">
                    <select value={pickupHub} onChange={e => setPickupHub(e.target.value)}
                      className="w-full bg-emerald-50 text-emerald-800 p-3 rounded-xl text-[10px] font-bold outline-none appearance-none">
                      <option value="">Select Hub...</option>
                      {pickupLocs.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-emerald-600"></i>
                  </div>
                </div>
              )}

              {entryType === "block" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-red-300 uppercase tracking-widest">Reason for Block</p>
                  <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Maintenance, Holiday"
                    className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-red-300" />
                  <button onClick={blockAllStock}
                    className="w-full py-3 bg-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">
                    Block All Items for These Dates
                  </button>
                </div>
              )}

              {/* Inventory Accordion */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Select Gear to Book</p>
                  <p className="text-[8px] text-slate-400 italic">Qty reduces shop stock</p>
                </div>
                {allGear.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">No Inventory Found</p>
                    <Link href="/store" className="mt-2 inline-block text-[9px] font-black text-emerald-600 underline">Add Items in Store</Link>
                  </div>
                ) : categories.map(cat => {
                  const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
                  return (
                    <details key={cat} className="bg-white border border-slate-100 rounded-2xl overflow-hidden" open>
                      <summary className="flex justify-between items-center p-4 bg-slate-50 cursor-pointer select-none">
                        <span className="text-[10px] font-black text-[#062c24] uppercase tracking-widest">{cat}</span>
                        <i className="fas fa-chevron-down text-slate-400 text-xs"></i>
                      </summary>
                      <div className="p-2 space-y-2">
                        {items.map(g => (
                          <div key={g.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={g.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100" alt={g.name} />
                              <div>
                                <p className="text-[10px] font-bold text-slate-700 uppercase leading-tight">{g.name}</p>
                                <p className="text-[8px] text-slate-400 uppercase">Total: {g.stock}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                              <button onClick={() => adjQty(g.id, -1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 bg-white rounded shadow-sm">-</button>
                              <span className="w-8 text-center text-xs font-bold text-slate-700">{quantities[g.id] || 0}</span>
                              <button onClick={() => adjQty(g.id, 1, g.stock)}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-500 bg-white rounded shadow-sm">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 bg-white">
              <button onClick={saveEntry}
                className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-900 transition-all">
                Confirm Schedule
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {showDetail && detailData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => { setShowDetail(false); setIsEditing(false); }}
              className="absolute top-4 right-4 w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times"></i>
            </button>

            <h3 className="text-xl font-black text-[#062c24] uppercase mb-1">
              {detailData.customer ? "Booking Detail" : "Block Detail"}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              {detailData.start} → {detailData.end}
            </p>

            {/* View mode */}
            {!isEditing ? (
              <>
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-black text-[#062c24] uppercase">{detailData.customer || "Blocked"}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{detailData.phone || detailData.reason || "-"}</p>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl mb-6">
                  <span className="text-xs font-bold text-slate-600">{detailData.itemName}</span>
                  <span className="text-xs font-black text-[#062c24]">x{detailData.qty}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditName(detailData.customer || "");
                    setEditPhone(detailData.phone || "");
                    setEditReason(detailData.reason || "");
                    setIsEditing(true);
                  }}
                    className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all">
                    <i className="fas fa-pen mr-1"></i> Edit
                  </button>
                  <button onClick={() => deleteEntry(detailData.id)}
                    className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-all">
                    <i className="fas fa-trash mr-1"></i> Delete
                  </button>
                </div>
              </>
            ) : (
              /* Edit mode */
              <>
                <div className="space-y-3 mb-6">
                  {detailData.customer !== undefined ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="Customer Name"
                        className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-300 border border-slate-100" />
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-300 border border-slate-100" />
                    </>
                  ) : (
                    <input value={editReason} onChange={e => setEditReason(e.target.value)}
                      placeholder="Reason for block"
                      className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-200 border border-red-100" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                  <button onClick={updateEntry}
                    className="flex-1 py-3 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-900 transition-all shadow-lg">
                    <i className="fas fa-check mr-1"></i> Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
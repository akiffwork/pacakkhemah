"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, deleteDoc, writeBatch, updateDoc, addDoc,
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

type RecurringBlock = {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  reason: string;
  itemIds: string[]; // "all" or specific item IDs
  enabled: boolean;
};

type DetailData = {
  id: string; itemName: string; start: string; end: string;
  customer?: string; phone?: string; reason?: string; qty?: number;
};

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Tents": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "#10b981" },
  "Furniture": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "#f59e0b" },
  "Cooking": { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "#f97316" },
  "Lighting": { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", dot: "#eab308" },
  "Sleeping": { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", dot: "#6366f1" },
  "Packages": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dot: "#a855f7" },
  "Add-ons": { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", dot: "#64748b" },
};

const DEFAULT_COLOR = { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "#3b82f6" };

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [pickupLocs, setPickupLocs] = useState<string[]>([]);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlock[]>([]);
  const [view, setView] = useState<"week" | "month" | "recurring">("week");
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
  const [toast, setToast] = useState<string | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [newRecurring, setNewRecurring] = useState({ dayOfWeek: 0, reason: "", allItems: true });
  const dateRangeRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  // Auth + load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = "/store"; return; }
      const snap = await getDocs(query(collection(db, "vendors"), where("owner_uid", "==", u.uid)));
      if (!snap.empty) {
        const vid = snap.docs[0].id;
        const vData = snap.docs[0].data();
        setVendorId(vid);
        setVendorName(vData.name || "");
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

    // Load recurring blocks
    const rSnap = await getDocs(collection(db, "vendors", vid, "recurringBlocks"));
    const rBlocks = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlock));
    setRecurringBlocks(rBlocks);

    setLoading(false);
  }

  // Flatpickr date range
  useEffect(() => {
    if (!dateRangeRef.current || !showSheet) return;
    fpRef.current = flatpickr(dateRangeRef.current, {
      mode: "range", minDate: "today", dateFormat: "Y-m-d",
    });
    return () => fpRef.current?.destroy();
  }, [showSheet]);

  // Categories
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();

  function getItemCategory(item: GearItem): string {
    return item.category || (item.type === "package" ? "Packages" : "Add-ons");
  }

  function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] || DEFAULT_COLOR;
  }

  // Calculate remaining stock for a specific date
  function getRemainingStock(itemId: string, dateStr: string): number {
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;

    const bookedQty = bookings
      .filter(b => b.itemId === itemId && dateStr >= b.start && dateStr <= b.end)
      .reduce((sum, b) => sum + (b.qty || 0), 0);

    // Check recurring blocks
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const recurringBlock = recurringBlocks.find(r => 
      r.enabled && r.dayOfWeek === dayOfWeek && 
      (r.itemIds.includes("all") || r.itemIds.includes(itemId))
    );
    
    if (recurringBlock) return 0;

    return Math.max(0, item.stock - bookedQty);
  }

  // Stats calculations
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + 7);
  const thisWeekEndStr = thisWeekEnd.toISOString().split("T")[0];

  const stats = {
    todayBookings: bookings.filter(b => b.type !== "block" && todayStr >= b.start && todayStr <= b.end).length,
    todayBlocks: bookings.filter(b => b.type === "block" && todayStr >= b.start && todayStr <= b.end).length,
    weekBookings: bookings.filter(b => b.type !== "block" && b.start <= thisWeekEndStr && b.end >= todayStr).length,
    weekBlocks: bookings.filter(b => b.type === "block" && b.start <= thisWeekEndStr && b.end >= todayStr).length,
    totalItems: allGear.reduce((sum, g) => sum + g.stock, 0),
    availableToday: allGear.reduce((sum, g) => sum + getRemainingStock(g.id, todayStr), 0),
  };

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
          createdAt: new Date().toISOString(),
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
    showToast("Schedule saved!");
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry? Stock will be restored.")) return;
    await deleteDoc(doc(db, "vendors", vendorId!, "availability", id));
    setShowDetail(false);
    await loadData(vendorId!);
    showToast("Entry deleted");
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
    showToast("Entry updated");
  }

  // Recurring blocks
  async function addRecurringBlock() {
    if (!vendorId || !newRecurring.reason) return alert("Please enter a reason");
    await addDoc(collection(db, "vendors", vendorId, "recurringBlocks"), {
      dayOfWeek: newRecurring.dayOfWeek,
      reason: newRecurring.reason,
      itemIds: newRecurring.allItems ? ["all"] : [],
      enabled: true,
    });
    setShowRecurringModal(false);
    setNewRecurring({ dayOfWeek: 0, reason: "", allItems: true });
    await loadData(vendorId);
    showToast("Recurring block added");
  }

  async function toggleRecurringBlock(id: string, enabled: boolean) {
    if (!vendorId) return;
    await updateDoc(doc(db, "vendors", vendorId, "recurringBlocks", id), { enabled });
    await loadData(vendorId);
  }

  async function deleteRecurringBlock(id: string) {
    if (!vendorId || !confirm("Delete this recurring block?")) return;
    await deleteDoc(doc(db, "vendors", vendorId, "recurringBlocks", id));
    await loadData(vendorId);
    showToast("Recurring block deleted");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Export calendar as CSV
  function exportCalendar() {
    const headers = ["Type", "Customer/Reason", "Phone", "Item", "Qty", "Start", "End"];
    const rows = bookings.map(b => {
      const item = allGear.find(g => g.id === b.itemId);
      return [
        b.type === "block" ? "Block" : "Booking",
        b.customer || b.reason || "",
        b.phone || "",
        item?.name || "Unknown",
        b.qty || 0,
        b.start,
        b.end,
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar-${vendorName || "export"}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Calendar exported!");
  }

  // FullCalendar events with category colors
  const calendarEvents = bookings.map(b => {
    const item = allGear.find(g => g.id === b.itemId);
    const category = item ? getItemCategory(item) : "Add-ons";
    const colors = getCategoryColor(category);
    
    let endDate = b.end;
    try {
      const d = new Date(b.end);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        endDate = d.toISOString().split("T")[0];
      }
    } catch { return null; }

    const isBlock = b.type === "block";
    
    return {
      id: b.id,
      title: item ? `${item.name} (x${b.qty})` : "Item Deleted",
      start: b.start, 
      end: endDate,
      backgroundColor: isBlock ? "#fee2e2" : colors.dot + "20",
      borderColor: isBlock ? "#ef4444" : colors.dot,
      textColor: isBlock ? "#ef4444" : colors.dot,
      extendedProps: { ...b, itemName: item?.name || "Unknown", category },
    };
  }).filter(Boolean);

  // Week view - next 7 days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i);
    return d;
  });

  const monthDisplay = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Handle calendar event click
  function handleEventClick(info: any) {
    const props = info.event.extendedProps;
    setDetailData({
      id: info.event.id,
      itemName: props.itemName,
      start: props.start,
      end: props.end,
      customer: props.customer,
      phone: props.phone,
      reason: props.reason,
      qty: props.qty,
    });
    setShowDetail(true);
  }

  return (
    <div className="pb-24 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc" }}>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <Link href="/store" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#062c24] transition-colors">
                <i className="fas fa-arrow-left"></i>
              </Link>
              <div>
                <h1 className="text-lg font-black text-[#062c24] leading-none">Schedule</h1>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{monthDisplay}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCalendar} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Export CSV">
                <i className="fas fa-download text-sm"></i>
              </button>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(["week", "month", "recurring"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-2.5 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${view === v ? "bg-white text-[#062c24] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                    {v === "recurring" ? <i className="fas fa-repeat"></i> : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-2.5 border border-blue-100">
              <p className="text-[8px] font-bold text-blue-400 uppercase">Today</p>
              <p className="text-lg font-black text-blue-600 leading-none">{stats.todayBookings}</p>
              <p className="text-[8px] text-blue-400">bookings</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-2.5 border border-red-100">
              <p className="text-[8px] font-bold text-red-400 uppercase">Blocked</p>
              <p className="text-lg font-black text-red-500 leading-none">{stats.todayBlocks}</p>
              <p className="text-[8px] text-red-400">today</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-2.5 border border-emerald-100">
              <p className="text-[8px] font-bold text-emerald-400 uppercase">This Week</p>
              <p className="text-lg font-black text-emerald-600 leading-none">{stats.weekBookings}</p>
              <p className="text-[8px] text-emerald-400">bookings</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-2.5 border border-purple-100">
              <p className="text-[8px] font-bold text-purple-400 uppercase">Available</p>
              <p className="text-lg font-black text-purple-600 leading-none">{stats.availableToday}</p>
              <p className="text-[8px] text-purple-400">of {stats.totalItems}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Week View */}
      {view === "week" && (
        <div className="max-w-3xl mx-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12"><i className="fas fa-spinner fa-spin text-slate-300 text-2xl"></i></div>
          ) : weekDays.map(d => {
            const dateStr = d.toISOString().split("T")[0];
            const dayOfWeek = d.getDay();
            const active = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
            const recurringBlock = recurringBlocks.find(r => r.enabled && r.dayOfWeek === dayOfWeek);
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className={`bg-white p-4 rounded-[1.5rem] border shadow-sm transition-all ${isToday ? "border-emerald-200 ring-2 ring-emerald-100" : "border-slate-100"}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className={`text-lg font-black ${isToday ? "text-emerald-600" : "text-[#062c24]"}`}>{d.getDate()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    {isToday && <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Today</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {recurringBlock && (
                      <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1">
                        <i className="fas fa-repeat text-[7px]"></i> {recurringBlock.reason}
                      </span>
                    )}
                    {active.length > 0 && (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[8px] font-black uppercase">{active.length} Activities</span>
                    )}
                  </div>
                </div>

                {/* Stock availability row */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {allGear.slice(0, 6).map(g => {
                    const remaining = getRemainingStock(g.id, dateStr);
                    const category = getItemCategory(g);
                    const colors = getCategoryColor(category);
                    return (
                      <div key={g.id} className={`shrink-0 px-2 py-1 rounded-lg ${colors.bg} border ${colors.border}`}>
                        <p className={`text-[7px] font-bold ${colors.text} uppercase truncate max-w-[60px]`}>{g.name}</p>
                        <p className={`text-[9px] font-black ${remaining === 0 ? "text-red-500" : colors.text}`}>
                          {remaining}/{g.stock}
                        </p>
                      </div>
                    );
                  })}
                  {allGear.length > 6 && (
                    <div className="shrink-0 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center">
                      <p className="text-[8px] font-bold text-slate-400">+{allGear.length - 6}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {active.length === 0 && !recurringBlock ? (
                    <p className="text-[10px] text-slate-300 italic pl-1">No bookings</p>
                  ) : active.map(b => {
                    const item = allGear.find(g => g.id === b.itemId);
                    const isBlock = b.type === "block";
                    const category = item ? getItemCategory(item) : "Add-ons";
                    const colors = getCategoryColor(category);

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
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all hover:scale-[1.01] ${isBlock ? "bg-red-50 border border-red-100" : `${colors.bg} border ${colors.border}`}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${isBlock ? "bg-red-400" : ""}`} style={{ backgroundColor: isBlock ? undefined : colors.dot }}></div>
                          <div>
                            <p className={`text-[9px] font-black uppercase ${isBlock ? "text-red-700" : colors.text}`}>
                              {isBlock ? (b.reason || "Blocked") : (b.customer || "Unknown")}
                            </p>
                            <p className={`text-[8px] font-medium ${isBlock ? "text-red-400" : colors.text} opacity-70`}>
                              {item?.name || "Item"} (x{b.qty})
                            </p>
                          </div>
                        </div>
                        <i className={`fas fa-chevron-right text-[8px] ${isBlock ? "text-red-300" : colors.text} opacity-50`}></i>
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
              eventClick={handleEventClick}
              dateClick={info => {
                if (fpRef.current) {
                  fpRef.current.setDate([info.dateStr, info.dateStr]);
                }
                setShowSheet(true);
              }}
              eventContent={(arg) => (
                <div className="px-1 py-0.5 text-[8px] font-bold truncate">
                  {arg.event.title}
                </div>
              )}
            />
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Blocked</span>
            </div>
            {categories.slice(0, 5).map(cat => {
              const colors = getCategoryColor(cat);
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }}></div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring Blocks View */}
      {view === "recurring" && (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-[#062c24] uppercase">Weekly Off Days</h2>
                <p className="text-[10px] text-slate-400">Automatically block items on specific days</p>
              </div>
              <button onClick={() => setShowRecurringModal(true)}
                className="px-4 py-2.5 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-all shadow-lg">
                <i className="fas fa-plus mr-2"></i>Add Day
              </button>
            </div>

            {recurringBlocks.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl">
                <i className="fas fa-calendar-xmark text-slate-300 text-3xl mb-3"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase">No recurring blocks set</p>
                <p className="text-[9px] text-slate-300 mt-1">Add weekly off days to automatically block your inventory</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recurringBlocks.map(r => (
                  <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${r.enabled ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.enabled ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-400"}`}>
                        <i className="fas fa-repeat text-lg"></i>
                      </div>
                      <div>
                        <p className={`text-sm font-black uppercase ${r.enabled ? "text-amber-700" : "text-slate-500"}`}>{DAYS_OF_WEEK[r.dayOfWeek]}</p>
                        <p className={`text-[10px] ${r.enabled ? "text-amber-500" : "text-slate-400"}`}>{r.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleRecurringBlock(r.id, !r.enabled)}
                        className={`w-12 h-7 rounded-full p-1 transition-all ${r.enabled ? "bg-amber-500" : "bg-slate-300"}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${r.enabled ? "translate-x-5" : ""}`}></div>
                      </button>
                      <button onClick={() => deleteRecurringBlock(r.id)}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                        <i className="fas fa-trash text-sm"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 border border-slate-100" />
                    <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone"
                      className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 border border-slate-100" />
                  </div>
                  <div className="relative">
                    <select value={pickupHub} onChange={e => setPickupHub(e.target.value)}
                      className="w-full bg-emerald-50 text-emerald-800 p-3 rounded-xl text-[10px] font-bold outline-none appearance-none border border-emerald-100">
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
                    className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-red-300 border border-red-100" />
                  <button onClick={blockAllStock}
                    className="w-full py-3 bg-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">
                    Block All Items for These Dates
                  </button>
                </div>
              )}

              {/* Inventory Accordion with remaining stock */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Select Gear to Book</p>
                  <p className="text-[8px] text-slate-400 italic">Shows remaining stock</p>
                </div>
                {allGear.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">No Inventory Found</p>
                    <Link href="/store" className="mt-2 inline-block text-[9px] font-black text-emerald-600 underline">Add Items in Store</Link>
                  </div>
                ) : categories.map(cat => {
                  const items = allGear.filter(g => getItemCategory(g) === cat);
                  const colors = getCategoryColor(cat);
                  return (
                    <details key={cat} className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden`} open>
                      <summary className="flex justify-between items-center p-4 cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }}></div>
                          <span className={`text-[10px] font-black ${colors.text} uppercase tracking-widest`}>{cat}</span>
                        </div>
                        <i className={`fas fa-chevron-down ${colors.text} opacity-50 text-xs`}></i>
                      </summary>
                      <div className="p-2 space-y-2 bg-white/50">
                        {items.map(g => {
                          const dateVal = dateRangeRef.current?.value || "";
                          const startDate = dateVal.split(" to ")[0] || todayStr;
                          const remaining = getRemainingStock(g.id, startDate);
                          
                          return (
                            <div key={g.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors">
                              <div className="flex items-center gap-3">
                                <img src={g.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100" alt={g.name} />
                                <div>
                                  <p className="text-[10px] font-bold text-slate-700 uppercase leading-tight">{g.name}</p>
                                  <p className={`text-[8px] uppercase ${remaining === 0 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                                    {remaining === 0 ? "Fully booked" : `${remaining} of ${g.stock} available`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                                <button onClick={() => adjQty(g.id, -1)}
                                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 bg-white rounded-lg shadow-sm font-black">−</button>
                                <span className="w-8 text-center text-xs font-bold text-slate-700">{quantities[g.id] || 0}</span>
                                <button onClick={() => adjQty(g.id, 1, remaining)}
                                  disabled={remaining === 0}
                                  className={`w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm font-black ${remaining === 0 ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-emerald-500"}`}>+</button>
                              </div>
                            </div>
                          );
                        })}
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

                {/* WhatsApp button for bookings */}
                {detailData.phone && (
                  <a href={`https://wa.me/${detailData.phone.replace(/\D/g, "")}?text=Hi ${detailData.customer}, this is regarding your booking for ${detailData.itemName} (${detailData.start} - ${detailData.end}).`}
                    target="_blank" rel="noreferrer"
                    className="mt-3 w-full py-3 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-green-600 transition-all">
                    <i className="fab fa-whatsapp"></i> Message Customer
                  </a>
                )}
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

      {/* Add Recurring Block Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-black text-[#062c24] uppercase mb-4">Add Weekly Off Day</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Day of Week</label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button key={day} onClick={() => setNewRecurring(prev => ({ ...prev, dayOfWeek: idx }))}
                      className={`py-2 rounded-lg text-[8px] font-black uppercase transition-all ${newRecurring.dayOfWeek === idx ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Reason</label>
                <input value={newRecurring.reason} onChange={e => setNewRecurring(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Weekly maintenance, Rest day"
                  className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200 border border-slate-100" />
              </div>

              <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer">
                <input type="checkbox" checked={newRecurring.allItems} onChange={e => setNewRecurring(prev => ({ ...prev, allItems: e.target.checked }))}
                  className="w-5 h-5 rounded accent-amber-500" />
                <span className="text-xs font-bold text-amber-700">Block all items on this day</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowRecurringModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={addRecurringBlock}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 transition-all shadow-lg">
                <i className="fas fa-plus mr-1"></i> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          style={{ animation: "toastIn 0.3s ease-out" }}>
          <i className="fas fa-check-circle"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">{toast}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
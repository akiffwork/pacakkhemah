"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, deleteDoc, writeBatch, addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

// --- Types ---
type GearItem = {
  id: string; name: string; stock: number; category?: string; img?: string; type?: string;
};

type Booking = {
  id: string;
  itemId?: string;
  qty?: number;
  start: string;
  end: string;
  type: "booking" | "block";
  customer?: string;
  phone?: string;
  reason?: string;
  isRecurring?: boolean;
  dayOfWeek?: number;
};

type BookingGroup = {
  id: string;
  type: "booking" | "block";
  customer?: string;
  phone?: string;
  reason?: string;
  start: string;
  end: string;
  itemCount: number;
  items: { id: string; name: string; qty: number; category: string }[];
  isRecurring?: boolean;
};

// Category colors for the booking form
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

// --- Custom Swipeable Card Component ---
function SwipeableCard({ children, onDelete, onEdit, onClick }: any) {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff > 80) setTranslateX(80);
    else if (diff < -80) setTranslateX(-80);
    else setTranslateX(diff);
  };
  const handleTouchEnd = () => {
    if (translateX < -50) onDelete();
    else if (translateX > 50) onEdit();
    setTranslateX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3 border border-slate-100 bg-slate-50">
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className="text-blue-500 flex flex-col items-center">
          <i className="fas fa-edit"></i><span className="text-[9px] font-black uppercase mt-1">Edit</span>
        </div>
        <div className="text-red-500 flex flex-col items-center">
          <i className="fas fa-trash"></i><span className="text-[9px] font-black uppercase mt-1">Delete</span>
        </div>
      </div>
      <div 
        className="relative bg-white p-4 flex justify-between items-center transition-transform duration-200 ease-out active:bg-slate-50"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function CleanCalendar() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [activeDetail, setActiveDetail] = useState<BookingGroup | null>(null);
  const [entryType, setEntryType] = useState<"booking" | "block">("booking");

  // Form States - Shared
  const [formDate, setFormDate] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Form States - Time Off
  const [formReason, setFormReason] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  // Form States - Booking
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const snap = await getDocs(query(collection(db, "vendors"), where("owner_uid", "==", user.uid)));
      if (!snap.empty) {
        setVendorId(snap.docs[0].id);
        loadData(snap.docs[0].id);
      }
    });
    return () => unsub();
  }, []);

  // Re-initialize Flatpickr when modal opens or tab changes
  useEffect(() => {
    if (showAddSheet && dateInputRef.current) {
      flatpickr(dateInputRef.current, {
        mode: "range",
        minDate: "today",
        onChange: (selectedDates, dateStr) => setFormDate(dateStr)
      });
    }
  }, [showAddSheet, entryType]);

  async function loadData(vid: string) {
    const gSnap = await getDocs(collection(db, "gear"));
    const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem));
    setAllGear(gear);

    const aSnap = await getDocs(collection(db, "vendors", vid, "availability"));
    const bks = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
    setBookings(bks);
    setLoading(false);
  }

  // --- Logic Helpers ---
  function getCategoryColor(category?: string) {
    return category && CATEGORY_COLORS[category] ? CATEGORY_COLORS[category] : DEFAULT_COLOR;
  }

  const categories = Array.from(new Set(allGear.map(g => g.category || "Add-ons"))).sort();

  function getRemainingStock(itemId: string, targetDateStr: string): number {
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;

    const date = new Date(targetDateStr);
    const dayOfWeek = date.getDay();

    // Check if entire day is blocked
    const isBlocked = bookings.some(b => {
      if (b.type !== 'block') return false;
      const inRange = targetDateStr >= b.start && targetDateStr <= b.end;
      const isRecurringBlock = b.isRecurring && b.dayOfWeek === dayOfWeek;
      return inRange || isRecurringBlock;
    });

    if (isBlocked) return 0;

    // Check individual item bookings
    const bookedQty = bookings
      .filter(b => b.type === 'booking' && b.itemId === itemId && targetDateStr >= b.start && targetDateStr <= b.end)
      .reduce((sum, b) => sum + (b.qty || 0), 0);

    return Math.max(0, item.stock - bookedQty);
  }

  function adjQty(id: string, delta: number, max = 999) {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min((prev[id] || 0) + delta, max)),
    }));
  }

  // --- Data Transformations ---
  const dailySummary = useMemo(() => {
    const targetDate = new Date(selectedDate);
    const dayOfWeek = targetDate.getDay();

    const filtered = bookings.filter(b => {
      const isDateInRange = selectedDate >= b.start && selectedDate <= b.end;
      const isRecurringDay = b.isRecurring && b.type === "block" && b.dayOfWeek === dayOfWeek;
      return isDateInRange || isRecurringDay;
    });
    
    const groups: Record<string, BookingGroup> = {};
    filtered.forEach(b => {
      const key = b.type === 'block' ? `block-${b.id}` : `booking-${b.customer}-${b.start}`;
      if (!groups[key]) {
        groups[key] = {
          id: b.type === 'block' ? b.id : key,
          type: b.type,
          customer: b.customer,
          phone: b.phone,
          reason: b.reason,
          start: b.start,
          end: b.end,
          itemCount: 0,
          items: [],
          isRecurring: b.isRecurring
        };
      }
      if (b.type === 'booking' && b.itemId) {
        const gear = allGear.find(g => g.id === b.itemId);
        groups[key].items.push({ id: b.itemId, name: gear?.name || "Unknown", qty: b.qty || 1, category: gear?.category || "Other" });
        groups[key].itemCount += (b.qty || 1);
      }
    });
    return Object.values(groups);
  }, [bookings, selectedDate, allGear]);

  const calendarEvents = useMemo(() => {
    return bookings.map(b => ({
      id: b.id,
      start: b.start,
      end: new Date(new Date(b.end).setDate(new Date(b.end).getDate() + 1)).toISOString().split('T')[0],
      className: b.type === 'block' ? 'fc-dot-red' : 'fc-dot-blue',
      title: b.type === 'block' ? 'Block' : 'Booking',
      allDay: true,
    }));
  }, [bookings]);

  // --- Actions ---
  async function saveEntry() {
    if (!vendorId) return;
    const dateVal = formDate || "";
    const dates = dateVal.split(" to ");
    if (!dates[0]) return alert("Please select dates.");
    
    const finalStart = dates[0];
    const finalEnd = dates[1] || dates[0];

    if (entryType === "block") {
      if (!formReason) return alert("Please provide a reason.");
      const dayOfWeek = new Date(finalStart).getDay();
      await addDoc(collection(db, "vendors", vendorId, "availability"), {
        type: "block", reason: formReason, start: finalStart, end: finalEnd,
        isRecurring, dayOfWeek: isRecurring ? dayOfWeek : null, createdAt: new Date().toISOString()
      });
    } else {
      // Booking Logic
      if (!custName) return alert("Please enter a customer name.");
      const batch = writeBatch(db);
      let hasData = false;

      Object.entries(quantities).forEach(([itemId, qty]) => {
        if (qty > 0) {
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            type: "booking", itemId, qty, start: finalStart, end: finalEnd,
            customer: custName, phone: custPhone, createdAt: new Date().toISOString()
          });
          hasData = true;
        }
      });

      if (!hasData) return alert("Select at least 1 item.");
      await batch.commit();
    }

    // Reset and Close
    setShowAddSheet(false);
    setFormDate(""); setFormReason(""); setIsRecurring(false);
    setCustName(""); setCustPhone(""); setQuantities({});
    loadData(vendorId);
  }

  async function deleteEntry(id: string, type: "booking" | "block") {
    if (!confirm(`Delete this ${type}?`)) return;
    if (type === "block") {
      await deleteDoc(doc(db, "vendors", vendorId!, "availability", id));
    } else {
      const bksToDelete = bookings.filter(b => `booking-${b.customer}-${b.start}` === id);
      const batch = writeBatch(db);
      bksToDelete.forEach(b => batch.delete(doc(db, "vendors", vendorId!, "availability", b.id)));
      await batch.commit();
    }
    setShowDetail(false);
    loadData(vendorId!);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CSS overrides for FullCalendar Dots */}
      <style>{`
        .fc-h-event { background: transparent; border: none; }
        .fc-daygrid-event-harness { display: inline-block; margin: 1px; }
        .fc-dot-blue .fc-event-title, .fc-dot-red .fc-event-title { display: none; }
        .fc-dot-blue { width: 6px; height: 6px; background-color: #3b82f6 !important; border-radius: 50%; display: inline-block; }
        .fc-dot-red { width: 6px; height: 6px; background-color: #ef4444 !important; border-radius: 50%; display: inline-block; }
        .fc-day-today .fc-daygrid-day-number { background: #062c24; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin: 4px auto; }
        .fc-daygrid-day-number { width: 100%; text-align: center; text-decoration: none !important; font-size: 12px; font-weight: 700; color: #334155; }
        .fc-col-header-cell-cushion { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 900; }
        .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 900; color: #062c24; text-transform: uppercase; }
      `}</style>

      {/* Header */}
      <header className="bg-white p-5 border-b border-slate-100 sticky top-0 z-30 flex items-center gap-3">
        <Link href="/store" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#062c24]">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#062c24] leading-none uppercase tracking-tight">Schedule</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Manage Availability</p>
        </div>
      </header>

      {/* Calendar View */}
      <div className="p-4">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 pb-2">
          {loading ? (
            <div className="h-64 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-emerald-500 text-2xl"></i></div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              dateClick={(info) => setSelectedDate(info.dateStr)}
              headerToolbar={{ left: 'prev', center: 'title', right: 'next' }}
              height="auto"
            />
          )}
        </div>
      </div>

      {/* Summary List */}
      <div className="px-5 space-y-3 mt-2">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
          {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {dailySummary.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-12 text-center">
            <i className="fas fa-calendar-check text-3xl text-slate-200 mb-3"></i>
            <p className="text-xs font-bold text-slate-400 uppercase">Clear Schedule</p>
          </div>
        ) : (
          dailySummary.map((item) => (
            <SwipeableCard key={item.id} onDelete={() => deleteEntry(item.id, item.type)} onEdit={() => alert("Edit logic goes here")} onClick={() => { setActiveDetail(item); setShowDetail(true); }}>
              <div className="flex items-center gap-4 w-full">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.type === 'block' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  <i className={`fas text-lg ${item.type === 'block' ? 'fa-ban' : 'fa-user'}`}></i>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-[#062c24] uppercase truncate">{item.type === 'block' ? "Time Off" : item.customer}</p>
                    {item.isRecurring && <span className="bg-amber-100 text-amber-700 text-[8px] px-2 py-0.5 rounded-md font-bold uppercase">Weekly</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {item.type === 'block' ? <><span className="text-red-400">{item.reason}</span> • All items</> : `${item.phone} • ${item.itemCount} items`}
                  </p>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-slate-300"></i>
              </div>
            </SwipeableCard>
          ))
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAddSheet(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-[#062c24] text-emerald-400 rounded-full shadow-2xl flex items-center justify-center text-xl z-40 hover:scale-110 transition-all border border-emerald-900/50">
        <i className="fas fa-plus"></i>
      </button>

      {/* Detail Modal */}
      {showDetail && activeDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetail(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className={`p-6 border-b ${activeDetail.type === 'block' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <button onClick={() => setShowDetail(false)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm"><i className="fas fa-arrow-left text-[10px]"></i></button>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <i className={`fas text-xl ${activeDetail.type === 'block' ? 'fa-ban text-red-500' : 'fa-user text-blue-500'}`}></i>
                <h3 className="text-xl font-black text-[#062c24] uppercase">{activeDetail.type === 'block' ? "Time Off" : activeDetail.customer}</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest"><i className="far fa-calendar text-slate-400 mr-2"></i>{activeDetail.start}</p>
            </div>
            <div className="p-6 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {activeDetail.type === "block" ? (
                <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100">
                  <i className="fas fa-lock text-red-400 text-3xl mb-3"></i>
                  <p className="text-sm font-black text-red-800 uppercase mb-1">{activeDetail.reason}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Booked Gear</p>
                  {/* Simplistic detail items renderer here for brevity */}
                  {activeDetail.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] font-medium text-slate-600 py-1 border-b border-slate-50 last:border-0">
                      <span>• {item.name}</span><span className="font-bold text-[#062c24]">× {item.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Sheet */}
      {showAddSheet && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddSheet(false)} />
          <div className="relative w-full max-h-[90vh] flex flex-col bg-white rounded-t-[2.5rem] shadow-2xl">
            <div className="flex-none p-6 pb-2 border-b border-slate-50">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                 <button onClick={() => setEntryType('booking')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${entryType === 'booking' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>New Booking</button>
                 <button onClick={() => setEntryType('block')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${entryType === 'block' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>Time Off</button>
              </div>

              {/* Shared Date Input */}
              <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3 border border-slate-100">
                <i className="fas fa-calendar-alt text-slate-400 text-lg ml-2"></i>
                <input ref={dateInputRef} value={formDate} placeholder="Select Dates..." className="w-full bg-transparent text-sm font-bold text-[#062c24] outline-none" readOnly />
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
              {entryType === 'block' ? (
                <div className="space-y-4">
                  <input value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Reason (Maintenance, Holiday...)" className="w-full bg-red-50 p-4 rounded-xl border border-red-100 font-bold text-sm text-red-700 placeholder:text-red-300 outline-none focus:ring-2 focus:ring-red-200" />
                  <label className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl cursor-pointer border border-amber-100">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 border-amber-300" />
                    <div>
                      <span className="block text-xs font-black text-amber-800 uppercase">Repeat Weekly</span>
                      <span className="block text-[9px] font-bold text-amber-600/70 mt-0.5">Automatically blocks this day every week</span>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Customer Info */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Customer Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Name" className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none border border-slate-100 focus:ring-2 focus:ring-blue-100" />
                      <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone" className="bg-slate-50 p-3 rounded-xl text-xs font-bold outline-none border border-slate-100 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>

                  {/* Gear Selection Accordion */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex justify-between">
                      <span>Select Gear to Book</span>
                      <span className="italic text-slate-400 font-medium lowercase">Checking availability for {formDate ? formDate.split(' ')[0] : 'selected date'}</span>
                    </p>
                    
                    {categories.map(cat => {
                      const items = allGear.filter(g => (g.category || "Add-ons") === cat);
                      const colors = getCategoryColor(cat);
                      
                      return (
                        <details key={cat} className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden mb-2`} open>
                          <summary className="flex justify-between items-center p-4 cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }}></div>
                              <span className={`text-[10px] font-black ${colors.text} uppercase tracking-widest`}>{cat}</span>
                            </div>
                            <i className={`fas fa-chevron-down ${colors.text} opacity-50 text-xs`}></i>
                          </summary>
                          <div className="p-2 space-y-2 bg-white/50 border-t border-white/50">
                            {items.map(g => {
                              const checkDate = formDate ? formDate.split(' to ')[0] : todayStr;
                              const remaining = getRemainingStock(g.id, checkDate);
                              
                              return (
                                <div key={g.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                                      {g.img ? <img src={g.img} alt={g.name} className="w-full h-full object-cover" /> : <i className="fas fa-campground text-slate-300 text-xs"></i>}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-700 uppercase leading-tight">{g.name}</p>
                                      <p className={`text-[8px] uppercase font-bold mt-0.5 ${remaining === 0 ? "text-red-500" : "text-emerald-500"}`}>
                                        {remaining === 0 ? "Fully booked" : `${remaining} left`}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* QTY Controls */}
                                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                                    <button onClick={() => adjQty(g.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 bg-white rounded-lg shadow-sm font-black">−</button>
                                    <span className="w-6 text-center text-xs font-bold text-slate-700">{quantities[g.id] || 0}</span>
                                    <button onClick={() => adjQty(g.id, 1, remaining)} disabled={remaining === 0} className={`w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-black ${remaining === 0 ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-emerald-500"}`}>+</button>
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
              )}
            </div>

            {/* Bottom Save Button */}
            <div className="flex-none p-6 border-t border-slate-50 bg-white pb-8">
               <button onClick={saveEntry} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg text-white ${entryType === 'block' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-[#062c24] hover:bg-emerald-900 shadow-emerald-900/30'}`}>
                 {entryType === 'block' ? 'Block Inventory' : 'Confirm Booking'}
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
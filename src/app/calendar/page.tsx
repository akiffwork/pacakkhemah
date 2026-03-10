"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, deleteDoc, writeBatch, updateDoc, setDoc, getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type GearItem = {
  id: string; name: string; stock: number;
  img?: string; category?: string; type?: string; deleted?: boolean;
};

type Booking = {
  id: string; itemId?: string; qty?: number;
  start: string; end: string; type?: string;
  customer?: string; phone?: string; reason?: string;
  blockId?: string; // Groups time-off entries together
};

type GroupedEntry = {
  id: string;
  type: "booking" | "block";
  customer?: string;
  phone?: string;
  reason?: string;
  start: string;
  end: string;
  items: { bookingId: string; name: string; qty: number; category: string }[];
  nights: number;
  blockId?: string;
};

type WeeklyOff = {
  [key: number]: boolean; // 0-6 for Sun-Sat
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function calculateNights(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// ═══════════════════════════════════════════════════════════════════════════
// SWIPEABLE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function SwipeableCard({ 
  children, 
  onEdit, 
  onDelete,
  onClick,
}: { 
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startX;
    const limited = Math.max(-80, Math.min(80, diff));
    setTranslateX(limited);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (translateX > 60) {
      onEdit();
      setTranslateX(0);
    } else if (translateX < -60) {
      onDelete();
      setTranslateX(0);
    } else {
      setTranslateX(0);
    }
  };

  const handleClick = () => {
    if (Math.abs(translateX) < 10) {
      onClick();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-blue-500 flex items-center pl-4">
          <i className="fas fa-pen text-white"></i>
        </div>
        <div className="flex-1 bg-red-500 flex items-center justify-end pr-4">
          <i className="fas fa-trash text-white"></i>
        </div>
      </div>
      
      {/* Card content */}
      <div 
        className="relative bg-white transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CALENDAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CalendarPage() {
  // Auth & data state
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<WeeklyOff>({});
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GroupedEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Add form state
  const [addType, setAddType] = useState<"booking" | "block">("booking");
  const [addStep, setAddStep] = useState(1);
  const [dateRange, setDateRange] = useState<[string, string]>(["", ""]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH & DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        window.location.href = "/store";
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, "vendors"), where("owner_uid", "==", u.uid)));
        if (!snap.empty) {
          const vid = snap.docs[0].id;
          setVendorId(vid);
          await loadData(vid);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Error loading vendor:", e);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function loadData(vid: string) {
    try {
      // Load gear
      const gSnap = await getDocs(query(collection(db, "gear"), where("vendorId", "==", vid)));
      const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted);
      setAllGear(gear);

      // Load bookings/availability
      const aSnap = await getDocs(collection(db, "vendors", vid, "availability"));
      const bks = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).filter(b => b.start && b.end);
      setBookings(bks);

      // Load weekly off days
      try {
        const wSnap = await getDoc(doc(db, "vendors", vid, "settings", "weeklyOff"));
        if (wSnap.exists()) {
          setWeeklyOff(wSnap.data() as WeeklyOff);
        }
      } catch {
        setWeeklyOff({});
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }

  function getDateStr(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getEntriesForDate(dateStr: string): GroupedEntry[] {
    const dayBookings = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
    
    // Group by customer/blockId
    const groups: Record<string, GroupedEntry> = {};
    
    dayBookings.forEach(b => {
      const isBlock = b.type === "block";
      const key = isBlock 
        ? `block-${b.blockId || b.id}-${b.start}-${b.end}`
        : `booking-${b.customer || "unknown"}-${b.start}-${b.end}`;
      
      if (!groups[key]) {
        groups[key] = {
          id: b.blockId || b.id,
          type: isBlock ? "block" : "booking",
          customer: b.customer,
          phone: b.phone,
          reason: b.reason,
          start: b.start,
          end: b.end,
          items: [],
          nights: calculateNights(b.start, b.end),
          blockId: b.blockId,
        };
      }
      
      const item = allGear.find(g => g.id === b.itemId);
      if (item) {
        groups[key].items.push({
          bookingId: b.id,
          name: item.name,
          qty: b.qty || 1,
          category: item.category || (item.type === "package" ? "Packages" : "Add-ons"),
        });
      }
    });
    
    return Object.values(groups);
  }

  function hasEntriesOnDate(dateStr: string): { hasBooking: boolean; hasBlock: boolean } {
    const entries = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
    return {
      hasBooking: entries.some(b => b.type !== "block"),
      hasBlock: entries.some(b => b.type === "block"),
    };
  }

  function isWeeklyOffDay(dateStr: string): boolean {
    const d = new Date(dateStr);
    return weeklyOff[d.getDay()] === true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function saveEntry() {
    if (!vendorId) return;
    if (!dateRange[0]) {
      showToast("Please select dates");
      return;
    }

    const batch = writeBatch(db);
    const start = dateRange[0];
    const end = dateRange[1] || dateRange[0];

    if (addType === "block") {
      // Time Off - block ALL items with single blockId
      const blockId = generateId();
      
      if (isRecurring && recurringDays.length > 0) {
        // Save recurring days
        await setDoc(doc(db, "vendors", vendorId, "settings", "weeklyOff"), {
          ...weeklyOff,
          ...Object.fromEntries(recurringDays.map(d => [d, true])),
        });
        setWeeklyOff(prev => ({
          ...prev,
          ...Object.fromEntries(recurringDays.map(d => [d, true])),
        }));
      } else {
        // One-time block for all items
        allGear.forEach(gear => {
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            itemId: gear.id,
            qty: gear.stock,
            start,
            end,
            type: "block",
            reason: blockReason || "Time Off",
            blockId,
            createdAt: new Date().toISOString(),
          });
        });
      }
    } else {
      // Booking - specific items
      const hasItems = Object.values(quantities).some(q => q > 0);
      if (!hasItems) {
        showToast("Please select at least 1 item");
        return;
      }
      if (!custName) {
        showToast("Please enter customer name");
        return;
      }

      Object.entries(quantities).forEach(([itemId, qty]) => {
        if (qty > 0) {
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            itemId,
            qty,
            start,
            end,
            type: "booking",
            customer: custName,
            phone: custPhone,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    try {
      await batch.commit();
      await loadData(vendorId);
      resetForm();
      setShowAddModal(false);
      showToast(addType === "block" ? "Time off saved!" : "Booking saved!");
    } catch (e) {
      console.error("Error saving:", e);
      showToast("Error saving entry");
    }
  }

  async function deleteEntry(entry: GroupedEntry) {
    if (!vendorId) return;
    if (!confirm("Delete this entry?")) return;

    try {
      if (entry.type === "block" && entry.blockId) {
        // Delete all items with same blockId
        const toDelete = bookings.filter(b => b.blockId === entry.blockId);
        for (const b of toDelete) {
          await deleteDoc(doc(db, "vendors", vendorId, "availability", b.id));
        }
      } else {
        // Delete individual booking items
        for (const item of entry.items) {
          await deleteDoc(doc(db, "vendors", vendorId, "availability", item.bookingId));
        }
      }
      
      await loadData(vendorId);
      setShowDetailModal(false);
      setSelectedEntry(null);
      showToast("Entry deleted");
    } catch (e) {
      console.error("Error deleting:", e);
      showToast("Error deleting entry");
    }
  }

  async function updateEntry() {
    if (!vendorId || !selectedEntry) return;

    try {
      if (selectedEntry.type === "block") {
        // Update all items with same blockId
        const toUpdate = bookings.filter(b => b.blockId === selectedEntry.blockId);
        for (const b of toUpdate) {
          await updateDoc(doc(db, "vendors", vendorId, "availability", b.id), {
            reason: blockReason,
          });
        }
      } else {
        // Update customer info on all booking items
        for (const item of selectedEntry.items) {
          await updateDoc(doc(db, "vendors", vendorId, "availability", item.bookingId), {
            customer: custName,
            phone: custPhone,
          });
        }
      }

      await loadData(vendorId);
      setIsEditing(false);
      setShowDetailModal(false);
      showToast("Entry updated");
    } catch (e) {
      console.error("Error updating:", e);
      showToast("Error updating entry");
    }
  }

  async function toggleWeeklyOff(day: number) {
    if (!vendorId) return;
    
    const newWeeklyOff = { ...weeklyOff, [day]: !weeklyOff[day] };
    
    try {
      await setDoc(doc(db, "vendors", vendorId, "settings", "weeklyOff"), newWeeklyOff);
      setWeeklyOff(newWeeklyOff);
      showToast(newWeeklyOff[day] ? `${DAYS_SHORT[day]} marked as off` : `${DAYS_SHORT[day]} is now available`);
    } catch (e) {
      console.error("Error updating weekly off:", e);
    }
  }

  function resetForm() {
    setAddStep(1);
    setAddType("booking");
    setDateRange(["", ""]);
    setCustName("");
    setCustPhone("");
    setBlockReason("");
    setIsRecurring(false);
    setRecurringDays([]);
    setQuantities({});
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openEditMode(entry: GroupedEntry) {
    setSelectedEntry(entry);
    if (entry.type === "block") {
      setBlockReason(entry.reason || "");
    } else {
      setCustName(entry.customer || "");
      setCustPhone(entry.phone || "");
    }
    setIsEditing(true);
  }

  // Selected date entries
  const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-emerald-500 text-3xl mb-3"></i>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/store" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#062c24] transition-colors">
            <i className="fas fa-arrow-left"></i>
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-black text-[#062c24]">{MONTHS[month]} {year}</h1>
          </div>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        
        {/* Weekly Off Days */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Off Days</p>
            <p className="text-[9px] text-slate-300">Tap to toggle</p>
          </div>
          <div className="flex justify-between">
            {DAYS_SHORT.map((day, idx) => (
              <button
                key={day}
                onClick={() => toggleWeeklyOff(idx)}
                className={`w-10 h-10 rounded-xl text-[10px] font-black uppercase transition-all ${
                  weeklyOff[idx]
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
              <i className="fas fa-chevron-left"></i>
            </button>
            <h2 className="text-sm font-black text-[#062c24] uppercase tracking-widest">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_SHORT.map(day => (
              <div key={day} className="text-center text-[9px] font-bold text-slate-300 uppercase py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first week */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square"></div>
            ))}
            
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = getDateStr(day);
              const { hasBooking, hasBlock } = hasEntriesOnDate(dateStr);
              const isOff = isWeeklyOffDay(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const isPast = dateStr < today;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  disabled={isPast}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${
                    isSelected
                      ? "bg-[#062c24] text-white shadow-lg"
                      : isToday
                      ? "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-500"
                      : isOff
                      ? "bg-red-50 text-red-400"
                      : isPast
                      ? "text-slate-200"
                      : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className={`text-sm font-bold ${isSelected ? "text-white" : ""}`}>{day}</span>
                  
                  {/* Indicators */}
                  {(hasBooking || hasBlock || isOff) && !isSelected && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasBooking && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                      {(hasBlock || isOff) && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Booking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Time Off</span>
            </div>
          </div>
        </div>

        {/* Selected Date Entries */}
        {selectedDate && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-[#062c24]">
                {formatDate(selectedDate)}
                {selectedDate === today && <span className="ml-2 text-[9px] font-bold text-emerald-500 uppercase">Today</span>}
              </h3>
              <span className="text-[9px] font-bold text-slate-300 uppercase">
                {selectedEntries.length} {selectedEntries.length === 1 ? "Entry" : "Entries"}
              </span>
            </div>

            {selectedEntries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <i className="fas fa-calendar-check text-slate-200 text-2xl mb-2"></i>
                <p className="text-xs font-bold text-slate-400">No entries for this date</p>
              </div>
            ) : (
              <div className="space-y-0">
                {selectedEntries.map(entry => (
                  <SwipeableCard
                    key={entry.id}
                    onEdit={() => openEditMode(entry)}
                    onDelete={() => deleteEntry(entry)}
                    onClick={() => {
                      setSelectedEntry(entry);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className={`p-4 border rounded-2xl ${
                      entry.type === "block" 
                        ? "bg-red-50 border-red-100" 
                        : "bg-white border-slate-100"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          entry.type === "block"
                            ? "bg-red-100 text-red-500"
                            : "bg-blue-100 text-blue-500"
                        }`}>
                          <i className={`fas ${entry.type === "block" ? "fa-ban" : "fa-user"}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black uppercase truncate ${
                            entry.type === "block" ? "text-red-700" : "text-[#062c24]"
                          }`}>
                            {entry.type === "block" ? (entry.reason || "Time Off") : entry.customer}
                          </p>
                          <p className={`text-[10px] ${entry.type === "block" ? "text-red-400" : "text-slate-400"}`}>
                            {entry.type === "block" 
                              ? `All items • ${entry.nights} ${entry.nights === 1 ? "day" : "days"}`
                              : `${entry.phone || "No phone"} • ${entry.items.length} items • ${entry.nights} ${entry.nights === 1 ? "night" : "nights"}`
                            }
                          </p>
                        </div>
                        <i className="fas fa-chevron-right text-[10px] text-slate-300 mt-3"></i>
                      </div>
                    </div>
                  </SwipeableCard>
                ))}
                
                <p className="text-center text-[9px] text-slate-300 mt-2">
                  <i className="fas fa-hand-pointer mr-1"></i> Swipe left to delete, right to edit
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB - Add Button */}
      <button
        onClick={() => {
          if (selectedDate) {
            setDateRange([selectedDate, selectedDate]);
          }
          setShowAddModal(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#062c24] text-white rounded-full flex items-center justify-center shadow-2xl shadow-[#062c24]/30 hover:bg-emerald-700 transition-all z-40"
      >
        <i className="fas fa-plus text-xl"></i>
      </button>

      {/* ═══════════════════════════════════════════════════════════════════════════
          ADD MODAL - Step by Step Wizard
          ═══════════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {addStep > 1 && (
                  <button onClick={() => setAddStep(addStep - 1)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-[#062c24]">
                    <i className="fas fa-arrow-left text-sm"></i>
                  </button>
                )}
                <div>
                  <h3 className="text-base font-black text-[#062c24] uppercase">
                    {addType === "booking" ? "New Booking" : "Time Off"}
                  </h3>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest">Step {addStep} of {addType === "booking" ? 3 : 2}</p>
                </div>
              </div>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              
              {/* Step 1: Type & Dates */}
              {addStep === 1 && (
                <div className="space-y-4">
                  {/* Type Toggle */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Entry Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAddType("booking")}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          addType === "booking"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <i className={`fas fa-user text-xl mb-2 ${addType === "booking" ? "text-blue-500" : "text-slate-300"}`}></i>
                        <p className={`text-xs font-black uppercase ${addType === "booking" ? "text-blue-700" : "text-slate-400"}`}>Booking</p>
                      </button>
                      <button
                        onClick={() => setAddType("block")}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          addType === "block"
                            ? "border-red-500 bg-red-50"
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <i className={`fas fa-ban text-xl mb-2 ${addType === "block" ? "text-red-500" : "text-slate-300"}`}></i>
                        <p className={`text-xs font-black uppercase ${addType === "block" ? "text-red-700" : "text-slate-400"}`}>Time Off</p>
                      </button>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Date Range</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-slate-300 uppercase">Start</label>
                        <input
                          type="date"
                          value={dateRange[0]}
                          min={today}
                          onChange={e => setDateRange([e.target.value, dateRange[1] || e.target.value])}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-300 uppercase">End</label>
                        <input
                          type="date"
                          value={dateRange[1]}
                          min={dateRange[0] || today}
                          onChange={e => setDateRange([dateRange[0], e.target.value])}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recurring Option (only for Time Off) */}
                  {addType === "block" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <label className="flex items-center gap-3 cursor-pointer mb-3">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={e => setIsRecurring(e.target.checked)}
                          className="w-5 h-5 rounded accent-amber-500"
                        />
                        <span className="text-sm font-bold text-amber-800">Make this recurring weekly</span>
                      </label>
                      
                      {isRecurring && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {DAYS_SHORT.map((day, idx) => (
                            <button
                              key={day}
                              onClick={() => {
                                setRecurringDays(prev => 
                                  prev.includes(idx) 
                                    ? prev.filter(d => d !== idx)
                                    : [...prev, idx]
                                );
                              }}
                              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                recurringDays.includes(idx)
                                  ? "bg-amber-500 text-white"
                                  : "bg-white text-amber-600 border border-amber-200"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Details (Booking: Customer Info, Block: Reason) */}
              {addStep === 2 && addType === "booking" && (
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Details</p>
                  <input
                    type="text"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    placeholder="Customer Name"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500 placeholder:text-slate-300"
                  />
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500 placeholder:text-slate-300"
                  />
                </div>
              )}

              {addStep === 2 && addType === "block" && (
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason (Optional)</p>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g., Maintenance, Holiday, Personal"
                    className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 outline-none focus:border-red-500 placeholder:text-red-300"
                  />
                  <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <i className="fas fa-info-circle text-slate-300 mb-2"></i>
                    <p className="text-xs text-slate-500">All items will be automatically blocked for these dates</p>
                  </div>
                </div>
              )}

              {/* Step 3: Select Items (Booking only) */}
              {addStep === 3 && addType === "booking" && (
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Items</p>
                  
                  {categories.map(cat => {
                    const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
                    return (
                      <details key={cat} className="bg-slate-50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 flex justify-between items-center cursor-pointer">
                          <span className="text-[10px] font-black text-[#062c24] uppercase">{cat}</span>
                          <i className="fas fa-chevron-down text-slate-400 text-xs"></i>
                        </summary>
                        <div className="bg-white p-2 space-y-1">
                          {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100" alt="" />
                                <div>
                                  <p className="text-xs font-bold text-[#062c24]">{item.name}</p>
                                  <p className="text-[9px] text-slate-400">Stock: {item.stock}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button
                                  onClick={() => setQuantities(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                                  className="w-8 h-8 rounded bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm"
                                >
                                  −
                                </button>
                                <span className="w-8 text-center text-xs font-bold">{quantities[item.id] || 0}</span>
                                <button
                                  onClick={() => setQuantities(prev => ({ ...prev, [item.id]: Math.min(item.stock, (prev[item.id] || 0) + 1) }))}
                                  className="w-8 h-8 rounded bg-white text-slate-400 hover:text-emerald-500 font-bold shadow-sm"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 shrink-0">
              {addStep < (addType === "booking" ? 3 : 2) ? (
                <button
                  onClick={() => setAddStep(addStep + 1)}
                  disabled={addStep === 1 && !dateRange[0]}
                  className="w-full py-4 bg-[#062c24] text-white rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-800 transition-all"
                >
                  Next <i className="fas fa-arrow-right ml-2"></i>
                </button>
              ) : (
                <button
                  onClick={saveEntry}
                  className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
                    addType === "block"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                >
                  <i className={`fas ${addType === "block" ? "fa-ban" : "fa-check"} mr-2`}></i>
                  {addType === "block" ? "Block Dates" : "Save Booking"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          DETAIL MODAL
          ═══════════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedEntry && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className={`p-4 border-b ${selectedEntry.type === "block" ? "bg-red-50 border-red-100" : "border-slate-100"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedEntry.type === "block" ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-500"
                  }`}>
                    <i className={`fas ${selectedEntry.type === "block" ? "fa-ban" : "fa-user"}`}></i>
                  </div>
                  <div>
                    <h3 className={`text-base font-black uppercase ${selectedEntry.type === "block" ? "text-red-700" : "text-[#062c24]"}`}>
                      {isEditing ? "Edit Entry" : (selectedEntry.type === "block" ? "Time Off" : "Booking Details")}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {formatDate(selectedEntry.start)} → {formatDate(selectedEntry.end)} • {selectedEntry.nights} {selectedEntry.nights === 1 ? "night" : "nights"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowDetailModal(false); setSelectedEntry(null); setIsEditing(false); }}
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-red-500"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {isEditing ? (
                // Edit Mode
                <div className="space-y-4">
                  {selectedEntry.type === "block" ? (
                    <input
                      type="text"
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      placeholder="Reason"
                      className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 outline-none focus:border-red-500"
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        value={custName}
                        onChange={e => setCustName(e.target.value)}
                        placeholder="Customer Name"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500"
                      />
                      <input
                        type="tel"
                        value={custPhone}
                        onChange={e => setCustPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500"
                      />
                    </>
                  )}
                </div>
              ) : (
                // View Mode
                <div className="space-y-4">
                  {/* Customer/Reason Info */}
                  <div className={`p-4 rounded-xl ${selectedEntry.type === "block" ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className={`text-lg font-black ${selectedEntry.type === "block" ? "text-red-700" : "text-[#062c24]"}`}>
                      {selectedEntry.type === "block" ? (selectedEntry.reason || "Time Off") : selectedEntry.customer}
                    </p>
                    {selectedEntry.type === "booking" && selectedEntry.phone && (
                      <a href={`tel:${selectedEntry.phone}`} className="flex items-center gap-2 mt-1 text-sm text-slate-500 hover:text-emerald-600">
                        <i className="fas fa-phone text-xs"></i>
                        {selectedEntry.phone}
                      </a>
                    )}
                  </div>

                  {/* Items Accordion */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                      {selectedEntry.type === "block" ? "Blocked Items" : "Booked Gear"}
                    </p>
                    
                    {selectedEntry.type === "block" ? (
                      <div className="bg-red-50 text-red-500 text-xs font-bold p-4 rounded-xl border border-red-100 flex items-center gap-3">
                        <i className="fas fa-lock"></i>
                        All inventory items are blocked for this period.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedEntry.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#062c24]">{item.name}</span>
                              <span className="text-[9px] text-slate-400 uppercase">{item.category}</span>
                            </div>
                            <span className="text-xs font-black text-[#062c24] bg-emerald-100 px-2 py-1 rounded-lg">
                              x{item.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-4 border-t border-slate-100 shrink-0 flex gap-2">
              {isEditing ? (
                <button
                  onClick={updateEntry}
                  className="flex-1 py-4 bg-[#062c24] text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-800 transition-all shadow-lg"
                >
                  Save Changes
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 py-4 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-100 transition-all"
                  >
                    <i className="fas fa-pen mr-2"></i> Edit Info
                  </button>
                  <button
                    onClick={() => deleteEntry(selectedEntry)}
                    className="flex-1 py-4 bg-red-50 text-red-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-100 transition-all"
                  >
                    <i className="fas fa-trash mr-2"></i> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TOAST NOTIFICATION
          ═══════════════════════════════════════════════════════════════════════════ */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#062c24] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300">
          <i className="fas fa-check-circle text-emerald-400"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">{toast}</span>
        </div>
      )}

    </div>
  );
}

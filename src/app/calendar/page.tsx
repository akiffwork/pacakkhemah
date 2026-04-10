"use client";

import { useEffect, useRef, useState } from "react";
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

type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

type GearItem = {
  id: string; name: string; stock: number;
  img?: string; category?: string; type?: string; deleted?: boolean;
  linkedItems?: { itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string }[];
  hasVariants?: boolean;
  variants?: GearVariant[];
};

type Booking = {
  id: string; itemId?: string; qty?: number;
  start: string; end: string; type?: string;
  customer?: string; phone?: string; reason?: string;
  blockId?: string; orderId?: string;
  variantId?: string; variantLabel?: string;
};

type GroupedEntry = {
  id: string;
  type: "booking" | "block";
  customer?: string;
  phone?: string;
  reason?: string;
  start: string;
  end: string;
  items: { bookingId: string; name: string; qty: number; category: string; variantId?: string; variantLabel?: string; variantColor?: string }[];
  nights: number;
  blockId?: string;
};

type WeeklyOff = { [key: number]: boolean };

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function calculateNights(start: string, end: string): number {
  const diff = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  );
  return Math.max(1, diff + 1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// SWIPEABLE CARD
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
  const startXRef = useRef(0);
  const swipingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    swipingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    setTranslateX(Math.max(-80, Math.min(80, diff)));
  };

  const handleTouchEnd = () => {
    swipingRef.current = false;
    if (translateX > 60) { onEdit(); }
    else if (translateX < -60) { onDelete(); }
    setTranslateX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2">
      {/* Swipe action backgrounds */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-blue-500 flex items-center px-4">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div className="flex-1 bg-red-500 flex items-center justify-end px-4">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      </div>
      {/* Card */}
      <div
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (Math.abs(translateX) < 10) onClick(); }}
      >
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function CalendarPage() {
  // ── Auth & Data ──
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<WeeklyOff>({});
  const [loading, setLoading] = useState(true);

  // ── Calendar ──
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const datePanelRef = useRef<HTMLDivElement>(null);

  // ── Modals ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GroupedEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ── Add Wizard ──
  const [addType, setAddType] = useState<"booking" | "block">("booking");
  const [addStep, setAddStep] = useState(1);
  const [dateRange, setDateRange] = useState<[string, string]>(["", ""]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);
  const [linkedOrderItems, setLinkedOrderItems] = useState<{ name: string; qty: number; price: number; variantLabel?: string; variantColor?: string }[]>([]);

  // ── Toast ──
  const [toast, setToast] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH & DATA
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const overrideVid = params.get("v");
    const orderParam = params.get("order");

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = "/store"; return; }
      try {
        // Admin override mode — vendorId passed as query param
        if (overrideVid) {
          setVendorId(overrideVid);
          await loadData(overrideVid);
          if (orderParam) await prefillFromOrder(orderParam, overrideVid);
          return;
        }
        const snap = await getDocs(query(collection(db, "vendors"), where("owner_uid", "==", u.uid)));
        if (!snap.empty) {
          const vid = snap.docs[0].id;
          setVendorId(vid);
          await loadData(vid);
          if (orderParam) await prefillFromOrder(orderParam, vid);
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
      const gSnap = await getDocs(query(collection(db, "gear"), where("vendorId", "==", vid)));
      const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted);
      setAllGear(gear);

      const aSnap = await getDocs(collection(db, "vendors", vid, "availability"));
      setBookings(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).filter(b => b.start && b.end));

      try {
        const wSnap = await getDoc(doc(db, "vendors", vid, "settings", "weeklyOff"));
        setWeeklyOff(wSnap.exists() ? (wSnap.data() as WeeklyOff) : {});
      } catch {
        setWeeklyOff({});
      }
      return gear;
    } catch (e) {
      console.error("Error loading data:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function prefillFromOrder(orderId: string, vid: string) {
    try {
      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) return;
      const order = orderSnap.data();
      if (order.vendorId !== vid) return;

      setLinkedOrderId(orderId);
      setLinkedOrderItems((order.items || []).map((i: any) => ({
        name: i.name, qty: i.qty, price: i.price,
        variantLabel: i.variantLabel || undefined,
        variantColor: i.variantColor || undefined,
      })));

      // Pre-fill dates
      if (order.bookingDates?.start) {
        setDateRange([order.bookingDates.start, order.bookingDates.end || order.bookingDates.start]);
      }

      // Pre-fill customer
      if (order.customerName) setCustName(order.customerName);
      if (order.customerPhone) setCustPhone(order.customerPhone);

      // Pre-fill quantities — match order items to gear by ID (with variant support)
      const qts: Record<string, number> = {};
      for (const item of (order.items || [])) {
        if (item.id) {
          const key = item.variantId ? `${item.id}__${item.variantId}` : item.id;
          qts[key] = item.qty || 1;
        }
      }
      setQuantities(qts);

      // Open wizard automatically
      setAddType("booking");
      setAddStep(1);
      setShowAddModal(true);
    } catch (e) {
      console.error("Error loading order:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getToday();

  function getDateStr(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isWeeklyOffDay(dateStr: string): boolean {
    return weeklyOff[new Date(dateStr).getDay()] === true;
  }

  function getEntriesForDate(dateStr: string): GroupedEntry[] {
    const dayBookings = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
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
        const variant = b.variantId ? item.variants?.find(v => v.id === b.variantId) : undefined;
        groups[key].items.push({
          bookingId: b.id,
          name: item.name,
          qty: b.qty || 1,
          category: item.category || (item.type === "package" ? "Packages" : "Add-ons"),
          variantId: b.variantId,
          variantLabel: variant ? [variant.color?.label, variant.size].filter(Boolean).join(", ") : b.variantLabel,
          variantColor: variant?.color?.hex,
        });
      }
    });

    return Object.values(groups);
  }

  function hasMarksOnDate(dateStr: string): { hasBooking: boolean; hasBlock: boolean } {
    const entries = bookings.filter(b => dateStr >= b.start && dateStr <= b.end);
    return {
      hasBooking: entries.some(b => b.type !== "block"),
      hasBlock: entries.some(b => b.type === "block") || isWeeklyOffDay(dateStr),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async function saveEntry() {
    if (!vendorId) return;
    if (!dateRange[0]) { showToast("Please select dates"); return; }

    const start = dateRange[0];
    const end = dateRange[1] || dateRange[0];
    const batch = writeBatch(db);

    if (addType === "block") {
      const hasItems = Object.values(quantities).some(q => q > 0);
      if (!hasItems) {
        // Fallback: block ALL items at full stock (legacy behavior)
        const blockId = generateId();
        allGear.forEach(gear => {
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            itemId: gear.id, qty: gear.stock,
            start, end, type: "block",
            reason: blockReason || "Time Off",
            blockId, createdAt: new Date().toISOString(),
          });
          // Also block each variant individually
          if (gear.hasVariants && gear.variants?.length) {
            gear.variants.forEach(v => {
              const vRef = doc(collection(db, "vendors", vendorId, "availability"));
              batch.set(vRef, {
                itemId: gear.id, variantId: v.id, qty: v.stock,
                start, end, type: "block",
                reason: blockReason || "Time Off",
                blockId, createdAt: new Date().toISOString(),
              });
            });
          }
        });
      } else {
        // Block selected items/variants
        const blockId = generateId();
        Object.entries(quantities).forEach(([key, qty]) => {
          if (qty <= 0) return;
          const [itemId, variantId] = key.split("__");
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            itemId, qty, start, end, type: "block",
            ...(variantId ? { variantId } : {}),
            reason: blockReason || "Time Off",
            blockId, createdAt: new Date().toISOString(),
          });
        });
      }
    } else {
      const hasItems = Object.values(quantities).some(q => q > 0);
      if (!hasItems) { showToast("Please select at least 1 item"); return; }
      if (!custName.trim()) { showToast("Please enter customer name"); return; }

      Object.entries(quantities).forEach(([key, qty]) => {
        if (qty > 0) {
          const [itemId, variantId] = key.split("__");
          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          const item = allGear.find(g => g.id === itemId);
          const variant = variantId ? item?.variants?.find(v => v.id === variantId) : undefined;
          const variantLabel = variant ? [variant.color?.label, variant.size].filter(Boolean).join(", ") : undefined;

          batch.set(ref, {
            itemId, qty, start, end, type: "booking",
            customer: custName.trim(), phone: custPhone.trim(),
            ...(variantId ? { variantId } : {}),
            ...(variantLabel ? { variantLabel } : {}),
            ...(linkedOrderId ? { orderId: linkedOrderId } : {}),
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    try {
      await batch.commit();

      // Update order with calendar link
      if (linkedOrderId) {
        try {
          await updateDoc(doc(db, "orders", linkedOrderId), {
            calendarLinked: true,
            calendarDates: { start, end },
          });
        } catch (e) { console.error("Order link error:", e); }
      }

      await loadData(vendorId);
      resetForm();
      setShowAddModal(false);
      showToast(addType === "block" ? "Dates blocked!" : "Booking saved!");
    } catch (e) {
      console.error("Save error:", e);
      showToast("Error saving — please try again");
    }
  }

  async function deleteEntry(entry: GroupedEntry) {
    if (!vendorId) return;
    if (!confirm("Delete this entry?")) return;
    try {
      if (entry.type === "block" && entry.blockId) {
        const toDelete = bookings.filter(b => b.blockId === entry.blockId);
        for (const b of toDelete) await deleteDoc(doc(db, "vendors", vendorId, "availability", b.id));
      } else {
        for (const item of entry.items) await deleteDoc(doc(db, "vendors", vendorId, "availability", item.bookingId));
      }
      await loadData(vendorId);
      setShowDetailModal(false);
      setSelectedEntry(null);
      showToast("Entry deleted");
    } catch (e) {
      console.error("Delete error:", e);
      showToast("Error deleting entry");
    }
  }

  async function updateEntry() {
    if (!vendorId || !selectedEntry) return;
    try {
      const batch = writeBatch(db);

      if (selectedEntry.type === "block") {
        // Update reason on all block docs
        const toUpdate = bookings.filter(b => b.blockId === selectedEntry.blockId);
        for (const b of toUpdate) {
          batch.update(doc(db, "vendors", vendorId, "availability", b.id), { reason: blockReason });
        }
      } else {
        // Delete all existing booking docs for this entry
        for (const item of selectedEntry.items) {
          batch.delete(doc(db, "vendors", vendorId, "availability", item.bookingId));
        }
        // Re-create from current quantities
        Object.entries(quantities).forEach(([key, qty]) => {
          if (qty <= 0) return;
          const [itemId, variantId] = key.split("__");
          const item = allGear.find(g => g.id === itemId);
          const variant = variantId ? item?.variants?.find(v => v.id === variantId) : undefined;
          const variantLabel = variant ? [variant.color?.label, variant.size].filter(Boolean).join(", ") : undefined;

          const ref = doc(collection(db, "vendors", vendorId, "availability"));
          batch.set(ref, {
            itemId, qty,
            start: selectedEntry.start, end: selectedEntry.end,
            type: "booking",
            customer: custName.trim(), phone: custPhone.trim(),
            ...(variantId ? { variantId } : {}),
            ...(variantLabel ? { variantLabel } : {}),
            createdAt: new Date().toISOString(),
          });
        });
      }

      await batch.commit();
      await loadData(vendorId);
      setIsEditing(false);
      setShowDetailModal(false);
      setQuantities({});
      showToast("Entry updated");
    } catch (e) {
      console.error("Update error:", e);
      showToast("Error updating entry");
    }
  }

  async function toggleWeeklyOff(day: number) {
    if (!vendorId) return;
    const updated = { ...weeklyOff, [day]: !weeklyOff[day] };
    try {
      await setDoc(doc(db, "vendors", vendorId, "settings", "weeklyOff"), updated);
      setWeeklyOff(updated);
      showToast(updated[day] ? `${DAYS_SHORT[day]} set as rest day` : `${DAYS_SHORT[day]} now available`);
    } catch (e) {
      console.error("Weekly off error:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function resetForm() {
    setAddStep(1); setAddType("booking");
    setDateRange(["", ""]); setCustName(""); setCustPhone("");
    setBlockReason(""); setQuantities({});
    setLinkedOrderId(null); setLinkedOrderItems([]);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openEditMode(entry: GroupedEntry) {
    setSelectedEntry(entry);
    if (entry.type === "block") setBlockReason(entry.reason || "");
    else { setCustName(entry.customer || ""); setCustPhone(entry.phone || ""); }
    // Pre-fill quantities from existing items
    const qts: Record<string, number> = {};
    for (const item of entry.items) {
      const gearItem = allGear.find(g => g.name === item.name);
      if (gearItem) {
        const key = item.variantId ? `${gearItem.id}__${item.variantId}` : gearItem.id;
        qts[key] = (qts[key] || 0) + item.qty;
      }
    }
    setQuantities(qts);
    setIsEditing(true);
    setShowDetailModal(true);
  }

  function handleSelectDate(dateStr: string) {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
    setTimeout(() => datePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }

  // ── Derived ──
  const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();
  const totalAddSteps = 3;

  function getMaxStock(item: GearItem): number {
    // Package: min of (child available / child qty required), capped by package stock
    if (item.linkedItems && item.linkedItems.length > 0) {
      let minPkg = Infinity;
      for (const li of item.linkedItems) {
        if (li.qty <= 0) continue;
        const child = allGear.find(g => g.id === li.itemId);
        if (!child) return 0;
        minPkg = Math.min(minPkg, Math.floor(child.stock / li.qty));
      }
      return Math.min(minPkg === Infinity ? 0 : minPkg, item.stock);
    }
    return item.stock;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 text-emerald-500 mx-auto mb-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#f5f4f1]" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <div className="w-full max-w-lg mx-auto min-h-screen flex flex-col">

        {/* ── HEADER ── */}
        <header className="bg-[#062c24] px-4 py-3 sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/store"
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDate(null); }}
                className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-white font-bold text-[15px] tracking-tight min-w-[120px] text-center truncate">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDate(null); }}
                className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="w-9 flex-shrink-0" />
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto pb-24 px-3 pt-3 flex flex-col gap-3">

          {/* ── WEEKLY REST DAYS ── */}
          <div className="bg-white rounded-2xl border border-black/[0.07] p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">🌙 Weekly Rest Days</p>
            <p className="text-[10px] text-slate-300 mb-3">Tap to toggle — active days block all inventory</p>
            <div className="grid grid-cols-7 gap-1">
              {DAYS_SHORT.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => toggleWeeklyOff(idx)}
                  className={`flex flex-col items-center justify-center rounded-xl py-2 px-0 gap-1 transition-all active:scale-95 ${
                    weeklyOff[idx]
                      ? "bg-red-500 text-white"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase leading-none">{day.slice(0, 1)}</span>
                  <span className={`text-[10px] leading-none transition-opacity ${weeklyOff[idx] ? "opacity-100" : "opacity-0"}`}>
                    💤
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── CALENDAR GRID ── */}
          <div className="bg-white rounded-2xl border border-black/[0.07] p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-bold text-slate-300 uppercase py-1 truncate">
                  {d.slice(0, 1)}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = getDateStr(day);
                const isPast = dateStr < today;
                const isToday = dateStr === today;
                const isSel = dateStr === selectedDate;
                const isOff = isWeeklyOffDay(dateStr);
                const { hasBooking, hasBlock } = hasMarksOnDate(dateStr);

                return (
                  <button
                    key={day}
                    onClick={() => handleSelectDate(dateStr)}
                    className={[
                      "aspect-square rounded-[9px] flex flex-col items-center justify-center transition-all active:scale-90 min-w-0 overflow-hidden",
                      isSel ? "bg-[#062c24]" :
                      isToday ? "bg-emerald-100 ring-1 ring-emerald-400" :
                      isOff ? "bg-red-50" :
                      isPast ? "" :
                      "hover:bg-slate-50",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className={[
                      "text-[11px] sm:text-[13px] font-medium leading-none",
                      isSel ? "text-white font-bold" :
                      isToday ? "text-emerald-700 font-bold" :
                      isOff ? "text-red-500" :
                      isPast ? "text-slate-200" :
                      "text-slate-700",
                    ].filter(Boolean).join(" ")}>
                      {day}
                    </span>

                    {/* Bar indicators */}
                    {(hasBooking || hasBlock) && !isSel && (
                      <div className="flex gap-[2px] mt-[3px]">
                        {hasBooking && <div className="w-[10px] sm:w-[12px] h-[3px] rounded-full bg-blue-500" />}
                        {hasBlock && <div className="w-[10px] sm:w-[12px] h-[3px] rounded-full bg-red-500" />}
                      </div>
                    )}

                    {/* Zzz for off days */}
                    {isOff && !isSel && (
                      <span className="text-[8px] leading-none mt-[2px]">💤</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-slate-50">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[3px] rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Booking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[3px] rounded-full bg-red-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Time off / Rest</span>
              </div>
            </div>
          </div>

          {/* ── SELECTED DATE PANEL ── */}
          <div ref={datePanelRef}>
            {selectedDate && (
              <div className="animate-[slideUp_0.18s_ease-out]">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="text-[15px] font-bold text-[#062c24] truncate">
                      {formatDate(selectedDate)}
                    </span>
                    {selectedDate === today && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wide whitespace-nowrap flex-shrink-0">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-black/5 px-2 py-1 rounded-md whitespace-nowrap flex-shrink-0">
                    {selectedEntries.length + (isWeeklyOffDay(selectedDate) ? 1 : 0)} {
                      (selectedEntries.length + (isWeeklyOffDay(selectedDate) ? 1 : 0)) === 1 ? "entry" : "entries"
                    }
                  </span>
                </div>

                {/* Rest day card */}
                {isWeeklyOffDay(selectedDate) && (
                  <div className="bg-white rounded-2xl border border-black/[0.07] mb-2 overflow-hidden flex">
                    <div className="w-1 bg-amber-400 flex-shrink-0" />
                    <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-base flex-shrink-0">
                        💤
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-[13px] font-bold text-amber-800 truncate">Rest Day — All Blocked</p>
                        <p className="text-[11px] text-amber-600 truncate">Toggle in Weekly Rest Days above to remove</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Entries */}
                {selectedEntries.length === 0 && !isWeeklyOffDay(selectedDate) ? (
                  <div className="bg-white rounded-2xl border border-black/[0.07] p-6 text-center">
                    <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-xl">
                      📅
                    </div>
                    <p className="text-[13px] font-bold text-slate-400">All clear!</p>
                    <p className="text-[11px] text-slate-300 mt-1">No bookings or blocks on this date</p>
                  </div>
                ) : (
                  <>
                    {selectedEntries.map(entry => (
                      <SwipeableCard
                        key={entry.id}
                        onEdit={() => openEditMode(entry)}
                        onDelete={() => deleteEntry(entry)}
                        onClick={() => { setSelectedEntry(entry); setIsEditing(false); setShowDetailModal(true); }}
                      >
                        <div className={`flex overflow-hidden ${entry.type === "block" ? "bg-red-50/60" : "bg-white"}`}>
                          {/* Left accent bar */}
                          <div className={`w-1 flex-shrink-0 ${entry.type === "block" ? "bg-red-500" : "bg-blue-500"}`} />
                          <div className="flex items-center gap-3 p-3 flex-1 min-w-0 overflow-hidden">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${
                              entry.type === "block" ? "bg-red-100" : "bg-blue-100"
                            }`}>
                              {entry.type === "block" ? "🚫" : "👤"}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className={`text-[13px] font-bold truncate ${
                                entry.type === "block" ? "text-red-800" : "text-[#062c24]"
                              }`}>
                                {entry.type === "block" ? (entry.reason || "Time Off") : entry.customer}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {entry.type === "block"
                                  ? `${entry.items.length} item${entry.items.length !== 1 ? "s" : ""} · ${entry.nights} day${entry.nights > 1 ? "s" : ""}`
                                  : `${entry.phone || "No phone"} · ${entry.items.length} item${entry.items.length !== 1 ? "s" : ""} · ${entry.nights} night${entry.nights > 1 ? "s" : ""}`
                                }
                              </p>
                            </div>
                            <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </SwipeableCard>
                    ))}
                    {selectedEntries.length > 0 && (
                      <p className="text-center text-[10px] text-slate-300 mt-1 font-medium">
                        ← swipe left to delete &nbsp;·&nbsp; swipe right to edit →
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

        </div>{/* end scrollable content */}

        {/* ── FAB ── */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-3 pointer-events-none flex justify-end">
          <button
            onClick={() => {
              if (selectedDate) setDateRange([selectedDate, selectedDate]);
              setShowAddModal(true);
            }}
            className={`pointer-events-auto bg-[#062c24] text-white font-bold shadow-[0_4px_18px_rgba(6,44,36,0.38)] hover:bg-[#0d4a3a] active:scale-95 transition-all flex items-center gap-2 overflow-hidden whitespace-nowrap ${
              selectedDate
                ? "h-12 px-5 rounded-full text-[11px] uppercase tracking-wider max-w-[220px]"
                : "w-13 h-13 w-[52px] h-[52px] rounded-full justify-center"
            }`}
          >
            <span className="text-xl font-light leading-none flex-shrink-0">+</span>
            {selectedDate && (
              <span className="truncate">Add to {formatDate(selectedDate)}</span>
            )}
          </button>
        </div>

      </div>{/* end max-w wrapper */}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD MODAL — WIZARD
          ══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-[#062c24]/85 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm(); } }}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[90vh] flex flex-col">

            {/* Handle */}
            <div className="w-8 h-1 bg-black/10 rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Progress bar */}
            <div className="mx-4 mt-3 h-[3px] bg-black/[0.07] rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((addStep / totalAddSteps) * 100)}%` }}
              />
            </div>

            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 gap-2 min-w-0">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                {addStep > 1 && (
                  <button
                    onClick={() => setAddStep(s => s - 1)}
                    className="text-slate-400 hover:text-[#062c24] text-sm font-semibold whitespace-nowrap flex-shrink-0"
                  >
                    ← Back
                  </button>
                )}
                <span className="text-[14px] font-bold text-[#062c24] truncate">
                  {addType === "booking" ? "New Booking" : "Time Off"} · {addStep}/{totalAddSteps}
                </span>
                {linkedOrderId && (
                  <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                    Linked Order
                  </span>
                )}
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">

              {/* Step 1 — Type + Dates */}
              {addStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2">Entry Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["booking", "block"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setAddType(t)}
                          className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                            addType === t
                              ? t === "booking" ? "border-blue-500 bg-blue-50" : "border-red-500 bg-red-50"
                              : "border-black/[0.07] hover:border-black/10"
                          }`}
                        >
                          <span className="text-2xl">{t === "booking" ? "👤" : "🚫"}</span>
                          <span className={`text-[11px] font-bold uppercase tracking-wide ${
                            addType === t ? (t === "booking" ? "text-blue-700" : "text-red-700") : "text-slate-400"
                          }`}>
                            {t === "booking" ? "Booking" : "Time Off"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2">Date Range</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-slate-300 uppercase tracking-wide block mb-1">Start</label>
                        <input
                          type="date"
                          value={dateRange[0]}
                          min={today}
                          onChange={e => setDateRange([e.target.value, dateRange[1] || e.target.value])}
                          className="w-full p-3 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-300 uppercase tracking-wide block mb-1">End</label>
                        <input
                          type="date"
                          value={dateRange[1]}
                          min={dateRange[0] || today}
                          onChange={e => setDateRange([dateRange[0], e.target.value])}
                          className="w-full p-3 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Linked order summary */}
                  {linkedOrderId && linkedOrderItems.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-2">
                        <i className="fas fa-link mr-1"></i>From WhatsApp Order
                      </p>
                      <div className="space-y-1">
                        {linkedOrderItems.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-[12px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.variantColor && <span className="w-3 h-3 rounded-full border border-blue-200 shrink-0" style={{ backgroundColor: item.variantColor }}></span>}
                              <span className="font-semibold text-blue-900 truncate">
                                {item.name}
                                {item.variantLabel && <span className="text-[10px] text-blue-500 ml-1">({item.variantLabel})</span>}
                              </span>
                            </div>
                            <span className="font-bold text-blue-700 shrink-0 ml-2">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-blue-500 mt-2">Items pre-filled in Step 3. You can adjust.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 Booking — Customer info */}
              {addStep === 2 && addType === "booking" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Customer Details</p>
                  <input
                    type="text"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full p-4 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white placeholder:text-slate-300 transition-colors"
                  />
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full p-4 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white placeholder:text-slate-300 transition-colors"
                  />
                </div>
              )}

              {/* Step 2 Block — Select items/variants to block */}
              {addStep === 2 && addType === "block" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Select Items to Block</p>
                  <div className="bg-red-50 rounded-xl p-3 flex items-start gap-3">
                    <span className="text-base flex-shrink-0">💡</span>
                    <p className="text-[11px] text-red-600 leading-relaxed">
                      Select specific items/variants to block, or leave empty to <strong>block all inventory</strong>.
                    </p>
                  </div>
                  {allGear.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm font-bold text-slate-400">No gear items yet</p>
                    </div>
                  ) : (
                    categories.map(cat => {
                      const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
                      return (
                        <details key={cat} className="bg-slate-50 rounded-xl overflow-hidden" open>
                          <summary className="px-3 py-2 flex justify-between items-center cursor-pointer">
                            <span className="text-[10px] font-bold text-[#062c24] uppercase tracking-wide">{cat}</span>
                          </summary>
                          <div className="bg-white divide-y divide-slate-50">
                            {items.map(item => {
                              const hasVars = item.hasVariants && item.variants && item.variants.length > 0;
                              return (
                                <div key={item.id} className="p-3">
                                  {!hasVars ? (
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                        <div className="min-w-0 overflow-hidden">
                                          <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-400">Stock: {item.stock}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
                                        <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                                          className="w-7 h-7 rounded bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm text-sm">−</button>
                                        <span className="w-7 text-center text-[12px] font-bold text-[#062c24]">{quantities[item.id] || 0}</span>
                                        <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.min(item.stock, (p[item.id] || 0) + 1) }))}
                                          className="w-7 h-7 rounded bg-white text-slate-400 hover:text-emerald-500 font-bold shadow-sm text-sm">+</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex items-center gap-3 mb-2">
                                        <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                        <div className="min-w-0 overflow-hidden">
                                          <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-400">{item.variants!.length} variants</p>
                                        </div>
                                      </div>
                                      <div className="ml-11 space-y-1.5">
                                        {item.variants!.map(v => {
                                          const vKey = `${item.id}__${v.id}`;
                                          const label = [v.color?.label, v.size].filter(Boolean).join(", ") || v.id;
                                          return (
                                            <div key={v.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                                              <div className="flex items-center gap-2 min-w-0">
                                                {v.color?.hex && <span className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.color.hex }}></span>}
                                                <span className="text-[11px] font-bold text-slate-600 truncate">{label}</span>
                                                <span className="text-[9px] text-slate-400 flex-shrink-0">({v.stock})</span>
                                              </div>
                                              <div className="flex items-center gap-1 bg-white rounded-md p-0.5 flex-shrink-0">
                                                <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.max(0, (p[vKey] || 0) - 1) }))}
                                                  className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-red-500 font-bold text-xs">−</button>
                                                <span className="w-5 text-center text-[11px] font-bold text-[#062c24]">{quantities[vKey] || 0}</span>
                                                <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.min(v.stock, (p[vKey] || 0) + 1) }))}
                                                  className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-emerald-500 font-bold text-xs">+</button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })
                  )}
                </div>
              )}

              {/* Step 3 Block — Reason */}
              {addStep === 3 && addType === "block" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Reason (Optional)</p>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Maintenance, Holiday, Personal"
                    className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 outline-none focus:border-red-400 placeholder:text-red-300 transition-colors"
                  />
                  {!Object.values(quantities).some(q => q > 0) && (
                    <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-base flex-shrink-0">💤</span>
                      <p className="text-[12px] text-slate-500 leading-relaxed">
                        No items selected — <strong>all inventory</strong> will be blocked for these dates.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 Booking — Select items/variants */}
              {addStep === 3 && addType === "booking" && (
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Select Items</p>
                  {allGear.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm font-bold text-slate-400">No gear items yet</p>
                      <p className="text-[11px] text-slate-300 mt-1">Add items in your inventory first</p>
                    </div>
                  ) : (
                    categories.map(cat => {
                      const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
                      return (
                        <details key={cat} className="bg-slate-50 rounded-xl overflow-hidden" open>
                          <summary className="px-3 py-2 flex justify-between items-center cursor-pointer">
                            <span className="text-[10px] font-bold text-[#062c24] uppercase tracking-wide">{cat}</span>
                          </summary>
                          <div className="bg-white divide-y divide-slate-50">
                            {items.map(item => {
                              const hasVars = item.hasVariants && item.variants && item.variants.length > 0;
                              return (
                                <div key={item.id} className="p-3">
                                  {!hasVars ? (
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                        <div className="min-w-0 overflow-hidden">
                                          <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-400">
                                            Stock: {getMaxStock(item)}{item.linkedItems?.length ? ` (${item.linkedItems.length} items)` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
                                        <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                                          className="w-7 h-7 rounded bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm text-sm">−</button>
                                        <span className="w-7 text-center text-[12px] font-bold text-[#062c24]">{quantities[item.id] || 0}</span>
                                        <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.min(getMaxStock(item), (p[item.id] || 0) + 1) }))}
                                          className="w-7 h-7 rounded bg-white text-slate-400 hover:text-emerald-500 font-bold shadow-sm text-sm">+</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex items-center gap-3 mb-2">
                                        <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                        <div className="min-w-0 overflow-hidden">
                                          <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-400">{item.variants!.length} variants</p>
                                        </div>
                                      </div>
                                      <div className="ml-11 space-y-1.5">
                                        {item.variants!.map(v => {
                                          const vKey = `${item.id}__${v.id}`;
                                          const label = [v.color?.label, v.size].filter(Boolean).join(", ") || v.id;
                                          return (
                                            <div key={v.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                                              <div className="flex items-center gap-2 min-w-0">
                                                {v.color?.hex && <span className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.color.hex }}></span>}
                                                <span className="text-[11px] font-bold text-slate-600 truncate">{label}</span>
                                                <span className="text-[9px] text-slate-400 flex-shrink-0">({v.stock})</span>
                                              </div>
                                              <div className="flex items-center gap-1 bg-white rounded-md p-0.5 flex-shrink-0">
                                                <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.max(0, (p[vKey] || 0) - 1) }))}
                                                  className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-red-500 font-bold text-xs">−</button>
                                                <span className="w-5 text-center text-[11px] font-bold text-[#062c24]">{quantities[vKey] || 0}</span>
                                                <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.min(v.stock, (p[vKey] || 0) + 1) }))}
                                                  className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-emerald-500 font-bold text-xs">+</button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-4 pt-2 pb-5 flex-shrink-0">
              {addStep < totalAddSteps ? (
                <button
                  onClick={() => setAddStep(s => s + 1)}
                  disabled={addStep === 1 && !dateRange[0]}
                  className="w-full py-4 bg-[#062c24] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0d4a3a] transition-all"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={saveEntry}
                  className={`w-full py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest transition-all ${
                    addType === "block"
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {addType === "block" ? "🚫 Block Dates" : "✓ Save Booking"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedEntry && (
        <div
          className="fixed inset-0 bg-[#062c24]/85 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setShowDetailModal(false); setSelectedEntry(null); setIsEditing(false); setQuantities({}); } }}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[90vh] flex flex-col">

            {/* Handle */}
            <div className="w-8 h-1 bg-black/10 rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Accent bar */}
            <div className={`h-1 mx-4 mt-3 rounded-full flex-shrink-0 ${selectedEntry.type === "block" ? "bg-red-500" : "bg-blue-500"}`} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 gap-2 min-w-0">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden flex-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${
                  selectedEntry.type === "block" ? "bg-red-100" : "bg-blue-100"
                }`}>
                  {selectedEntry.type === "block" ? "🚫" : "👤"}
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[14px] font-bold text-[#062c24] truncate">
                    {isEditing ? "Edit Entry" : selectedEntry.type === "block" ? "Time Off" : "Booking Details"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {formatDate(selectedEntry.start)} → {formatDate(selectedEntry.end)} · {selectedEntry.nights} night{selectedEntry.nights > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedEntry(null); setIsEditing(false); setQuantities({}); }}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
              {isEditing ? (
                // Edit mode
                <>
                  {selectedEntry.type === "block" ? (
                    <input
                      type="text"
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      placeholder="Reason"
                      className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 outline-none focus:border-red-400 transition-colors"
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        value={custName}
                        onChange={e => setCustName(e.target.value)}
                        placeholder="Customer Name"
                        className="w-full p-4 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                      />
                      <input
                        type="tel"
                        value={custPhone}
                        onChange={e => setCustPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="w-full p-4 bg-slate-50 border border-black/[0.07] rounded-xl text-sm font-semibold text-[#062c24] outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                      />
                      <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">Edit Items</p>
                      {categories.map(cat => {
                        const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
                        return (
                          <details key={cat} className="bg-slate-50 rounded-xl overflow-hidden" open>
                            <summary className="px-3 py-2 flex justify-between items-center cursor-pointer">
                              <span className="text-[10px] font-bold text-[#062c24] uppercase tracking-wide">{cat}</span>
                            </summary>
                            <div className="bg-white divide-y divide-slate-50">
                              {items.map(item => {
                                const hasVars = item.hasVariants && item.variants && item.variants.length > 0;
                                return (
                                  <div key={item.id} className="p-3">
                                    {!hasVars ? (
                                      <div className="flex items-center justify-between gap-2 min-w-0">
                                        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                          <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                          <div className="min-w-0 overflow-hidden">
                                            <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-400">Stock: {getMaxStock(item)}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
                                          <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                                            className="w-7 h-7 rounded bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm text-sm">−</button>
                                          <span className="w-7 text-center text-[12px] font-bold text-[#062c24]">{quantities[item.id] || 0}</span>
                                          <button onClick={() => setQuantities(p => ({ ...p, [item.id]: Math.min(getMaxStock(item), (p[item.id] || 0) + 1) }))}
                                            className="w-7 h-7 rounded bg-white text-slate-400 hover:text-emerald-500 font-bold shadow-sm text-sm">+</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="flex items-center gap-3 mb-2">
                                          <img src={item.img || "/pacak-khemah.png"} className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0" alt="" />
                                          <div className="min-w-0 overflow-hidden">
                                            <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-400">{item.variants!.length} variants</p>
                                          </div>
                                        </div>
                                        <div className="ml-11 space-y-1.5">
                                          {item.variants!.map(v => {
                                            const vKey = `${item.id}__${v.id}`;
                                            const label = [v.color?.label, v.size].filter(Boolean).join(", ") || v.id;
                                            return (
                                              <div key={v.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  {v.color?.hex && <span className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.color.hex }}></span>}
                                                  <span className="text-[11px] font-bold text-slate-600 truncate">{label}</span>
                                                  <span className="text-[9px] text-slate-400 flex-shrink-0">({v.stock})</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-white rounded-md p-0.5 flex-shrink-0">
                                                  <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.max(0, (p[vKey] || 0) - 1) }))}
                                                    className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-red-500 font-bold text-xs">−</button>
                                                  <span className="w-5 text-center text-[11px] font-bold text-[#062c24]">{quantities[vKey] || 0}</span>
                                                  <button onClick={() => setQuantities(p => ({ ...p, [vKey]: Math.min(v.stock, (p[vKey] || 0) + 1) }))}
                                                    className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:text-emerald-500 font-bold text-xs">+</button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })}
                    </>
                  )}
                </>
              ) : (
                // View mode
                <>
                  <div className={`p-4 rounded-xl ${selectedEntry.type === "block" ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className={`text-base font-bold truncate ${selectedEntry.type === "block" ? "text-red-700" : "text-[#062c24]"}`}>
                      {selectedEntry.type === "block" ? (selectedEntry.reason || "Time Off") : selectedEntry.customer}
                    </p>
                    {selectedEntry.type === "booking" && selectedEntry.phone && (
                      <a href={`tel:${selectedEntry.phone}`} className="flex items-center gap-2 mt-1 text-sm text-slate-500 hover:text-emerald-600 truncate">
                        📞 <span className="truncate">{selectedEntry.phone}</span>
                      </a>
                    )}
                  </div>

                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                    {selectedEntry.type === "block" ? "Blocked Items" : "Booked Gear"}
                  </p>

                  {selectedEntry.type === "block" ? (
                    <div className="bg-red-50 text-red-600 text-[12px] font-semibold p-4 rounded-xl flex items-center gap-3">
                      <span className="flex-shrink-0">💤</span>
                      <span>All inventory items are blocked for this period.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedEntry.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl gap-2 min-w-0">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              {item.variantColor && <span className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: item.variantColor }}></span>}
                              <p className="text-[12px] font-bold text-[#062c24] truncate">{item.name}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                              {item.variantLabel ? `${item.variantLabel} · ` : ""}{item.category}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg flex-shrink-0">
                            ×{item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 pt-2 pb-5 flex-shrink-0 flex gap-2">
              {isEditing ? (
                <button
                  onClick={updateEntry}
                  className="flex-1 py-4 bg-[#062c24] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest hover:bg-[#0d4a3a] transition-all"
                >
                  Save Changes
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (selectedEntry.type === "block") setBlockReason(selectedEntry.reason || "");
                      else { setCustName(selectedEntry.customer || ""); setCustPhone(selectedEntry.phone || ""); }
                      setIsEditing(true);
                    }}
                    className="flex-1 py-4 bg-blue-50 text-blue-700 rounded-2xl font-bold uppercase text-[11px] tracking-widest hover:bg-blue-100 transition-all"
                  >
                    ✏ Edit Info
                  </button>
                  <button
                    onClick={() => deleteEntry(selectedEntry)}
                    className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold uppercase text-[11px] tracking-widest hover:bg-red-100 transition-all"
                  >
                    🗑 Delete
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-[#062c24] text-white px-5 py-2.5 rounded-full flex items-center gap-2 max-w-[90vw] overflow-hidden">
          <span className="text-emerald-400 flex-shrink-0">✓</span>
          <span className="text-[11px] font-bold uppercase tracking-widest truncate">{toast}</span>
        </div>
      )}

    </div>
  );
}
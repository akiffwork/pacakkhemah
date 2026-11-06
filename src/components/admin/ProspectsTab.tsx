"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { STATE_NAMES, districtsOf, resolveAny } from "@/lib/malaysiaLocations";
import {
  FirestoreTime, PROSPECT_SIGNUP_BASE, Prospect, ProspectClick, ProspectStatus,
  buildOutreachMessage, normalizeMyPhone, statsFor, waLink,
} from "@/lib/prospects";

type WaitlistEntry = { id: string; phone: string; searched: string; state?: string | null; district?: string | null; createdAt?: FirestoreTime };
type AdminVendor = { id: string; name?: string; status?: string; city?: string; areas?: string[]; pickup?: string[]; prospect_id?: string; slug?: string };

const STATUS_STYLE: Record<ProspectStatus, string> = {
  active: "bg-slate-100 text-slate-600",
  contacted: "bg-blue-50 text-blue-600",
  converted: "bg-emerald-50 text-emerald-600",
};

const EMPTY_FORM = { name: "", phone: "", state: "Negeri Sembilan", district: "", areas: "", status: "active" as ProspectStatus };

function fmtDate(d: Date | null): string {
  if (!d) return "–";
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export default function ProspectsTab({ allVendors }: { allVendors: AdminVendor[] }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [clicks, setClicks] = useState<ProspectClick[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, c, w] = await Promise.all([
        getDocs(collection(db, "prospects")),
        getDocs(collection(db, "prospect_clicks")),
        getDocs(collection(db, "area_waitlist")),
      ]);
      setProspects(p.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
      setClicks(c.docs.map(d => ({ id: d.id, ...d.data() } as ProspectClick)));
      setWaitlist(w.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistEntry)));
    } catch (e) {
      console.error(e);
      alert("Error loading prospects. Check that firestore.rules has been deployed.");
    } finally {
      setLoading(false);
    }
  }

  const clicksByProspect = useMemo(() => {
    const m: Record<string, ProspectClick[]> = {};
    clicks.forEach(c => { (m[c.prospectId] ||= []).push(c); });
    return m;
  }, [clicks]);

  const signedUpBy = useMemo(() => {
    const m: Record<string, AdminVendor> = {};
    allVendors.forEach(v => { if (v.prospect_id) m[v.prospect_id] = v; });
    return m;
  }, [allVendors]);

  // Demand per area: enquiries + waitlist, against approved vendors in the same state.
  const areas = useMemo(() => {
    const vendorsPerState: Record<string, number> = {};
    allVendors.filter(v => v.status === "approved").forEach(v => {
      const states = new Set(resolveAny([v.city, ...(v.areas || []), ...(v.pickup || [])]).map(r => r.state));
      states.forEach(s => { vendorsPerState[s] = (vendorsPerState[s] || 0) + 1; });
    });
    const rows: Record<string, { key: string; state: string; district?: string; clicks: number; pax: number; waiting: WaitlistEntry[] }> = {};
    const keyOf = (state?: string | null, district?: string | null, searched?: string) =>
      state ? `${state}|${district || ""}` : `?|${(searched || "").toLowerCase()}`;
    const ensure = (state?: string | null, district?: string | null, searched?: string) => {
      const key = keyOf(state, district, searched);
      rows[key] ||= { key, state: state || "Unknown", district: district || (state ? undefined : searched), clicks: 0, pax: 0, waiting: [] };
      return rows[key];
    };
    clicks.forEach(c => { const r = ensure(c.state, c.district, c.searched); r.clicks++; r.pax += c.pax || 0; });
    waitlist.forEach(w => { ensure(w.state, w.district, w.searched).waiting.push(w); });
    return Object.values(rows)
      .map(r => ({ ...r, vendors: vendorsPerState[r.state] || 0 }))
      .sort((a, b) => (b.clicks + b.waiting.length) - (a.clicks + a.waiting.length));
  }, [clicks, waitlist, allVendors]);

  const list = useMemo(() => prospects
    .filter(p => stateFilter === "all" || p.state === stateFilter)
    .map(p => ({ p, s: statsFor(clicksByProspect[p.id] || []) }))
    .sort((a, b) => b.s.clicks - a.s.clicks || a.p.name.localeCompare(b.p.name)),
  [prospects, clicksByProspect, stateFilter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(p: Prospect) {
    setEditing(p);
    setForm({ name: p.name, phone: p.phone, state: p.state, district: p.district || "", areas: (p.areas || []).join(", "), status: p.status });
    setShowModal(true);
  }

  async function save() {
    const phone = normalizeMyPhone(form.phone);
    if (!form.name.trim()) return alert("Name is required");
    if (!/^60[0-9]{8,11}$/.test(phone)) return alert("Enter a valid Malaysian WhatsApp number");
    const dupe = prospects.find(p => p.phone === phone && p.id !== editing?.id);
    if (dupe) return alert(`This number is already listed as "${dupe.name}"`);
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        phone,
        state: form.state,
        district: form.district.trim() || null,
        areas: form.areas.split(",").map(a => a.trim()).filter(Boolean),
        status: form.status,
      };
      if (editing) await updateDoc(doc(db, "prospects", editing.id), data);
      else await addDoc(collection(db, "prospects"), { ...data, createdAt: serverTimestamp() });
      setShowModal(false);
      load();
    } catch (e) {
      console.error(e);
      alert("Error saving prospect");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(p: Prospect, status: ProspectStatus) {
    const extra = status === "contacted" && !p.contactedAt ? { contactedAt: serverTimestamp() } : {};
    await updateDoc(doc(db, "prospects", p.id), { status, ...extra });
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, status } : x));
  }

  async function remove(p: Prospect) {
    if (!confirm(`Delete "${p.name}"? Their past enquiry clicks stay in the log.`)) return;
    await deleteDoc(doc(db, "prospects", p.id));
    setProspects(prev => prev.filter(x => x.id !== p.id));
  }

  async function removeWaitlist(w: WaitlistEntry) {
    await deleteDoc(doc(db, "area_waitlist", w.id));
    setWaitlist(prev => prev.filter(x => x.id !== w.id));
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => prompt("Copy this:", text));
  }

  const totals = {
    prospects: prospects.length,
    clicks: clicks.length,
    waiting: waitlist.length,
    converted: prospects.filter(p => p.status === "converted" || signedUpBy[p.id]).length,
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;
  }

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Prospects", value: totals.prospects, icon: "fa-address-book" },
          { label: "Customer enquiries", value: totals.clicks, icon: "fa-whatsapp", fab: true },
          { label: "Waiting for vendor", value: totals.waiting, icon: "fa-bell" },
          { label: "Signed up", value: totals.converted, icon: "fa-user-check" },
        ].map(t => (
          <div key={t.label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              <i className={`${t.fab ? "fab" : "fas"} ${t.icon} mr-1`}></i>{t.label}
            </p>
            <p className="text-2xl font-black text-[#062c24]">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Demand by area */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-[#062c24] uppercase">Demand by area</h3>
          <p className="text-[11px] text-slate-400">Enquiries and waitlist from searches with no registered vendor. Recruit where demand is high and vendors are 0.</p>
        </div>
        {areas.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">No demand recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {areas.map(a => (
              <li key={a.key}>
                <button onClick={() => setOpenArea(openArea === a.key ? null : a.key)}
                  className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#062c24] truncate">{a.district || a.state}</p>
                    <p className="text-[10px] text-slate-400">{a.district ? a.state : "Unmatched search"}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-20 text-right">{a.clicks} enq · {a.pax} pax</span>
                  <span className="text-[10px] font-bold text-slate-500 w-16 text-right">{a.waiting.length} waiting</span>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md w-20 text-center ${a.vendors ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                    {a.vendors} vendor{a.vendors === 1 ? "" : "s"}
                  </span>
                </button>
                {openArea === a.key && a.waiting.length > 0 && (
                  <div className="px-5 pb-4 space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Waitlist — notify once a vendor is live</p>
                    {a.waiting.map(w => (
                      <div key={w.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-bold text-slate-600 flex-1">+{w.phone} <span className="text-slate-400 font-medium">· searched “{w.searched}”</span></span>
                        <a target="_blank" rel="noreferrer"
                          href={waLink(w.phone, `Hi dari Pacak Khemah. Anda minta kami beritahu bila ada vendor sewaan camping di ${a.district || w.searched}. Kini dah ada, boleh semak di pacakkhemah.com/directory`)}
                          className="text-[10px] font-black text-emerald-600 uppercase"><i className="fab fa-whatsapp mr-1"></i>Notify</a>
                        <button onClick={() => removeWaitlist(w)} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase ml-2">Done</button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Prospects */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-3">
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500">
          <option value="all">All states</option>
          {STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={openAdd}
          className="bg-[#062c24] text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-800 shadow-sm">
          <i className="fas fa-plus mr-2"></i>Add prospect
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <p className="text-xs text-slate-400">No prospects yet. Add camping rental businesses in states with no vendors.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map(({ p, s }) => {
            const signup = `${PROSPECT_SIGNUP_BASE}${p.id}`;
            const outreach = buildOutreachMessage(p, s, signup);
            const vendor = signedUpBy[p.id];
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#062c24] uppercase truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400">+{p.phone} · {p.district ? `${p.district}, ` : ""}{p.state}</p>
                  </div>
                  <select value={p.status} onChange={e => setStatus(p, e.target.value as ProspectStatus)}
                    className={`text-[9px] font-black uppercase px-2 py-1.5 rounded-lg border-0 outline-none ${STATUS_STYLE[p.status]}`}>
                    <option value="active">Active</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                  </select>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: "Enquiries", v: s.clicks },
                    { l: "Pax", v: s.pax },
                    { l: "Peak", v: s.topMonths.join(", ") || "–" },
                    { l: "Last", v: fmtDate(s.lastClick) },
                  ].map(x => (
                    <div key={x.l} className="bg-slate-50 rounded-xl py-2">
                      <p className="text-sm font-black text-[#062c24]">{x.v}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{x.l}</p>
                    </div>
                  ))}
                </div>
                {s.topItems.length > 0 && (
                  <p className="text-[10px] text-slate-500"><span className="font-bold">Asked for:</span> {s.topItems.join(", ")}</p>
                )}

                {vendor && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-emerald-700">
                      <i className="fas fa-user-check mr-1"></i>Signed up as {vendor.name || "vendor"} ({vendor.status || "pending"})
                    </p>
                    {p.status !== "converted" && (
                      <button onClick={() => setStatus(p, "converted")} className="text-[9px] font-black text-emerald-700 uppercase underline">Mark converted</button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <a href={waLink(p.phone, outreach)} target="_blank" rel="noreferrer"
                    onClick={() => { if (p.status === "active") setStatus(p, "contacted"); }}
                    className="flex-1 min-w-[140px] text-center bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2.5 rounded-xl text-[10px] font-black uppercase">
                    <i className="fab fa-whatsapp mr-1"></i>Send outreach
                  </a>
                  <button onClick={() => copy(signup, `link-${p.id}`)}
                    className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200">
                    {copied === `link-${p.id}` ? "Copied" : "Signup link"}
                  </button>
                  <button onClick={() => openEdit(p)} className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200">Edit</button>
                  <button onClick={() => remove(p)} className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#062c24]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-[#062c24] uppercase">{editing ? "Edit prospect" : "Add prospect"}</h3>
            <p className="text-[11px] text-slate-500 -mt-2">Only use the business&apos;s own public contact details. This listing is visible to customers.</p>
            {[
              { k: "name", label: "Business name", ph: "e.g. Camptastic" },
              { k: "phone", label: "WhatsApp (public business number)", ph: "e.g. 0123456789" },
            ].map(f => (
              <label key={f.k} className="block">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{f.label}</span>
                <input value={form[f.k as "name" | "phone"]} onChange={e => setForm({ ...form, [f.k]: e.target.value })} placeholder={f.ph}
                  className="mt-1 w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">State</span>
                <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value, district: "" })}
                  className="mt-1 w-full bg-slate-50 border border-slate-100 px-3 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500">
                  {STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">District</span>
                <select value={form.district} onChange={e => setForm({ ...form, district: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-100 px-3 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500">
                  <option value="">Whole state</option>
                  {districtsOf(form.state).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Other areas served (comma separated)</span>
              <input value={form.areas} onChange={e => setForm({ ...form, areas: e.target.value })} placeholder="e.g. Teluk Kemang, Lukut"
                className="mt-1 w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" />
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-500">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase bg-[#062c24] text-white disabled:opacity-50">
                {saving ? <i className="fas fa-spinner fa-spin"></i> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

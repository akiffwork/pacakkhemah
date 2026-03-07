"use client";

import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

type DeliveryZone = { name: string; fee: number };
type TimeSlot = { time: string; label: string };

type ServicesConfig = {
  delivery: {
    enabled: boolean;
    pricingType: "fixed" | "per_km" | "zones" | "quote";
    fixedFee: number;
    perKmRate: number;
    minFee: number;
    zones: DeliveryZone[];
    freeAbove: number;
    notes: string;
  };
  setup: {
    enabled: boolean;
    fee: number;
    description: string;
  };
  combo: {
    enabled: boolean;
    fee: number;
  };
  timeSlots: {
    enabled: boolean;
    slots: TimeSlot[];
  };
};

type SettingsTabProps = {
  vendorId: string;
  vendorData: {
    name?: string; phone?: string; slug?: string; city?: string;
    areas?: string[]; pickup?: string[];
    security_deposit?: number; security_deposit_type?: string;
    is_vacation?: boolean; allow_stacking?: boolean; rules?: string[];
    services?: ServicesConfig;
  };
};

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3.5 rounded-[0.85rem] text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";

const DEFAULT_SERVICES: ServicesConfig = {
  delivery: {
    enabled: false,
    pricingType: "fixed",
    fixedFee: 50,
    perKmRate: 2,
    minFee: 20,
    zones: [],
    freeAbove: 0,
    notes: "",
  },
  setup: {
    enabled: false,
    fee: 80,
    description: "Full tent setup at your campsite",
  },
  combo: {
    enabled: false,
    fee: 100,
  },
  timeSlots: {
    enabled: false,
    slots: [
      { time: "9:00 AM - 12:00 PM", label: "Morning" },
      { time: "2:00 PM - 5:00 PM", label: "Afternoon" },
      { time: "5:00 PM - 8:00 PM", label: "Evening" },
    ],
  },
};

export default function SettingsTab({ vendorId, vendorData }: SettingsTabProps) {
  // Account fields
  const [name, setName] = useState(vendorData.name || "");
  const [phone, setPhone] = useState(vendorData.phone || "");
  const [slug, setSlug] = useState(vendorData.slug || "");

  // Logistics fields
  const [city, setCity] = useState(vendorData.city || "");
  const [areas, setAreas] = useState((vendorData.areas || []).join(", "));
  const [hubs, setHubs] = useState((vendorData.pickup || []).join(", "));
  const [depositVal, setDepositVal] = useState(String(vendorData.security_deposit || 50));
  const [depositType, setDepositType] = useState(vendorData.security_deposit_type || "fixed");
  const [isVacation, setIsVacation] = useState(vendorData.is_vacation || false);
  const [allowStacking, setAllowStacking] = useState(vendorData.allow_stacking || false);
  const [rules, setRules] = useState<string[]>(vendorData.rules || []);

  // Services fields
  const [services, setServices] = useState<ServicesConfig>(vendorData.services || DEFAULT_SERVICES);
  const [newZone, setNewZone] = useState({ name: "", fee: 0 });

  // Save states
  const [savedAccount, setSavedAccount] = useState(false);
  const [savedLogistics, setSavedLogistics] = useState(false);
  const [savedServices, setSavedServices] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Active section for mobile
  const [activeSection, setActiveSection] = useState<"account" | "logistics" | "services">("account");

  async function saveAccount() {
    if (!name || !phone) return alert("Shop Name and Phone are required.");
    const cleanSlug = slug.trim().toLowerCase().replace(/ /g, "-");
    await updateDoc(doc(db, "vendors", vendorId), { name, phone, slug: cleanSlug });
    setSavedAccount(true);
    setTimeout(() => setSavedAccount(false), 2000);
  }

  async function saveLogistics() {
    await updateDoc(doc(db, "vendors", vendorId), {
      city,
      areas: areas.split(",").map(s => s.trim()).filter(Boolean),
      pickup: hubs.split(",").map(s => s.trim()).filter(Boolean),
      security_deposit: Number(depositVal),
      security_deposit_type: depositType,
      rules: rules.filter(Boolean),
      is_vacation: isVacation,
      allow_stacking: allowStacking,
    });
    setSavedLogistics(true);
    setTimeout(() => setSavedLogistics(false), 2000);
  }

  async function saveServices() {
    await updateDoc(doc(db, "vendors", vendorId), { services });
    setSavedServices(true);
    setTimeout(() => setSavedServices(false), 2000);
  }

  async function sendPasswordReset() {
    const email = auth.currentUser?.email;
    if (!email) return;
    await sendPasswordResetEmail(auth, email);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 3000);
  }

  async function deleteAccount() {
    if (!confirm("CRITICAL WARNING: This will permanently delete your shop data. Continue?")) return;
    const check = prompt("Type 'DELETE' to confirm:");
    if (check !== "DELETE") return;
    try {
      await updateDoc(doc(db, "vendors", vendorId), { deleted: true });
      await auth.currentUser?.delete();
      window.location.href = "/";
    } catch {
      alert("Error deleting. Try re-logging in first.");
    }
  }

  function loadDefaultRules() {
    setRules([
      "Security Deposit is fully refundable within 24 hours of return, provided items are damage-free.",
      "All equipment must be returned clean, dry, and packed as received.",
      "Strictly NO SMOKING inside tents or near fabric gear. Burn marks will incur full replacement cost.",
      "No pets allowed on rental equipment.",
      "Late returns are charged at RM 20 per hour delay.",
      "Do not exceed the stated capacity for tents/furniture.",
      "Renter is liable for the full replacement value of any lost or irreparably damaged items.",
      "Vendor is not liable for accidents/injuries during equipment use.",
    ]);
  }

  function updateServices(path: string, value: any) {
    setServices(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  }

  function addZone() {
    if (!newZone.name) return;
    updateServices("delivery.zones", [...services.delivery.zones, newZone]);
    setNewZone({ name: "", fee: 0 });
  }

  function removeZone(idx: number) {
    updateServices("delivery.zones", services.delivery.zones.filter((_, i) => i !== idx));
  }

  function addTimeSlot() {
    updateServices("timeSlots.slots", [...services.timeSlots.slots, { time: "", label: "" }]);
  }

  function updateTimeSlot(idx: number, field: string, value: string) {
    const updated = [...services.timeSlots.slots];
    updated[idx] = { ...updated[idx], [field]: value };
    updateServices("timeSlots.slots", updated);
  }

  function removeTimeSlot(idx: number) {
    updateServices("timeSlots.slots", services.timeSlots.slots.filter((_, i) => i !== idx));
  }

  const sectionTabs = [
    { id: "account", label: "Account", icon: "fa-user" },
    { id: "logistics", label: "Logistics", icon: "fa-truck" },
    { id: "services", label: "Delivery & Setup", icon: "fa-concierge-bell" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {sectionTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all ${
              activeSection === tab.id
                ? "bg-[#062c24] text-white shadow-lg"
                : "bg-white text-slate-500 border border-slate-100 hover:border-emerald-300"
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account & Profile */}
      {activeSection === "account" && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">Account & Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Email</label>
              <input readOnly value={auth.currentUser?.email || ""} className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Shop Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">WhatsApp Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="601XXXXXXXX" className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">
                Shop URL Slug
                <span className="text-emerald-500 ml-1 normal-case font-medium">/shop/{slug || "your-slug"}</span>
              </label>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/ /g, "-"))} placeholder="your-shop-name" className={inputCls} />
            </div>
            <button onClick={saveAccount}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${savedAccount ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
              {savedAccount ? "✓ Account Saved!" : "Save Account"}
            </button>
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <button onClick={sendPasswordReset}
                className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] transition-all border ${resetSent ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200"}`}>
                {resetSent ? "✓ Reset Link Sent!" : "Send Password Reset Email"}
              </button>
              <button onClick={deleteAccount}
                className="w-full py-3 rounded-2xl font-black uppercase text-[10px] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100">
                Delete Account & Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logistics & Rules */}
      {activeSection === "logistics" && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">Logistics & Rules</h3>
          <div className="space-y-4">
            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-4 rounded-2xl border cursor-pointer transition-all ${isVacation ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}
                onClick={() => setIsVacation(!isVacation)}>
                <div className="flex justify-between items-center mb-1">
                  <i className={`fas fa-umbrella-beach text-sm ${isVacation ? "text-blue-500" : "text-slate-300"}`}></i>
                  <input type="checkbox" checked={isVacation} onChange={() => {}} className="w-4 h-4 accent-blue-500" />
                </div>
                <p className="text-[9px] font-black uppercase text-left">Vacation Mode</p>
                <p className="text-[8px] text-slate-400">Temporarily close shop</p>
              </div>
              <div className={`p-4 rounded-2xl border cursor-pointer transition-all ${allowStacking ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}
                onClick={() => setAllowStacking(!allowStacking)}>
                <div className="flex justify-between items-center mb-1">
                  <i className={`fas fa-layer-group text-sm ${allowStacking ? "text-emerald-500" : "text-slate-300"}`}></i>
                  <input type="checkbox" checked={allowStacking} onChange={() => {}} className="w-4 h-4 accent-emerald-500" />
                </div>
                <p className="text-[9px] font-black uppercase text-left">Stack Discounts</p>
                <p className="text-[8px] text-slate-400">Combine all offers</p>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Main City</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kuantan" className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Service Areas (comma separated)</label>
              <input value={areas} onChange={e => setAreas(e.target.value)} placeholder="Kuantan, Kemaman, Kuala Lumpur" className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Pickup Points (comma separated)</label>
              <input value={hubs} onChange={e => setHubs(e.target.value)} placeholder="Hub A, Hub B" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Security Deposit</label>
                <input type="number" value={depositVal} onChange={e => setDepositVal(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Type</label>
                <select value={depositType} onChange={e => setDepositType(e.target.value)} className={inputCls}>
                  <option value="fixed">Fixed (RM)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
            </div>

            {/* Rules */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Rental Rules</label>
                <button onClick={loadDefaultRules} className="text-[8px] font-bold text-emerald-600 hover:underline">Load Defaults</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
                {rules.map((rule, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={rule} onChange={e => setRules(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300" />
                    <button onClick={() => setRules(prev => prev.filter((_, j) => j !== i))} className="text-red-400 px-3 hover:bg-red-50 rounded-xl">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setRules(prev => [...prev, ""])} className="mt-2 text-[9px] font-bold text-emerald-600 hover:underline">+ Add Rule</button>
            </div>

            <button onClick={saveLogistics}
              className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${savedLogistics ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
              {savedLogistics ? "✓ Settings Saved!" : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Delivery & Setup Services */}
      {activeSection === "services" && (
        <div className="space-y-4">
          {/* Delivery Service */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <i className="fas fa-truck"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#062c24] uppercase">Delivery Service</h3>
                  <p className="text-[9px] text-slate-400">Deliver gear to customer's campsite</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={services.delivery.enabled} onChange={e => updateServices("delivery.enabled", e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {services.delivery.enabled && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                {/* Pricing Type */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Pricing Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "fixed", label: "Fixed Fee", icon: "fa-tag" },
                      { value: "per_km", label: "Per KM", icon: "fa-road" },
                      { value: "zones", label: "Zone-based", icon: "fa-map-marked-alt" },
                      { value: "quote", label: "Quote via WhatsApp", icon: "fa-comments" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateServices("delivery.pricingType", opt.value)}
                        className={`p-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${
                          services.delivery.pricingType === opt.value
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <i className={`fas ${opt.icon}`}></i>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fixed Fee */}
                {services.delivery.pricingType === "fixed" && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Fixed Delivery Fee (RM)</label>
                    <input type="number" value={services.delivery.fixedFee} onChange={e => updateServices("delivery.fixedFee", Number(e.target.value))} className={inputCls} />
                  </div>
                )}

                {/* Per KM */}
                {services.delivery.pricingType === "per_km" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Rate per KM (RM)</label>
                      <input type="number" value={services.delivery.perKmRate} onChange={e => updateServices("delivery.perKmRate", Number(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Minimum Fee (RM)</label>
                      <input type="number" value={services.delivery.minFee} onChange={e => updateServices("delivery.minFee", Number(e.target.value))} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Zones */}
                {services.delivery.pricingType === "zones" && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Delivery Zones</label>
                    <div className="space-y-2 mb-3">
                      {services.delivery.zones.map((zone, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl">
                          <span className="flex-1 text-xs font-bold text-[#062c24]">{zone.name}</span>
                          <span className="text-xs font-bold text-emerald-600">RM {zone.fee}</span>
                          <button onClick={() => removeZone(i)} className="text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Zone name" value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })}
                        className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm outline-none" />
                      <input type="number" placeholder="Fee" value={newZone.fee || ""} onChange={e => setNewZone({ ...newZone, fee: Number(e.target.value) })}
                        className="w-20 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm outline-none" />
                      <button onClick={addZone} className="bg-emerald-500 text-white px-4 rounded-xl text-xs font-bold">Add</button>
                    </div>
                  </div>
                )}

                {/* Quote message */}
                {services.delivery.pricingType === "quote" && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                    <p className="text-xs text-amber-700 font-bold"><i className="fas fa-info-circle mr-2"></i>Delivery fee will be discussed and confirmed via WhatsApp</p>
                  </div>
                )}

                {/* Free delivery threshold */}
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Free Delivery Above (RM) - 0 to disable</label>
                  <input type="number" value={services.delivery.freeAbove} onChange={e => updateServices("delivery.freeAbove", Number(e.target.value))} className={inputCls} />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Delivery Notes (shown to customer)</label>
                  <input value={services.delivery.notes} onChange={e => updateServices("delivery.notes", e.target.value)} placeholder="e.g. Available within Pahang only" className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* Setup Service */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <i className="fas fa-campground"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#062c24] uppercase">Setup Service</h3>
                  <p className="text-[9px] text-slate-400">Set up tents/gear at campsite</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={services.setup.enabled} onChange={e => updateServices("setup.enabled", e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            {services.setup.enabled && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                  <p className="text-xs text-blue-700 font-bold"><i className="fas fa-lightbulb mr-2"></i>Tip: You can also set per-item setup fees in Inventory for specific items like large tents</p>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Default Setup Fee (RM)</label>
                  <input type="number" value={services.setup.fee} onChange={e => updateServices("setup.fee", Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                  <input value={services.setup.description} onChange={e => updateServices("setup.description", e.target.value)} placeholder="e.g. Full tent pitching including groundsheet" className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* Bundle Discount */}
          {services.delivery.enabled && services.setup.enabled && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-gift"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#062c24] uppercase">Bundle Discount</h3>
                    <p className="text-[9px] text-slate-400">Discounted price for Delivery + Setup</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={services.combo.enabled} onChange={e => updateServices("combo.enabled", e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {services.combo.enabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Combo Price (RM)</label>
                    <input type="number" value={services.combo.fee} onChange={e => updateServices("combo.fee", Number(e.target.value))} className={inputCls} />
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <p className="text-xs font-bold text-emerald-700">
                      Customer saves RM {(services.delivery.fixedFee || 0) + (services.setup.fee || 0) - services.combo.fee}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Slots */}
          {services.delivery.enabled && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#062c24] uppercase">Time Slots</h3>
                    <p className="text-[9px] text-slate-400">Available delivery time windows</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={services.timeSlots.enabled} onChange={e => updateServices("timeSlots.enabled", e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              {services.timeSlots.enabled && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {services.timeSlots.slots.map((slot, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={slot.label} onChange={e => updateTimeSlot(i, "label", e.target.value)} placeholder="Label" className="w-1/3 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm outline-none" />
                      <input value={slot.time} onChange={e => updateTimeSlot(i, "time", e.target.value)} placeholder="Time range" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm outline-none" />
                      <button onClick={() => removeTimeSlot(i)} className="text-red-400 hover:text-red-600 px-2"><i className="fas fa-times"></i></button>
                    </div>
                  ))}
                  <button onClick={addTimeSlot} className="text-[10px] font-bold text-emerald-600 hover:underline">+ Add Time Slot</button>
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <button onClick={saveServices}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${savedServices ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
            {savedServices ? "✓ Services Saved!" : "Save Services Settings"}
          </button>
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
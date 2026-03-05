"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

type SiteSettings = {
  siteName: string;
  tagline: string;
  contactEmail: string;
  contactWhatsApp: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

type SocialLinks = {
  instagram: string;
  tiktok: string;
  facebook: string;
  threads: string;
  whatsapp: string;
};

type AdminEmails = string[];

type DefaultPolicies = {
  securityDeposit: number;
  securityDepositType: "fixed" | "percentage";
  cancellationHours: number;
  damagePolicy: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Pacak Khemah",
  tagline: "Pacak. Rehat. Ulang.",
  contactEmail: "hello@pacakkhemah.com",
  contactWhatsApp: "60123456789",
  maintenanceMode: false,
  maintenanceMessage: "We're currently performing maintenance. Please check back soon!",
};

const DEFAULT_SOCIAL: SocialLinks = {
  instagram: "",
  tiktok: "",
  facebook: "",
  threads: "",
  whatsapp: "",
};

const DEFAULT_POLICIES: DefaultPolicies = {
  securityDeposit: 50,
  securityDepositType: "fixed",
  cancellationHours: 48,
  damagePolicy: "Customer is responsible for any damage or loss of equipment during the rental period.",
};

export default function AdminSettingsTab() {
  const [activeSection, setActiveSection] = useState<"site" | "social" | "admins" | "policies" | "danger">("site");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [social, setSocial] = useState<SocialLinks>(DEFAULT_SOCIAL);
  const [admins, setAdmins] = useState<AdminEmails>(["akiff.work@gmail.com"]);
  const [policies, setPolicies] = useState<DefaultPolicies>(DEFAULT_POLICIES);
  const [newAdmin, setNewAdmin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [siteSnap, socialSnap, adminsSnap, policiesSnap] = await Promise.all([
        getDoc(doc(db, "settings", "site")),
        getDoc(doc(db, "settings", "social_links")),
        getDoc(doc(db, "settings", "admin_emails")),
        getDoc(doc(db, "settings", "default_policies")),
      ]);
      
      if (siteSnap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...siteSnap.data() });
      if (socialSnap.exists()) setSocial({ ...DEFAULT_SOCIAL, ...socialSnap.data() });
      if (adminsSnap.exists() && adminsSnap.data().emails) setAdmins(adminsSnap.data().emails);
      if (policiesSnap.exists()) setPolicies({ ...DEFAULT_POLICIES, ...policiesSnap.data() });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all([
        setDoc(doc(db, "settings", "site"), settings),
        setDoc(doc(db, "settings", "social_links"), social),
        setDoc(doc(db, "settings", "admin_emails"), { emails: admins }),
        setDoc(doc(db, "settings", "default_policies"), policies),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function addAdmin() {
    if (!newAdmin || !newAdmin.includes("@")) return alert("Enter a valid email");
    if (admins.includes(newAdmin.toLowerCase())) return alert("Email already added");
    setAdmins([...admins, newAdmin.toLowerCase()]);
    setNewAdmin("");
  }

  function removeAdmin(email: string) {
    if (admins.length <= 1) return alert("Must have at least one admin");
    setAdmins(admins.filter(a => a !== email));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
      </div>
    );
  }

  const sections = [
    { id: "site", label: "Site Info", icon: "fa-globe" },
    { id: "social", label: "Social Links", icon: "fa-share-nodes" },
    { id: "admins", label: "Admin Access", icon: "fa-user-shield" },
    { id: "policies", label: "Default Policies", icon: "fa-file-contract" },
    { id: "danger", label: "Danger Zone", icon: "fa-exclamation-triangle" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeSection === sec.id
                ? sec.id === "danger" ? "bg-red-500 text-white" : "bg-[#062c24] text-white"
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className={`fas ${sec.icon}`}></i>
            {sec.label}
          </button>
        ))}
      </div>

      {/* Site Info */}
      {activeSection === "site" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Basic Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Site Name</label>
                <input
                  value={settings.siteName}
                  onChange={e => setSettings({ ...settings, siteName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Tagline</label>
                <input
                  value={settings.tagline}
                  onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Contact Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">WhatsApp Number</label>
                <input
                  value={settings.contactWhatsApp}
                  onChange={e => setSettings({ ...settings, contactWhatsApp: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  placeholder="60123456789"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[#062c24] uppercase">Maintenance Mode</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
            {settings.maintenanceMode && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                <p className="text-xs text-red-600 font-bold mb-3">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Site is currently in maintenance mode!
                </p>
                <textarea
                  value={settings.maintenanceMessage}
                  onChange={e => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  className="w-full bg-white border border-red-200 p-3 rounded-xl text-sm outline-none resize-none"
                  rows={2}
                  placeholder="Maintenance message..."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Social Links */}
      {activeSection === "social" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Social Media Links</h3>
          <div className="space-y-4">
            {[
              { key: "instagram", label: "Instagram", icon: "fa-instagram", placeholder: "https://instagram.com/yourpage" },
              { key: "tiktok", label: "TikTok", icon: "fa-tiktok", placeholder: "https://tiktok.com/@yourpage" },
              { key: "facebook", label: "Facebook", icon: "fa-facebook", placeholder: "https://facebook.com/yourpage" },
              { key: "threads", label: "Threads", icon: "fa-threads", placeholder: "https://threads.net/@yourpage" },
              { key: "whatsapp", label: "WhatsApp Channel", icon: "fa-whatsapp", placeholder: "https://wa.me/60123456789" },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                  <i className={`fab ${s.icon}`}></i>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{s.label}</label>
                  <input
                    value={social[s.key as keyof SocialLinks]}
                    onChange={e => setSocial({ ...social, [s.key]: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm outline-none"
                    placeholder={s.placeholder}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Access */}
      {activeSection === "admins" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Admin Email Access</h3>
          <p className="text-xs text-slate-500 mb-4">Only these email addresses can access the admin panel.</p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={newAdmin}
              onChange={e => setNewAdmin(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
              placeholder="Enter email address..."
              onKeyDown={e => e.key === "Enter" && addAdmin()}
            />
            <button
              onClick={addAdmin}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 rounded-xl text-xs font-bold"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>

          <div className="space-y-2">
            {admins.map((email, i) => (
              <div key={email} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-black">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-[#062c24]">{email}</span>
                  {i === 0 && <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">Primary</span>}
                </div>
                <button
                  onClick={() => removeAdmin(email)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  disabled={admins.length <= 1}
                >
                  <i className="fas fa-trash text-xs"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default Policies */}
      {activeSection === "policies" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Default Rental Policies</h3>
            <p className="text-xs text-slate-500 mb-4">These defaults apply to new vendors. Vendors can customize their own policies.</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Security Deposit</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={policies.securityDeposit}
                    onChange={e => setPolicies({ ...policies, securityDeposit: Number(e.target.value) })}
                    className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                  />
                  <select
                    value={policies.securityDepositType}
                    onChange={e => setPolicies({ ...policies, securityDepositType: e.target.value as "fixed" | "percentage" })}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="fixed">RM (Fixed)</option>
                    <option value="percentage">% of Total</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Cancellation Notice (Hours)</label>
                <input
                  type="number"
                  value={policies.cancellationHours}
                  onChange={e => setPolicies({ ...policies, cancellationHours: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Default Damage Policy</label>
              <textarea
                value={policies.damagePolicy}
                onChange={e => setPolicies({ ...policies, damagePolicy: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {activeSection === "danger" && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
          <h3 className="text-sm font-black text-red-600 uppercase mb-4">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Danger Zone
          </h3>
          <p className="text-xs text-red-600 mb-6">These actions are irreversible. Please be careful.</p>
          
          <div className="space-y-4">
            <div className="bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#062c24]">Export All Data</p>
                <p className="text-xs text-slate-500">Download all vendors, transactions, and settings as JSON</p>
              </div>
              <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold">
                <i className="fas fa-download mr-2"></i>Export
              </button>
            </div>
            
            <div className="bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#062c24]">Clear All Transactions</p>
                <p className="text-xs text-slate-500">Delete all transaction history (cannot be undone)</p>
              </div>
              <button className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold">
                <i className="fas fa-trash mr-2"></i>Clear
              </button>
            </div>
            
            <div className="bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#062c24]">Reset All Settings</p>
                <p className="text-xs text-slate-500">Reset all settings to default values</p>
              </div>
              <button className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold">
                <i className="fas fa-rotate-left mr-2"></i>Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={saveAll}
          disabled={saving}
          className={`px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${
            saved ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"
          } disabled:opacity-50`}
        >
          {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : saved ? "✓ Saved!" : "Save All Settings"}
        </button>
      </div>
    </div>
  );
}
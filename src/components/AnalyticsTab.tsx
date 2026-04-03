"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, updateDoc, increment,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

type AnalyticsTabProps = {
  vendorId: string;
  vendorData: { name: string; credits?: number; slug?: string };
};

type Lead = {
  id: string;
  totalAmount: number;
  timestamp?: any;
  type?: string;
  visitorId?: string;
  isRepeatVisitor?: boolean;
};

type PaymentPackage = { credits: number; price: number };
type PaymentConfig = {
  packages?: PaymentPackage[];
  secretKey?: string;
  categoryCode?: string;
  isSandbox?: boolean;
};

const INFO = {
  leads: { title: "Lead Credits", text: "Credits are deducted when a unique customer clicks to WhatsApp you. Balance is updated in real-time." },
  analytics: { title: "Recent Activity", text: "Summary of incoming leads and estimated booking values." },
};

export default function AnalyticsTab({ vendorId, vendorData }: AnalyticsTabProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [credits, setCredits] = useState(vendorData.credits ?? 0);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showInfo, setShowInfo] = useState<null | keyof typeof INFO>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  // Real-time analytics listener
  useEffect(() => {
    const q = query(
      collection(db, "analytics"),
      where("vendorId", "==", vendorId),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  // Real-time credit balance listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "vendors", vendorId), (snap) => {
      if (snap.exists()) setCredits(snap.data().credits ?? 0);
    });
    return () => unsub();
  }, [vendorId]);

  // Load payment config
  useEffect(() => {
    getDoc(doc(db, "settings", "payment_config")).then(snap => {
      if (snap.exists()) setPaymentConfig(snap.data() as PaymentConfig);
    });
  }, []);

  // Handle payment return (credit verification)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status_id") === "1" && params.has("add_credits")) {
      const toAdd = parseInt(params.get("add_credits")!);
      updateDoc(doc(db, "vendors", vendorId), { credits: increment(toAdd) })
        .then(() => {
          alert(`Added ${toAdd} Credits!`);
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, [vendorId]);

  async function payCredits(credits: number, price: number) {
    if (!paymentConfig) return alert("Payment config not loaded.");
    const auth = getAuth();
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("add_credits", String(credits));

    const url = paymentConfig.isSandbox
      ? "https://dev.toyyibpay.com/index.php/api/createBill"
      : "https://toyyibpay.com/index.php/api/createBill";

    const formData = new FormData();
    formData.append("userSecretKey", paymentConfig.secretKey || "");
    formData.append("categoryCode", paymentConfig.categoryCode || "");
    formData.append("billName", `TopUp: ${credits} Credits`);
    formData.append("billDescription", "Lead Credits Top Up");
    formData.append("billPriceSetting", "1");
    formData.append("billPayorInfo", "1");
    formData.append("billAmount", String(price * 100));
    formData.append("billReturnUrl", returnUrl.toString());
    formData.append("billCallbackUrl", returnUrl.toString());
    formData.append("billTo", vendorData.name);
    formData.append("billEmail", auth.currentUser?.email || "");
    formData.append("billPhone", "0123456789");

    try {
      const response = await fetch(url, { method: "POST", body: formData });
      const data = await response.json();
      if (data?.[0]?.BillCode) {
        window.location.href = (paymentConfig.isSandbox
          ? "https://dev.toyyibpay.com/"
          : "https://toyyibpay.com/") + data[0].BillCode;
      }
    } catch { alert("Payment Gateway Error"); }
  }

  const defaultPackages: PaymentPackage[] = [
    { credits: 10, price: 10 },
    { credits: 50, price: 45 },
    { credits: 100, price: 80 },
  ];
  const packages = paymentConfig?.packages || defaultPackages;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Credit Card */}
        <div className="md:col-span-1 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden flex flex-col justify-between group hover:shadow-2xl transition-all"
          style={{ background: "linear-gradient(135deg, #062c24 0%, #047857 100%)" }}>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                Lead Wallet
                <i className="fas fa-info-circle cursor-pointer text-white/50 hover:text-white"
                  onClick={() => setShowInfo("leads")}></i>
              </p>
            </div>
            <h3 className="text-6xl font-black tracking-tighter mb-2">{credits}</h3>
            <p className="text-[10px] text-emerald-100/70 font-medium bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-md">
              1 Credit = 1 Customer Lead
            </p>
          </div>
          <button onClick={() => setShowTopUp(true)}
            className="relative z-10 w-full bg-white text-[#062c24] py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-50 transition-all shadow-lg mt-8 flex items-center justify-center gap-2">
            <i className="fas fa-bolt text-yellow-500"></i> Top Up Credits
          </button>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all"></div>
        </div>

        {/* Recent Activity */}
        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-[#062c24] uppercase flex items-center gap-2">
              Recent Activity
              <i className="fas fa-info-circle text-slate-300 text-sm cursor-pointer hover:text-emerald-500"
                onClick={() => setShowInfo("analytics")}></i>
            </h3>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-2" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              <div className="text-center py-12"><i className="fas fa-spinner fa-spin text-slate-200 text-2xl"></i></div>
            ) : leads.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[10px] font-bold uppercase">No recent activity</div>
            ) : leads.map(lead => (
              <div key={lead.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    lead.isRepeatVisitor ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                  }`}>
                    <i className={lead.isRepeatVisitor ? "fas fa-redo-alt" : "fab fa-whatsapp"}></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#062c24]">
                      {lead.isRepeatVisitor ? "Repeat Lead" : "New Lead"}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">
                      {lead.timestamp?.toDate().toLocaleDateString() || "Now"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  RM {lead.totalAmount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl">
            <button onClick={() => setShowTopUp(false)}
              className="absolute top-6 right-6 w-8 h-8 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 flex items-center justify-center">
              <i className="fas fa-times"></i>
            </button>
            <div className="inline-block bg-yellow-100 text-yellow-700 p-3 rounded-2xl mb-4 text-2xl shadow-inner">
              <i className="fas fa-bolt"></i>
            </div>
            <h3 className="text-2xl font-black text-[#062c24] uppercase mb-1">Power Up Your Shop</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Secure instant lead credits</p>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {packages.map(pkg => (
                <button key={pkg.credits} onClick={() => payCredits(pkg.credits, pkg.price)}
                  className="relative bg-slate-50 border border-slate-100 hover:border-emerald-500 hover:shadow-lg p-4 rounded-2xl flex justify-between items-center group transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs group-hover:scale-110 transition-transform">
                      {pkg.credits}
                    </div>
                    <span className="font-black text-[#062c24] text-sm uppercase">Credits</span>
                  </div>
                  <span className="bg-white px-4 py-2 rounded-xl text-xs font-black text-emerald-600 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    RM {pkg.price}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-[8px] font-bold text-slate-300 uppercase">
              <i className="fas fa-lock"></i> Secured by ToyyibPay
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[700] flex items-center justify-center p-6"
          onClick={() => setShowInfo(null)}>
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl relative"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowInfo(null)}
              className="absolute top-6 right-6 w-8 h-8 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 flex items-center justify-center">
              <i className="fas fa-times"></i>
            </button>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl mb-4">
              <i className="fas fa-info"></i>
            </div>
            <h3 className="text-xl font-black text-[#062c24] uppercase mb-3">{INFO[showInfo].title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">{INFO[showInfo].text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
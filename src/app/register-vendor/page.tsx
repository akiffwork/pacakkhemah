"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, sendEmailVerification, User,
} from "firebase/auth";

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-400" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

export default function RegisterVendorPage() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [displayEmail, setDisplayEmail] = useState("");
  const [startingCredits, setStartingCredits] = useState(10);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "settings", "payment_config")).then(snap => {
      if (snap.exists()) setStartingCredits(snap.data().startingCredits || 10);
    });
  }, []);

  async function createVendorShell(user: User) {
    await setDoc(doc(db, "vendors", user.uid), {
      owner_uid: user.uid,
      name: user.displayName || "New Vendor",
      email: user.email,
      phone: user.phoneNumber || "",
      image: user.photoURL || "",
      status: "pending",
      credits: startingCredits,
      joinedAt: serverTimestamp(),
      setup_complete: false,
      security_deposit: 50,
    });
  }

  async function handleEmailReg() {
    setError("");
    if (!email || password.length < 6) {
      setError("Valid email & password (min 6 chars) required.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createVendorShell(cred.user);
      await sendEmailVerification(cred.user);
      setDisplayEmail(email);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleReg() {
    setError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;
      const docSnap = await getDoc(doc(db, "vendors", user.uid));
      if (!docSnap.exists()) {
        await createVendorShell(user);
        alert("Account created! Please wait for admin approval to activate your shop.");
      }
      window.location.href = "/store";
    } catch (e: any) {
      setError(e.message);
      setGoogleLoading(false);
    }
  }

  const strength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#062c24]"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Close button */}
        <Link href="/directory" className="absolute top-6 right-8 text-slate-300 hover:text-red-500 transition-colors z-50">
          <i className="fas fa-times text-xl"></i>
        </Link>

        {!success ? (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-black text-[#062c24] uppercase mb-2">Create Account</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start your rental business</p>
            </div>

            <div className="space-y-4">
              {/* Google Sign Up */}
              <button onClick={handleGoogleReg} disabled={!termsAccepted || googleLoading}
                className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100">
                {googleLoading
                  ? <i className="fas fa-spinner fa-spin"></i>
                  : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />}
                Sign up with Google
              </button>

              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <span className="relative bg-white px-2 text-[9px] text-slate-300 uppercase font-bold">Or Use Email</span>
              </div>

              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email Address" disabled={!termsAccepted}
                className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />

              {/* Password + strength bar */}
              <div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password (Min 6 chars)" disabled={!termsAccepted}
                  className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />
                {password.length > 0 && (
                  <div className="mt-2 px-1">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-slate-200"}`} />
                      ))}
                    </div>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${
                      strength.label === "Weak" ? "text-red-400" :
                      strength.label === "Fair" ? "text-amber-400" :
                      strength.label === "Good" ? "text-blue-400" : "text-emerald-500"
                    }`}>{strength.label} Password</p>
                  </div>
                )}
              </div>

              {/* Terms Box */}
              <div onClick={() => setShowTerms(true)}
                className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center relative overflow-hidden group hover:border-amber-300 transition-colors cursor-pointer">
                <div className="absolute -right-4 -top-4 w-12 h-12 bg-amber-100 rounded-full blur-xl group-hover:bg-amber-200 transition-all"></div>
                <i className="fas fa-file-contract text-amber-500 text-xl mb-2 block"></i>
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Service Agreement</p>
                <p className="text-[9px] text-amber-700/70 font-medium">Read & Accept to Unlock</p>
                {termsAccepted && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                    <i className="fas fa-check-circle text-emerald-500 text-xs"></i>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Accepted</span>
                  </div>
                )}
              </div>

              {error && <p className="text-red-500 text-[10px] font-bold text-center">{error}</p>}

              <button onClick={handleEmailReg} disabled={!termsAccepted || loading}
                className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : "Create Account"}
              </button>

              <p className="text-center text-[10px] text-slate-400 font-medium mt-4">
                Already have an account?{" "}
                <Link href="/store" className="text-emerald-600 font-bold hover:underline">Log In</Link>
              </p>
            </div>
          </>
        ) : (
          <div className="text-center space-y-6 py-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <i className="fas fa-envelope text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#062c24]">Verify Your Email</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                We sent a verification link to{" "}
                <span className="font-bold text-[#062c24]">{displayEmail}</span>.
              </p>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl text-[10px] text-amber-800 font-medium border border-amber-100">
              <div className="flex items-center justify-center gap-2 mb-1 text-amber-600 font-bold uppercase">
                <i className="fas fa-exclamation-circle"></i> Important
              </div>
              Don&apos;t see the email? Check your <span className="font-black">Spam</span> or{" "}
              <span className="font-black">Junk</span> folder.
            </div>
            <Link href="/store"
              className="block w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">
              Go to Login
            </Link>
          </div>
        )}
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-black text-[#062c24] uppercase">Service Agreement</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Please read carefully</p>
            </div>
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-600 leading-relaxed font-medium">
              {[
                { num: "1", color: "emerald", title: "Performance-Based Model", text: "You acknowledge that Pacak Khemah operates on a Pay-Per-Result basis. There are no monthly subscription fees. You strictly use Credits to receive actionable customer leads." },
                { num: "2", color: "emerald", title: 'The "Intent" Charge', text: 'One (1) Credit is deducted from your wallet only when a customer clicks "WhatsApp Owner" or "Book Now". Listing your gear and receiving page views is completely free.' },
                { num: "3", color: "emerald", title: "Fairness Guarantee", text: "We employ Session Fingerprinting to protect your wallet. If the same customer clicks your link multiple times within 24 hours, you are charged only once." },
                { num: "4", color: "emerald", title: "Active Status Rule", text: "Your shop listing remains active as long as your Credit Balance is positive (>0). If your wallet hits zero, your listing is automatically paused." },
                { num: "5", color: "red", title: "No Refunds on Unused Credits", text: "All Credit top-ups are final and non-refundable. Credits act as a prepaid service fee for lead generation. Any remaining balance is forfeited if you close your store or violate policies." },
              ].map(item => (
                <div key={item.num} className="flex gap-4">
                  <span className={`shrink-0 w-8 h-8 bg-${item.color}-100 text-${item.color}-${item.color === "red" ? "500" : "600"} rounded-lg flex items-center justify-center font-black text-[10px]`}>
                    {item.num}
                  </span>
                  <div>
                    <h4 className={`font-black uppercase mb-1 ${item.color === "red" ? "text-red-600" : "text-[#062c24]"}`}>{item.title}</h4>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-emerald-800 font-bold text-center">By continuing, you agree to these terms including the No-Refund policy.</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex gap-3">
              <button onClick={() => setShowTerms(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }}
                className="flex-[2] py-4 bg-[#062c24] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg transition-all">
                I Accept & Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
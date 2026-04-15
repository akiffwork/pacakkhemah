"use client";

import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// OFFLINE INDICATOR
// Shows a banner when user loses internet connection
// ═══════════════════════════════════════════════════════════

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    function handleOffline() { setOffline(true); setWasOffline(true); }
    function handleOnline() {
      setOffline(false);
      // Show "back online" briefly
      setTimeout(() => setWasOffline(false), 3000);
    }

    // Check initial state
    if (!navigator.onLine) { setOffline(true); setWasOffline(true); }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline && !wasOffline) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[999] transition-all duration-300 ${
      offline
        ? "bg-red-500 text-white"
        : "bg-emerald-500 text-white"
    }`}>
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
        {offline ? (
          <>
            <i className="fas fa-wifi-slash text-xs"></i>
            Tiada sambungan internet
          </>
        ) : (
          <>
            <i className="fas fa-check-circle text-xs"></i>
            Kembali dalam talian
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INSTALL PWA PROMPT
// Shows "Add to Home Screen" banner on mobile
// ═══════════════════════════════════════════════════════════

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already dismissed recently
    const lastDismissed = localStorage.getItem("pk_install_dismissed");
    if (lastDismissed && Date.now() - Number(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("pk_install_dismissed", String(Date.now()));
  }

  if (installed || dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[80] animate-[slideUp_0.3s_ease-out]">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <img src="/pacak-khemah.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-[#062c24]">Add Pacak Khemah</p>
          <p className="text-[9px] text-slate-400">Install app untuk akses pantas</p>
        </div>
        <button onClick={handleInstall}
          className="bg-[#062c24] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shrink-0 hover:bg-emerald-800 transition-colors">
          Install
        </button>
        <button onClick={handleDismiss} className="text-slate-300 hover:text-slate-500 shrink-0">
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
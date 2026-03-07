"use client";

import { useState } from "react";

type FloatingWhatsAppProps = {
  phoneNumber?: string; // Admin WhatsApp number
  message?: string; // Pre-filled message
  position?: "left" | "right";
};

export default function FloatingWhatsApp({ 
  phoneNumber = "601136904336", // Replace with actual admin number
  message = "Hi, I need help with my Pacak Khemah account.",
  position = "right"
}: FloatingWhatsAppProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  function openWhatsApp() {
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-6 ${position === "right" ? "right-6" : "left-6"} z-50 w-12 h-12 bg-slate-200 text-slate-400 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-300 transition-all`}
        title="Show help button"
      >
        <i className="fas fa-comment-dots text-sm"></i>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 ${position === "right" ? "right-6" : "left-6"} z-50 flex flex-col items-end gap-2`}
    >
      {/* Tooltip */}
      {isHovered && (
        <div className="bg-white rounded-xl shadow-xl p-3 border border-slate-100 animate-fadeIn max-w-[200px]">
          <p className="text-xs font-bold text-slate-700 mb-1">Need Help?</p>
          <p className="text-[10px] text-slate-400">Chat with our admin team on WhatsApp</p>
        </div>
      )}

      {/* Main Button */}
      <div className="flex items-center gap-2">
        {/* Minimize button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="w-8 h-8 bg-white/80 backdrop-blur rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all opacity-0 group-hover:opacity-100"
          title="Minimize"
        >
          <i className="fas fa-minus text-[10px]"></i>
        </button>

        {/* WhatsApp Button */}
        <button
          onClick={openWhatsApp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="group relative w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
          title="Contact Admin"
        >
          {/* Pulse animation */}
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-25"></span>
          
          {/* Icon */}
          <i className="fab fa-whatsapp text-2xl relative z-10"></i>

          {/* Close/minimize on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-slate-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
          >
            <i className="fas fa-times"></i>
          </button>
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
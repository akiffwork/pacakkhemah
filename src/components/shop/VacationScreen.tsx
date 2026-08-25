"use client";

import Link from "next/link";

type Props = {
  vendorName?: string;
  vendorImage?: string;
  vendorPhone?: string;
};

// Fixed positions to avoid hydration mismatch
const STARS = [
  { top: "4%",  left: "7%",  s: 2, d: 0    },
  { top: "11%", left: "21%", s: 1, d: 0.5  },
  { top: "3%",  left: "44%", s: 2, d: 1    },
  { top: "8%",  left: "66%", s: 1, d: 0.3  },
  { top: "14%", left: "81%", s: 2, d: 0.8  },
  { top: "19%", left: "34%", s: 1, d: 1.2  },
  { top: "6%",  left: "54%", s: 2, d: 0.7  },
  { top: "24%", left: "11%", s: 1, d: 1.5  },
  { top: "17%", left: "91%", s: 2, d: 0.2  },
  { top: "4%",  left: "71%", s: 1, d: 1.8  },
  { top: "29%", left: "57%", s: 2, d: 0.4  },
  { top: "9%",  left: "87%", s: 1, d: 1.1  },
  { top: "21%", left: "4%",  s: 2, d: 0.9  },
  { top: "34%", left: "24%", s: 1, d: 1.6  },
  { top: "5%",  left: "31%", s: 2, d: 0.6  },
  { top: "27%", left: "74%", s: 1, d: 1.3  },
  { top: "15%", left: "47%", s: 2, d: 0.1  },
  { top: "2%",  left: "59%", s: 2, d: 0.8  },
  { top: "32%", left: "89%", s: 1, d: 1.4  },
  { top: "38%", left: "16%", s: 1, d: 1.7  },
  { top: "7%",  left: "38%", s: 1, d: 0.25 },
  { top: "22%", left: "63%", s: 2, d: 1.05 },
  { top: "13%", left: "2%",  s: 1, d: 0.65 },
  { top: "36%", left: "42%", s: 2, d: 1.35 },
];

export default function VacationScreen({ vendorName, vendorImage, vendorPhone }: Props) {
  const waNumber = vendorPhone?.replace(/\D/g, "");

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(to bottom, #010b05 0%, #041a0e 45%, #062c24 100%)" }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes fireGlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.6;  transform: scale(1.18); }
        }
        @keyframes flame {
          0%, 100% { d: path("M12 2 C12 2 8 8 8 13 C8 17.4 10 20 12 20 C14 20 16 17.4 16 13 C16 8 12 2 12 2Z"); }
          50%       { d: path("M12 2 C13 3 9 9 9 13 C9 17.4 10.5 20 12 20 C13.5 20 15 17.4 15 13 C15 8 11 2 12 2Z"); }
        }
      `}</style>

      {/* Stars */}
      {STARS.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: star.top,
            left: star.left,
            width: star.s,
            height: star.s,
            animation: `twinkle ${2 + star.d}s ease-in-out infinite`,
            animationDelay: `${star.d}s`,
          }}
        />
      ))}

      {/* Moon */}
      <div
        className="absolute top-[6%] right-[8%] w-10 h-10 rounded-full bg-amber-100 opacity-80 shadow-[0_0_24px_8px_rgba(251,191,36,0.18)]"
      />

      {/* Mountains SVG */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 260" preserveAspectRatio="none" className="w-full" style={{ height: "clamp(140px, 28vw, 260px)" }}>
          {/* Back range */}
          <path d="M0,260 L0,190 L180,70 L360,160 L540,50 L720,140 L900,30 L1080,120 L1260,55 L1440,110 L1440,260 Z" fill="#021409" />
          {/* Front range */}
          <path d="M0,260 L0,230 L120,155 L280,210 L460,140 L600,195 L760,125 L920,180 L1080,130 L1260,175 L1440,145 L1440,260 Z" fill="#031b0d" />
          {/* Tent */}
          <path d="M693,250 L720,195 L747,250 Z" fill="#020f08" />
          <path d="M712,250 L720,195 L728,250 Z" fill="#031508" />
          {/* Tent door */}
          <rect x="716" y="232" width="8" height="18" rx="2" fill="#010c06" />
        </svg>
      </div>

      {/* Campfire glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "clamp(72px, 14vw, 130px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(251,146,60,0.55) 0%, rgba(251,146,60,0) 70%)",
          animation: "fireGlow 2.2s ease-in-out infinite",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 text-center px-6 w-full max-w-sm"
        style={{ animation: "float 5s ease-in-out infinite", marginBottom: "clamp(100px, 18vw, 160px)" }}
      >
        {/* Vendor logo or campsite emoji */}
        {vendorImage ? (
          <img
            src={vendorImage}
            alt={vendorName}
            className="w-20 h-20 rounded-2xl mx-auto mb-5 object-cover border-2 border-white/20 shadow-2xl"
          />
        ) : (
          <div className="text-5xl mb-5">⛺</div>
        )}

        <h1 className="text-white font-black text-2xl uppercase tracking-tight leading-tight mb-1">
          {vendorName || "We're away"}
        </h1>
        <p className="text-emerald-400 font-bold text-sm mb-1">Out in the wild</p>
        <p className="text-white/40 text-xs mb-8">
          Back at camp soon. Thanks for your patience!
        </p>

        <div className="flex flex-col gap-3">
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=Hi%2C%20I%20saw%20your%20shop%20is%20on%20vacation.%20Just%20wanted%20to%20reach%20out!`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all"
            >
              <i className="fab fa-whatsapp text-base"></i>
              Message Us on WhatsApp
            </a>
          )}
          <Link
            href="/directory"
            className="flex items-center justify-center gap-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
          >
            <i className="fas fa-compass text-base"></i>
            Browse Other Shops
          </Link>
        </div>
      </div>
    </div>
  );
}

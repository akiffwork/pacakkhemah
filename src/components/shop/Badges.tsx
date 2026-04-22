export type Badge = "verified" | "id_verified" | "top_rated" | "fast_responder" | "premium";

export const BADGE_CONFIG: Record<Badge, { label: string; icon: string; bg: string; text: string; border: string }> = {
  verified: {
    label: "Verified",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
  id_verified: {
    label: "ID Verified",
    icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z",
    bg: "bg-teal-50",
    text: "text-teal-600",
    border: "border-teal-200",
  },
  top_rated: {
    label: "Top Rated",
    icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
  },
  fast_responder: {
    label: "Fast Responder",
    icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  premium: {
    label: "Premium",
    icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0",
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
  },
};

export function BadgeIcon({ badge, size = "sm" }: { badge: Badge; size?: "sm" | "md" | "lg" }) {
  const config = BADGE_CONFIG[badge];
  const sizeClasses = {
    sm: "w-5 h-5 p-0.5",
    md: "w-6 h-6 p-1",
    lg: "w-8 h-8 p-1.5",
  };

  return (
    <div className={`${sizeClasses[size]} ${config.bg} ${config.text} rounded-full border ${config.border} flex items-center justify-center`} title={config.label}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-full h-full">
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
    </div>
  );
}

export function BadgePill({ badge }: { badge: Badge }) {
  const config = BADGE_CONFIG[badge];
  return (
    <div className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} border ${config.border} px-2 py-1 rounded-full`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      <span className="text-[9px] font-bold uppercase tracking-wide">{config.label}</span>
    </div>
  );
}
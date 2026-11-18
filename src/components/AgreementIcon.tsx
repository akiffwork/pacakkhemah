import { ICONS, type IconName } from "@/lib/agreementIcons";

/** Inline SVG icon (same shapes as the agreement PDF; no icon font needed). */
export default function AgreementIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const i = ICONS[name];
  return (
    <svg viewBox={`0 0 ${i.w} ${i.h}`} width="1em" height="1em" fill="currentColor" aria-hidden="true" className={`inline-block shrink-0 ${className}`} style={{ verticalAlign: "-0.125em" }}>
      <path d={i.d} />
    </svg>
  );
}

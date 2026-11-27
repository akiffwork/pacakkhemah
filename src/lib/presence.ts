// Vendor activity: the vendor dashboard sends a heartbeat to
// vendors/{vendorId}/privateInfo/presence, readable only by the shop's owner
// and the admin. Admin › Vendors shows it as Online or "Last active …".

import { db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export const HEARTBEAT_MS = 2 * 60 * 1000;
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function ago(ms: number): string {
  const units: [number, string][] = [[86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"]];
  for (const [size, name] of units) {
    const n = Math.floor(ms / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

export function describeLastActive(lastActiveAt: number | undefined, now: number): { online: boolean; label: string } {
  if (!lastActiveAt) return { online: false, label: "Last active: never" };
  const age = now - lastActiveAt;
  if (age < ONLINE_WINDOW_MS) return { online: true, label: "Online" };
  const when = new Date(lastActiveAt);
  const date = when.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  const time = when.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return { online: false, label: `Last active ${ago(age)} (${date}, ${time})` };
}

/** Records the vendor as active now, every HEARTBEAT_MS while the page is visible. Returns a stop function. */
export function startPresenceHeartbeat(vendorId: string): () => void {
  const beat = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    setDoc(doc(db, "vendors", vendorId, "privateInfo", "presence"), { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {});
  };
  const onVisible = () => { if (document.visibilityState === "visible") beat(); };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", onVisible);
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
}

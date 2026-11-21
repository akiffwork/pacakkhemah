// src/lib/pushRegistration.ts
// Browser push for vendors: ask permission, register the service worker,
// get an FCM token and save it on the vendor document. The Cloud Functions
// in functions/index.ts send to vendors/{id}.fcmToken.

import { getToken, onMessage, deleteToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db, getMessagingInstance } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export type PushStatus = "unsupported" | "blocked" | "off" | "on";

export async function pushSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  return !!(await getMessagingInstance());
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export type ForegroundAlert = { title: string; body: string; url?: string; type?: string };

let foregroundBound = false;
let foregroundListener: ((alert: ForegroundAlert) => void) | null = null;

/**
 * Alerts that arrive while the dashboard is open and visible come here instead
 * of the phone's tray (mobile browsers don't allow `new Notification()` from a
 * page). The dashboard shows them as an in-app toast. Returns an unsubscribe.
 */
export function onForegroundAlert(listener: (alert: ForegroundAlert) => void): () => void {
  foregroundListener = listener;
  return () => { if (foregroundListener === listener) foregroundListener = null; };
}

/**
 * Close every Pacak Khemah alert in the phone's tray and clear the app-icon
 * badge. Called when the dashboard opens or comes back to the front: once the
 * vendor is looking at the app, the alerts have done their job.
 */
export async function clearNotifications(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const open = await reg.getNotifications();
      open.forEach((n) => n.close());
      reg.active?.postMessage({ type: "CLEAR_NOTIFICATIONS" });
    }
    const nav = navigator as unknown as { clearAppBadge?: () => Promise<void> };
    await nav.clearAppBadge?.();
  } catch (e) {
    console.warn("Clearing notifications failed:", e);
  }
}

/** Ask for permission, register and save the token. Returns the token, or null if refused. */
export async function enablePush(vendorId: string): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) throw new Error("unsupported");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return null;
  await updateDoc(doc(db, "vendors", vendorId), { fcmToken: token, fcmUpdatedAt: new Date().toISOString() });

  if (!foregroundBound) {
    foregroundBound = true;
    onMessage(messaging, (payload) => {
      const data = payload.data || {};
      const title = data.title || payload.notification?.title;
      if (!title) return;
      foregroundListener?.({ title, body: data.body || payload.notification?.body || "", url: data.url, type: data.type });
    });
  }
  await clearNotifications();
  return token;
}

/** Stop alerts on this device. */
export async function disablePush(vendorId: string): Promise<void> {
  try {
    const messaging = await getMessagingInstance();
    if (messaging) await deleteToken(messaging);
  } catch (e) { console.warn("deleteToken failed:", e); }
  await updateDoc(doc(db, "vendors", vendorId), { fcmToken: null, fcmUpdatedAt: new Date().toISOString() });
}

/**
 * Silently refresh the saved token on dashboard load when the vendor has
 * already turned alerts on (permission granted and a token saved).
 */
export async function refreshPushIfEnabled(vendorId: string, hasToken: boolean): Promise<void> {
  if (!hasToken || pushPermission() !== "granted") return;
  try { await enablePush(vendorId); } catch (e) { console.warn("Push refresh failed:", e); }
}

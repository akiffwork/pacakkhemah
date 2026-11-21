// public/firebase-messaging-sw.js
// Vendor alerts. Messages are data-only (functions/push.ts). When the
// dashboard is open and visible, Firebase hands the message to the page
// instead (in-app toast), so this only shows alerts while the app is closed.
//
// Clearing: the dashboard calls clearNotifications() (src/lib/pushRegistration.ts)
// whenever it opens or comes back to the front, and tapping any alert clears
// them all, so nothing is left in the tray once the vendor has seen the app.

importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAijpbwzFTDctk38Ktkcbt1Hd4y-1Cd1Xw",
  authDomain: "kuantan-unplugged.firebaseapp.com",
  projectId: "kuantan-unplugged",
  storageBucket: "kuantan-unplugged.firebasestorage.app",
  messagingSenderId: "125749320406",
  appId: "1:125749320406:web:e8d7526d2ad18947608777",
});

const messaging = firebase.messaging();

// App-icon badge = number of alerts still in the tray
async function syncBadge() {
  if (!self.navigator.setAppBadge) return;
  const open = await self.registration.getNotifications();
  if (open.length) await self.navigator.setAppBadge(open.length);
  else await self.navigator.clearAppBadge();
}

async function clearAll() {
  const open = await self.registration.getNotifications();
  open.forEach((n) => n.close());
  if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
}

messaging.onBackgroundMessage(async (payload) => {
  const data = payload.data || {};
  // Same tag (same booking or review) replaces the older alert instead of stacking
  await self.registration.showNotification(data.title || "Pacak Khemah", {
    body: data.body || "Anda ada pesanan baru!",
    icon: "/icons/vendor/icon-192x192.png",
    badge: "/icons/vendor/icon-96x96.png",
    tag: data.tag || data.type || "pacak-khemah",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/store" },
  });
  await syncBadge();
});

// Tap: clear the tray, then bring the dashboard forward on the right tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/store", self.location.origin).href;

  event.waitUntil((async () => {
    await clearAll();
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((c) => c.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      // navigate() only works on pages this worker controls; fall back to a message
      try { await existing.navigate(url); }
      catch { existing.postMessage({ type: "OPEN_URL", url }); }
      return;
    }
    await clients.openWindow(url);
  })());
});

// Swiping an alert away keeps the badge in step
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(syncBadge());
});

// The dashboard asks to clear when it opens or comes to the front
self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_BADGE" || event.data?.type === "CLEAR_NOTIFICATIONS") {
    event.waitUntil(clearAll());
  }
});

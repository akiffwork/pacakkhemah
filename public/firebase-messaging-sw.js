// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAijpbwzFTDctk38Ktkcbt1Hd4y-1Cd1Xw",
  authDomain: "kuantan-unplugged.firebaseapp.com",
  projectId: "kuantan-unplugged",
  storageBucket: "kuantan-unplugged.firebasestorage.app",
  messagingSenderId: "125749320406",
  appId: "1:125749320406:web:e8d7526d2ad18947608777",
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || "Pacak Khemah", {
    body: body || "Anda ada pesanan baru!",
    icon: icon || "/icons/vendor/icon-192x192.png",
    badge: "/icons/vendor/icon-96x96.png",
    tag: data.type || "default",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/store", ...data },
    actions: [
      { action: "open", title: "Buka App" },
    ],
  });
});

// Click on notification — focus existing tab or open new one, then clear badge
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/store";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});

// Clear badge when app sends message
self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_BADGE") {
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge();
    }
  }
});
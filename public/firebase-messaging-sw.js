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

  self.registration.showNotification(title || "Pacak Khemah", {
    body: body || "Anda ada pesanan baru!",
    icon: icon || "/icons/vendor/icon-192x192.png",
    badge: "/icons/vendor/icon-96x96.png",
    vibrate: [200, 100, 200],
    data: payload.data,
    actions: [
      { action: "open", title: "Buka App" },
    ],
  });
});

// Click on notification opens the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/store")
  );
});
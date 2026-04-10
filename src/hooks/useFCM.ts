"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db, getMessagingInstance } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function useFCM(vendorId: string | null) {
  useEffect(() => {
    if (!vendorId) return;

    async function registerFCM() {
      if (!vendorId) return;
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Register service worker and wait for it to be active
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
        await navigator.serviceWorker.ready;

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          // Save token to vendor's Firestore doc
          await updateDoc(doc(db, "vendors", vendorId), {
            fcmToken: token,
            fcmUpdatedAt: new Date().toISOString(),
          });
          console.log("FCM token saved");
        }

        // Clear badge when app opens
        if ("clearAppBadge" in navigator) {
          (navigator as any).clearAppBadge?.();
        }
        if (registration.active) {
          registration.active.postMessage("CLEAR_BADGE");
        }

        // Handle foreground messages (app is open and focused)
        onMessage(messaging, (payload) => {
          console.log("[Foreground] Message:", payload);

          const { title, body } = payload.notification || {};
          if (!title) return;

          // Show browser notification even when app is in foreground
          if (Notification.permission === "granted") {
            new Notification(title, {
              body: body || "",
              icon: "/pacak-khemah.png",
              tag: payload.data?.type || "foreground",
            });
          }
        });

      } catch (err) {
        console.error("FCM registration failed:", err);
      }
    }

    registerFCM();
  }, [vendorId]);
}
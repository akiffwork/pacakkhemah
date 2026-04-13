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

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
        await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
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

        // Handle foreground messages — read from data payload (no notification key)
        onMessage(messaging, (payload) => {
          console.log("[Foreground] Message:", payload);

          const data = payload.data || {};
          const title = data.title || payload.notification?.title;
          const body = data.body || payload.notification?.body;
          if (!title) return;

          if (Notification.permission === "granted") {
            new Notification(title, {
              body: body || "",
              icon: "/pacak-khemah.png",
              tag: data.type || "foreground",
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
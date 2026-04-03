"use client";

import { useEffect } from "react";
import { getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db, getMessagingInstance } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function useFCM(vendorId: string | null) {
  useEffect(() => {
    if (!vendorId) return;

    async function registerFCM() {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Register service worker
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

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
      } catch (err) {
        console.error("FCM registration failed:", err);
      }
    }

    registerFCM();
  }, [vendorId]);
}
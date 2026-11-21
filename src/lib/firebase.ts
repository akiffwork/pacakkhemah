import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check: proves requests come from the real site, not a script, so
// booking requests can't be spammed to use up a shop's credits. Off until a
// site key is set in Vercel:
//   NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY  (Fraud Defense / reCAPTCHA Enterprise, preferred)
//   NEXT_PUBLIC_RECAPTCHA_SITE_KEY            (classic reCAPTCHA v3, being retired by Google)
// Enforce it in the Firebase console (App Check) once its metrics show real
// traffic is verified.
const enterpriseKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
const classicKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
if (typeof window !== "undefined" && (enterpriseKey || classicKey) && !(globalThis as { __pkAppCheck?: boolean }).__pkAppCheck) {
  try {
    initializeAppCheck(app, {
      provider: enterpriseKey ? new ReCaptchaEnterpriseProvider(enterpriseKey) : new ReCaptchaV3Provider(classicKey!),
      isTokenAutoRefreshEnabled: true,
    });
    (globalThis as { __pkAppCheck?: boolean }).__pkAppCheck = true;
  } catch (e) {
    console.warn("App Check not started:", e);
  }
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Messaging — only available in browser with notification support
export const getMessagingInstance = async () => {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}
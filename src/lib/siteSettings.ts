// src/lib/siteSettings.ts
// Platform settings edited in Admin › Settings and Admin › Site, with the
// defaults the site falls back to when nothing has been saved.

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SiteSettings = {
  siteName: string;
  tagline: string;
  contactEmail: string;
  contactWhatsApp: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

export const DEFAULT_SITE: SiteSettings = {
  siteName: "Pacak Khemah",
  tagline: "Pacak. Rehat. Ulang.",
  contactEmail: "support.pacakkhemah@gmail.com",
  contactWhatsApp: "601136904336",
  maintenanceMode: false,
  maintenanceMessage: "We are doing some maintenance. Bookings may be unavailable for a short while.",
};

export type DefaultPolicies = {
  securityDeposit: number;
  securityDepositType: "fixed" | "percentage";
  cancellationHours: number;
  damagePolicy: string;
};

export const DEFAULT_POLICIES: DefaultPolicies = {
  securityDeposit: 50,
  securityDepositType: "fixed",
  cancellationHours: 48,
  damagePolicy: "Customer is responsible for any damage or loss of equipment during the rental period.",
};

export type HomepageContent = { heroTitle: string; heroSubtitle: string; heroCta: string };

export async function loadSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    return { ...DEFAULT_SITE, ...(snap.exists() ? snap.data() as Partial<SiteSettings> : {}) };
  } catch { return DEFAULT_SITE; }
}

export async function loadDefaultPolicies(): Promise<DefaultPolicies> {
  try {
    const snap = await getDoc(doc(db, "settings", "default_policies"));
    return { ...DEFAULT_POLICIES, ...(snap.exists() ? snap.data() as Partial<DefaultPolicies> : {}) };
  } catch { return DEFAULT_POLICIES; }
}

/** Fields a brand-new shop starts with, from the admin's default policies. */
export function newShopDefaults(p: DefaultPolicies) {
  const rules = [
    p.cancellationHours > 0 ? `Cancellations must be made at least ${p.cancellationHours} hours before pickup.` : "",
    p.damagePolicy.trim(),
  ].filter(Boolean);
  return {
    security_deposit: p.securityDeposit,
    security_deposit_type: p.securityDepositType === "percentage" ? "percent" : "fixed",
    ...(rules.length ? { rules } : {}),
  };
}

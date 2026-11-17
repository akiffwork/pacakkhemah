// src/lib/adminAccess.ts
// Who may open the admin panel. The owner is always an admin; more admins are
// listed in private/admins (readable only by admins, enforced by the rules).

import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const OWNER_EMAIL = "akiff.work@gmail.com";

export function isOwner(email?: string | null): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL;
}

/** True when this signed-in email is the owner or listed in private/admins. */
export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isOwner(email)) return true;
  try {
    // Only admins can read this document, so a successful read already says yes.
    const snap = await getDoc(doc(db, "private", "admins"));
    const list = (snap.data()?.emails as string[] | undefined) || [];
    return list.map(e => e.toLowerCase()).includes(email.toLowerCase());
  } catch {
    return false;
  }
}

export async function loadAdminEmails(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, "private", "admins"));
    if (snap.exists()) return (snap.data().emails as string[]) || [];
    // Older setup kept the list in a public settings document
    const legacy = await getDoc(doc(db, "settings", "admin_emails"));
    return (legacy.data()?.emails as string[] | undefined)?.filter(e => !isOwner(e)) || [];
  } catch {
    return [];
  }
}

/** Save the extra admins (the owner is implied) and remove the old public copy. */
export async function saveAdminEmails(emails: string[]): Promise<void> {
  const clean = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e.includes("@") && !isOwner(e)))];
  await setDoc(doc(db, "private", "admins"), { emails: clean });
  await deleteDoc(doc(db, "settings", "admin_emails")).catch(() => {});
}

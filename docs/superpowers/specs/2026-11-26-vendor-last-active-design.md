# Vendor last active and online status — design

## Intent
The admin wants to see, in Admin › Vendors, when each vendor last used their dashboard and whether they are online now.

## Goals
- Each vendor card shows `● Online`, or `Last active <relative> (<date, time>)`, or `Last active: never`.
- Updates live, without a page refresh.

## Non-goals
- Sorting or filtering vendors by activity (can come later).
- Activity history or session logs.
- True Firebase Auth "last sign-in" (stale because sessions persist for weeks).

## Anti-goals
- Exposing activity publicly: it must not go on `vendors/{id}`, which anyone can read.
- Counting the admin's own "Open dashboard" (admin_override) visits as vendor activity.

## Approaches
1. **Firestore heartbeat (chosen).** The vendor dashboard writes `lastActiveAt` about every 2 minutes while it is open and visible. Online = under 3 minutes old. No new services, and it stays private.
2. Realtime Database `onDisconnect` presence: instant offline, but it needs a second database and new rules. Too much for this.
3. Firebase Auth `lastSignInTime` via a Cloud Function: no writes, but no online status and stale dates.

The user picked option 1.

## Design
- **Storage:** `vendors/{vendorId}/privateInfo/presence` → `{ lastActiveAt: serverTimestamp() }`. The existing privateInfo rules (owner + admin only) already cover it, so no rule changes are needed.
- **Writer:** `src/app/store/page.tsx`. Once the signed-in owner's vendor is loaded, and not in admin override, it writes on load, every 2 minutes while `document.visibilityState === "visible"`, and again when the tab becomes visible. It pauses when hidden. Write failures are ignored silently.
- **Reader:** `src/app/admin/page.tsx` already listens to `collectionGroup("privateInfo")`. It will also read `lastActiveAt` from the `presence` doc into a `lastActiveAt?: number` (ms) field on `AdminVendor`.
- **Display:** in `VendorsTab.tsx`, a line on each card. A 30-second ticker re-renders so "Online" expires on its own. Online = `now - lastActiveAt < 3 min`.
- **Side effect:** the Settings export already merges all privateInfo docs, so `lastActiveAt` will appear in exports. That's harmless.

## Left to the builder
The exact styling of the line or chip, and the relative-time wording.

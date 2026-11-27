# Vendor Last Active Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each vendor's last active time, and whether they are online, in Admin › Vendors.

**Architecture:** The vendor dashboard sends a heartbeat to `vendors/{id}/privateInfo/presence`. The admin page's existing privateInfo listener reads it, and VendorsTab formats it.

**Tech Stack:** Next.js 16, Firebase client SDK (Firestore), Jest.

**Spec:** `docs/superpowers/specs/2026-11-26-vendor-last-active-design.md`

## Global Constraints
- Heartbeat interval: 2 minutes. Online window: under 3 minutes.
- Never write to `vendors/{id}` itself. Only write to `privateInfo/presence`.
- No heartbeat during admin override.

## Review Focus
- `lastActiveAt` missing (vendor never active since launch) → "never", with no crash.
- `lastActiveAt` slightly in the future (clock skew) → shows as Online, never "in -1 minutes".
- Exactly 3 minutes old → not online.
- Tab hidden → no writes. Tab visible again → immediate write.
- Pending `serverTimestamp` (null in a local snapshot) → treated as now, not as missing.

---

### Task 1: Presence helpers

**Files:**
- Create: `src/lib/presence.ts`
- Test: `tests/unit/presenceTest.ts`

**Interfaces:**
- Produces: `ONLINE_WINDOW_MS = 180000`, `HEARTBEAT_MS = 120000`, `describeLastActive(lastActiveAt: number | undefined, now: number): { online: boolean; label: string }`, `startPresenceHeartbeat(vendorId: string): () => void`.

- [ ] Tests: undefined → `{online:false,label:"Last active: never"}`; now-60s → online, label "Online"; now+5s → online; now-180000 → not online; now-3h → label starts "Last active 3 hours ago" and contains the date and time in en-MY format; now-2 days → "2 days ago".
- [ ] Implement. `startPresenceHeartbeat` does `setDoc(doc(db,"vendors",id,"privateInfo","presence"),{lastActiveAt:serverTimestamp()},{merge:true}).catch(()=>{})` on start, on a `HEARTBEAT_MS` interval when visible, and on `visibilitychange` to visible. It returns a cleanup function.
- [ ] `npm test -- presenceTest` passes.

### Task 2: Wire writer and reader

**Files:**
- Modify: `src/app/store/page.tsx` (effect that runs when `vendorId` is set and `!isAdminOverride`)
- Modify: `src/app/admin/page.tsx:193-204` (read `presence` doc `lastActiveAt` using `toMillis({estimate})`, stored in a map and merged in)
- Modify: `src/components/admin/types.ts` (`lastActiveAt?: number`)

### Task 3: Display

**Files:**
- Modify: `src/components/admin/VendorsTab.tsx`. Add a 30s `now` ticker and a line under the contact line on each card: a green dot plus "Online", or a slate `describeLastActive(...).label`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` all pass.

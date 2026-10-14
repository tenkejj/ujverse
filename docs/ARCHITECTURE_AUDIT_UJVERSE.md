# UJverse — Senior Fullstack Architecture Audit

**Scope:** React / Vite + Supabase, FacultyAccent, follow system with optimistic updates, Profile thread UI.  
**Date:** 2026-04-29  
**Intent:** Identify technical debt, race conditions, and optimization opportunities. **No broad refactor** — prioritize critical issues.

---

## Executive summary

The app’s **entry-point layering is sound** (router → theme → app shell). **Supabase Realtime** is generally unsubscribed in `useEffect` cleanups, but **global table subscriptions without row filters** and **missing in-flight guards on some fetches** create scalability and correctness risks. The **follow toggle** is reasonably hardened against double-clicks; **optimistic + Realtime** can still **double-count** follower totals in edge cases. **Profile / Replies** path is the heaviest data surface: many parallel queries per profile visit. **FacultyAccent** is applied consistently on the main profile surfaces but **not** as a global design contract — many views use ad hoc `slate` / `zinc` / `brand-gold` tokens instead of `--profile-*` variables.

---

## 1. Entry point audit (`src/main.tsx`, `src/App.tsx`)

### Findings

| Area | Status | Notes |
|------|--------|--------|
| **Provider order** | OK | `BrowserRouter` → `ThemeProvider` → `App` + `Toaster` matches typical needs: routing and theme available to the whole tree. |
| **Toaster placement** | OK | Sibling to `App` under `ThemeProvider` is fine for portals / stacking. |
| **EventsProvider** | Acceptable | Wraps authenticated shell only (after `if (!session) return <Auth />`). `useEvents()` on `Profile` is therefore undefined for unauthenticated tree — currently unreachable because `Profile` is not rendered without session. If you ever render profile-like UI before auth, hoist or guard. |
| **Routing model** | Mixed | Primary navigation is **local state** (`activeView`) plus **URL** for `/profile`, `/profile/:handle`, `/thread/:id`. `effectiveActiveView` derives from pathname, which can drift from `activeView` for deep links — intentional but increases cognitive load and duplicate sources of truth. |
| **StrictMode** | Awareness | Double-mounting in dev can amplify Realtime subscribe/unsubscribe churn; ensure idempotent channel setup (current code uses cleanup — OK). |

### Technical debt (entry)

- **Dual navigation:** URL + `activeView` requires discipline whenever adding routes; risk of inconsistent back/forward vs bottom nav.
- **God-component `App`:** Session, posts, likes, comments, notifications, and Realtime live in one file — harder to test and reason about than route-level data boundaries.

---

## 2. Hook efficiency & Supabase usage

### `useProfileData.ts`

**Strengths**

- **Abort / stale guard** via `cancelled` flag on unmount or `userId` change — correct pattern.
- Single `profiles` row fetch with an explicit column list (not `*`).

**Issues**

1. **`useEffect` dependency `[userId, initialProfile]`**  
   If a parent passes `initialProfile` as a **new object reference** on every render (e.g. inline `{ ...myProfile }`), the effect re-runs even when `id` is unchanged — **avoidable refetches**. Prefer `initialProfile?.id` in the dependency array or stabilize the prop upstream.

2. **Redundant fetch on Profile**  
   On another user’s profile, `Profile` already loads `otherProfile` via `fetchOtherUser` (`select('*')`). `useProfileData` is used for `currentUserProfile` (viewer) with `initialProfile: myProfile` — good. For the **viewed** user, accent comes from `profileForDisplay` passed into `FacultyAccent`, not from `useProfileData`, so there is no duplicate fetch for *displayed* department from that hook alone. **No critical duplicate** there.

### `useProfileSocialData.ts`

**Strengths**

- `fetchCounts` batches three queries with `Promise.all`.
- Realtime channel **removed** in `useEffect` cleanup.

**Critical / high priority**

1. **Realtime: unfiltered `postgres_changes` on `follows`**  
   Subscription: `{ event: '*', schema: 'public', table: 'follows' }` with **no `filter`**. Every insert/update/delete on `follows` for **any** users will invoke the callback for **every** open profile view that has this subscription. Client-side filtering by `viewedUserId` limits *state updates* but not **network / CPU** cost.  
   **Recommendation:** Use Supabase Realtime filters (e.g. `filter` on `following_id` / `follower_id`) or narrow RLS + publication strategy so clients only receive relevant rows.

2. **Stale `fetchCounts` responses**  
   `fetchCounts` has **no cancellation / version token**. If the user navigates **A → B** quickly, the response for **A** can arrive after **B** and overwrite counts (`setFollowersCount`, `setIsFollowing`, etc.).  
   **Recommendation:** AbortController, or a monotonic `requestId` ref compared before applying results.

3. **`fetchCounts` without `silent` still sets loading**  
   If called repeatedly (e.g. modal `onCountsChange`), consider debouncing or always using `silent: true` for background refreshes to avoid UI flicker.

### `App.tsx` Realtime & data volume

- **`ujverse-realtime` channel** depends on `postIds` — **channel recreated whenever the post list changes** (full resubscribe). Acceptable for small feeds; costly if `posts` churn often.
- **Likes handler** refetches likes for **all** `postIds` on **any** `likes` row change globally (again, likely unfiltered at subscription level in code — verify Supabase config). Same pattern as follows: **client filters**, server may still push broad events.
- **`fetchNotifications` on every INSERT** to notifications — appropriate for UX; watch for burst traffic.

### `Profile.tsx` — `fetchRepliesWithPostContext`

**Major optimization opportunity (not necessarily a “bug”):** After loading user comments, the code fans out into **many** `Promise.all` queries (aggregate tables for posts and comments, per-user interaction rows, etc.). For users with many replies, this is **O(replies × tables)** round-trips.  

**Recommendations (future):** RPC or a single **materialized view / SQL function** returning thread cards; or server-side aggregation columns on `comments` / `posts` to avoid N+1 patterns.

### `FollowListsModal.tsx`

- Row toggles use **pessimistic** updates (state changes after DB success) except `onCountsChange?.({ silent: true })` — fine.
- **No optimistic UI** on list rows: slower perceived latency but fewer rollback races.
- **`loadAll` on every `open`** — refetches full follower/following lists each time; acceptable for small lists, consider cache TTL if lists grow.

---

## 3. State management — Advanced Follow System & optimistic paths

### Profile header — `useProfileSocialData.toggleFollow`

**Double-click / rapid fire:** Guarded with `followToggleInFlight` ref — **good**.

**Optimistic flow:** Toggles `isFollowing` and `followersCount` immediately, then reverts on error — **good** for network failure UX.

**Race / consistency issues**

1. **Optimistic + Realtime double increment**  
   On follow: local code does `setFollowersCount(prev => prev + 1)`. When the insert commits, Realtime fires `INSERT` with `followingId === viewedUserId` → handler does `prev + 1` **again**. Net **+2** unless Realtime handler is skipped for “self” events. The handler adjusts count for **any** follower insert on that user, **including** the current user’s own follow.  
   **Severity:** High for correctness of displayed follower count until next full `fetchCounts` or navigation.

2. **Realtime `isFollowing` vs optimistic**  
   For non-own profile, `setIsFollowing(payload.eventType === 'INSERT')` when `followerId === currentUserId` can **confirm** optimistic state — OK. On DELETE, same — OK. Conflict mainly affects **counts** as above.

3. **`fetchCounts` vs in-flight toggle**  
   If `refreshFollowStats` runs during a toggle, it may reset state from DB while optimistic update is mid-flight — edge case but possible from `FollowListsModal` `onCountsChange`.

### `FollowListsModal` — `handleRowFollowToggle`

- Uses `rowToggleBusy` per user id — **prevents double-submit per row**.
- **No optimistic** follow state in the list — avoids mismatch with profile header counts until `onCountsChange` runs (silent refresh). Minor **UI desync** possible between modal row buttons and header counts for a short window.

### `RepliesPanel` — likes (related “social” optimism)

- Uses `postLikePending` / `replyLikePending` to block concurrent toggles — **good**.
- On failure, reverts patch from `target.fallbackLiked` / `target.fallbackCount` — **good**.
- **Extra SELECT before insert/delete** (`maybeSingle` on existing like) adds latency and a race window if two tabs act simultaneously — rare.

---

## 4. UI consistency — Glassmorphism & FacultyAccent

### FacultyAccent (`src/components/profile/FacultyAccent.tsx`)

- Injects `--profile-accent`, `--profile-accent-soft`, `--profile-glow` from `getDeptAccent(department)` — **clear contract**.
- Used in **`Profile.tsx`** (wraps hero, tabs, FAB, follow modal) and **`ProfileModal.tsx`** — **aligned** with “profile = faculty-colored chrome”.

### `PROFILE_MOBILE` (`src/styles/mobile-theme.ts`)

- Documents itself as the **single source** for profile glass dimensions and classes (`glassClass`, `glassLight`, `glassDark`).
- Hero card uses `PROFILE_MOBILE.card.glassClass` — **good**.

### Inconsistencies / debt

1. **Feed, Compose, CommentThread, Settings** use **zinc / slate / brand-gold** literals rather than faculty vars — **by design or drift?** If the design system says “only profile surfaces are faculty-aware,” document it; otherwise **token sprawl** will continue.

2. **`FollowListsModal`** uses `PROFILE_MOBILE.card.glassLight` / `glassDark` + `backdrop-blur-2xl` — consistent with profile modals.

3. **`App.tsx` mobile compose sheet** uses **hardcoded** `zinc` / `white` / `zinc-950` — **outside** `FacultyAccent` and `PROFILE_MOBILE` — visually may diverge from profile glass language.

4. **`ProfileIdentity` warning strip** uses amber-specific classes — acceptable for semantic “warning,” not faculty accent.

---

## 5. Prioritized issue list

### P0 — Fix first

| ID | Issue | Where |
|----|--------|--------|
| P0-1 | **Follower count double increment** when optimistic follow + Realtime INSERT both bump `followersCount` | `useProfileSocialData.ts` Realtime handler vs `toggleFollow` |
| P0-2 | **Unfiltered Realtime** on `follows` (and verify `likes` / `comments` subscriptions) — scales poorly and drains client | Same + `App.tsx` |

### P1 — Soon

| ID | Issue | Where |
|----|--------|--------|
| P1-1 | **Stale `fetchCounts`** when switching profiles quickly | `useProfileSocialData.ts` |
| P1-2 | **`useProfileData` effect** keyed on whole `initialProfile` object | `useProfileData.ts` |
| P1-3 | **Profile replies pipeline** — many sequential/parallel Supabase calls per load | `Profile.tsx` `fetchRepliesWithPostContext` |

### P2 — Hardening & consistency

| ID | Issue | Where |
|----|--------|--------|
| P2-1 | Split **`App.tsx`** into hooks or route loaders | `App.tsx` |
| P2-2 | **Design tokens** — decide global vs profile-only use of `--profile-accent` | Tailwind usage across `src/components` |
| P2-3 | **Likes in `App.tsx`** — no rollback on failed Supabase like (unlike comments) | `toggleLike` |

---

## 6. Realtime cleanup & memory leaks (summary)

| Location | Cleanup | Risk |
|----------|---------|------|
| Auth `onAuthStateChange` | `subscription.unsubscribe()` | Low |
| Notifications channel | `removeChannel` in cleanup | Low |
| Posts likes/comments channel | `removeChannel` in cleanup | Low; **effect re-runs** when `postIds` reference changes — many subscribe/unsubscribe cycles |
| `useProfileSocialData` | `removeChannel` in cleanup | Low |

No obvious **leaked listeners** (missing cleanup) in the audited paths. The larger concern is **subscription scope and event volume**, not retained references after unmount.

---

## 7. Suggested verification (manual / automated)

1. **Follow P0-1:** Open another user’s profile, follow once, observe follower count with Network tab closed (Realtime on) vs off — compare to DB count.  
2. **Rapid profile switching:** Switch between two users before counts load — verify counts match intended user.  
3. **Supabase dashboard:** Inspect Realtime publication filters and message rates for `follows` under load.

---

*End of audit.*

# UJverse — Architect map

Operational memory for subagents working in this repo. **Before changing auth, profiles, follows, RLS, or global UI chrome**, skim the linked sections; prefer extending existing patterns over inventing new ones.

## Table of contents

- [How subagents should use this map](#how-subagents-should-use-this-map)
- [Project overview](#project-overview)
- [Stack](#stack)
- [Workspace layout](#workspace-layout)
- [Routing model](#routing-model)
- [Auth (client)](#auth-client)
- [Profile system](#profile-system)
- [Follow system](#follow-system)
- [Supabase schema from migrations](#supabase-schema-from-migrations)
- [Auth & RLS model](#auth--rls-model)
- [API surface](#api-surface)
- [Known drift](#known-drift)
- [Glassmorphism, theme, Tailwind v4](#glassmorphism-theme-tailwind-v4)
- [Services & adapters](#services--adapters)
- [Types](#types)
- [Component dependency hotspots](#component-dependency-hotspots)

---

## How subagents should use this map

1. **Locate** the layer you are changing (routing in [src/App.tsx](src/App.tsx), data in [src/services/DataService.ts](src/services/DataService.ts) / adapters, schema in [supabase/migrations/](supabase/migrations/), styling in [src/index.css](src/index.css) + [src/styles/theme.ts](src/styles/theme.ts)).
2. **Check invariants** in [.cursor/rules/architect.mdc](.cursor/rules/architect.mdc) so you do not break auth/profile/follow assumptions.
3. **Prefer** prop drilling from `App` for session-scoped UI over new global contexts unless the product explicitly requires one.
4. **Schema truth** for checked-in SQL is **migration files on disk**; [supabase_setup.sql](supabase_setup.sql) is a one-shot bootstrap that may differ in policy wording — see [Known drift](#known-drift).

---

## Project overview

UJverse is a Vite + React SPA using Supabase (Auth + Postgres + Realtime + Storage) for a university-themed social feed: posts, comments (threaded), likes, notifications, department-scoped announcements, events UI, and rich profiles with follows. Most application state for the feed lives in [src/App.tsx](src/App.tsx); feature views are composed under [src/components/](src/components/) and [src/pages/](src/pages/).

---

## Stack

| Layer | Technology |
|--------|------------|
| UI | React 19, Framer Motion, Lucide / Heroicons |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), custom `@theme` + CSS variables in [src/index.css](src/index.css) |
| Routing | `react-router-dom` — [`BrowserRouter`](src/main.tsx) only; **no** `<Routes>` / `<Route>` in [src/App.tsx](src/App.tsx) |
| Data | `@supabase/supabase-js`; domain facade [src/services/DataService.ts](src/services/DataService.ts) + adapters |
| Hosting / API | Vercel ([vercel.json](vercel.json)); serverless handler [api/scrape-wziks.ts](api/scrape-wziks.ts) |
| Analytics | `@vercel/analytics` in App |

---

## Workspace layout

| Path | Role |
|------|------|
| [src/App.tsx](src/App.tsx) | Session, `myProfile`, feed/post/comment state, navigation helpers, auth guard, main view switcher |
| [src/main.tsx](src/main.tsx) | React root, `BrowserRouter`, `ThemeProvider`, global Toaster, [src/index.css](src/index.css) |
| [src/components/](src/components/) | Feature UI: feed, profile, events, modals, `ui/BaseCard`, auth shell, etc. |
| [src/pages/](src/pages/) | Full-page or route-shaped pages: [Profile.tsx](src/pages/Profile.tsx), [ResetPassword.tsx](src/pages/ResetPassword.tsx) |
| [src/hooks/](src/hooks/) | e.g. [useProfileData.ts](src/hooks/useProfileData.ts), [useProfileSocialData.ts](src/hooks/useProfileSocialData.ts), [useEvents.ts](src/hooks/useEvents.ts), [useContent.ts](src/hooks/useContent.ts) |
| [src/services/](src/services/) | [DataService.ts](src/services/DataService.ts) + [ad/](src/services/adapters/) per content domain (not one file per DB table) |
| [src/types/](src/types/) | [index.ts](src/types/index.ts), [content.ts](src/types/content.ts), [database.ts](src/types/database.ts) |
| [src/lib/](src/lib/) | Utilities: departments, sanitizer, toast, formatters, Leaflet helpers |
| [src/styles/](src/styles/) | [theme.ts](src/styles/theme.ts) tokens, [mobile-theme.ts](src/styles/mobile-theme.ts) (`PROFILE_MOBILE`, nav, search) |
| [src/data/](src/data/) | Static / fallback data (clubs, mock events) — UI should go through DataService when required |
| [api/](api/) | Vercel functions (scraper) |
| [supabase/migrations/](supabase/migrations/) | Versioned SQL; **authoritative** for what the repo records as schema evolution |

---

## Routing model

- **Path + state hybrid** in [src/App.tsx](src/App.tsx): `activeView` and related state (e.g. `activePostId`, `activeProfileHandle`) combine with `location.pathname` into `effectiveActiveView` (see `effectiveActiveView` / `routeProfileHandle` / `routeThreadPostId`).
- **No `<Routes>` in App** — only `useLocation` / `useNavigate`. [`BrowserRouter`](src/main.tsx) wraps the tree.
- **Key path helpers** (same file): `profileHandleFromPath`, `threadPostIdFromPath`, `isResetPasswordPath`.
- **Deep links**: `/profile/:handle` → `userProfile`; `/thread/:postId` → `post`; `/profile` → own profile; `/reset-password` → password reset without session.

---

## Auth (client)

- **Session** — `useState` + `supabase.auth.getSession()` and `onAuthStateChange` in [src/App.tsx](src/App.tsx). `PASSWORD_RECOVERY` redirects to `/reset-password` when needed.
- **Login** — [src/components/auth/Login.tsx](src/components/auth/Login.tsx) uses **synthetic email** `{username}@ujverse.test` for `signInWithPassword` / `signUp`.
- **Auth shell** — [src/Auth.tsx](src/Auth.tsx) is a styled layout wrapping `Login` only.
- **No AuthContext** — session is local to `App`; there is a separate [src/ThemeContext.tsx](src/ThemeContext.tsx) for light/dark.
- **`myProfile`** — loaded in `App`, passed down as props (e.g. `sharedPostProps`, `Header`, `ProfileModal`, compose).

---

## Profile system

**Hook** [src/hooks/useProfileData.ts](src/hooks/useProfileData.ts):

| | |
|--|--|
| **Inputs** | `userId`, optional `initialProfile` |
| **Outputs** | `{ profile, accentColor, loading }` |
| **Columns** | `id, full_name, username, avatar_url, banner_url, bio, department, created_at, role, is_banned` |
| **Realtime** | **None** — single fetch per `userId` / `initialProfile` change |
| **`initialProfile` shortcut** | If `initialProfile?.id === userId`, skips network and sets `loading` false |

---

## Follow system

### SQL — [supabase/migrations/20260411120000_follows.sql](supabase/migrations/20260411120000_follows.sql)

- **Table** `follows`: `(follower_id, following_id)` PK, `created_at`, FK to `profiles`, no self-follow.
- **RLS**: authenticated `SELECT` all rows; `INSERT` / `DELETE` only where `auth.uid() = follower_id`.

### Frontend

- **[src/hooks/useProfileSocialData.ts](src/hooks/useProfileSocialData.ts)** — counts + `isFollowing`, `toggleFollow` with **optimistic UI** and rollback on error; subscribes to **Realtime** on `follows` (`postgres_changes` `*`). Polish error for missing table (`42P01` / schema cache).
- **[src/components/FollowListsModal.tsx](src/components/FollowListsModal.tsx)** — followers/following lists via `follows` + `profiles` joins with FK fallback queries.
- **[src/components/profile/ProfileActionButton.tsx](src/components/profile/ProfileActionButton.tsx)** — follow/edit FAB and inline styles from `PROFILE_MOBILE`.

---

## Supabase schema from migrations

Dense per-file summary (execute order = filename). Tables referenced but **not created** in this folder (e.g. `profiles`, `posts`, `likes`, `comments`, `events`) are assumed from manual / legacy bootstrap ([supabase_setup.sql](supabase_setup.sql)) or remote DDL.

### [20260411120000_follows.sql](supabase/migrations/20260411120000_follows.sql)

- **Table**: `follows` — columns above; indexes on `following_id`, `follower_id`.
- **RLS**: `follows_select_authenticated`, `follows_insert_own`, `follows_delete_own`.
- **Realtime**: not added to `supabase_realtime` in this file.

### [20260411140000_profiles_username.sql](supabase/migrations/20260411140000_profiles_username.sql)

- **DDL**: `profiles.username` column.
- **RPC**: `handle_new_user()` — inserts profile with `username` from `raw_user_meta_data.username` or email local-part; **replaces** prior trigger body.

### [20260412120000_announcements.sql](supabase/migrations/20260412120000_announcements.sql)

- **Table**: `announcements` — `id`, `department`, `lecturer_name`, `body`, `status` (`cancelled` \| `remote` \| `duty`), `created_at`.
- **RLS**: `announcements_select_authenticated` (SELECT, authenticated, `USING (true)`).

### [20260413120000_announcements_realtime_fingerprint.sql](supabase/migrations/20260413120000_announcements_realtime_fingerprint.sql)

- **Columns**: `body_fingerprint` (unique, MD5 of body), backfill + dedupe.
- **Trigger**: `set_announcement_body_fingerprint` on INSERT/UPDATE OF `body`.
- **Realtime**: `REPLICA IDENTITY FULL`; `ALTER PUBLICATION supabase_realtime ADD TABLE announcements`.

### [20260414120000_announcements_source.sql](supabase/migrations/20260414120000_announcements_source.sql)

- **Column**: `announcements.source`.

### [20260415120000_lecturer_names_cache.sql](supabase/migrations/20260415120000_lecturer_names_cache.sql)

- **Table**: `lecturer_names_cache` (`original_name` PK, `nominative_name`, `updated_at`).
- **RLS**: `lecturer_names_cache_select_authenticated`.

### [20260423100000_manual_username_on_signup.sql](supabase/migrations/20260423100000_manual_username_on_signup.sql)

- **RPC**: `handle_new_user()` — **`username` inserted as `null`** (manual profile edit later); **replaces** again.

### [20260501120000_comments_parent_id_recursive.sql](supabase/migrations/20260501120000_comments_parent_id_recursive.sql)

- **Table** `comments` (existing): `parent_id` nullable, self-FK, indexes, `comments_parent_not_self` CHECK.
- **RLS** enabled; policies: `"Publiczne czytanie komentarzy"` SELECT `true`; `"Zalogowani moga dodawac komentarze"` INSERT `auth.uid() = user_id`.

### [20260508184000_replies_engagement_snapshot_rpc.sql](supabase/migrations/20260508184000_replies_engagement_snapshot_rpc.sql)

- **RPC**: `get_replies_engagement_snapshot(p_post_ids, p_reply_ids, p_viewer_id)` — stable; aggregates from `likes`, `comments`, **`comment_likes`**, **`comment_replies`** (see [Known drift](#known-drift)).

### [20260512014500_events_public_select_policy.sql](supabase/migrations/20260512014500_events_public_select_policy.sql)

- **Conditional**: if `public.events` **does not exist**, raises warning and skips.
- **Otherwise**: drops restrictive SELECT policies on `events`, creates `events_select_authenticated_all` (SELECT for `authenticated`, `USING (true)`). File also contains **diagnostic** `SELECT`s for discovery.

### [20260512120000_admin_moderation_rls.sql](supabase/migrations/20260512120000_admin_moderation_rls.sql)

- **RPC**: `is_profile_admin()` — `security definer`, `true` when `profiles.role = 'admin'` for `auth.uid()`.
- **RLS**: `comments_delete_own_or_admin` — DELETE when `user_id = auth.uid()` OR `is_profile_admin()`.

### [20260512135500_events_mutation_rls.sql](supabase/migrations/20260512135500_events_mutation_rls.sql)

- **Conditional** on `public.events`: enables RLS; `events_update_owner_only`, `events_delete_owner_only` (`auth.uid() = user_id`).

### [20260512140000_profiles_public_select.sql](supabase/migrations/20260512140000_profiles_public_select.sql)

- **Conditional** on `public.profiles`: enables RLS; `profiles_select_all` — **SELECT to `authenticated`**, `USING (true)`.

---

## Auth & RLS model

- **`handle_new_user` evolution**: [20260411140000_profiles_username.sql](supabase/migrations/20260411140000_profiles_username.sql) (username from metadata/email) → [20260423100000_manual_username_on_signup.sql](supabase/migrations/20260423100000_manual_username_on_signup.sql) (username **`null`**). Trigger attachment lives in [supabase_setup.sql](supabase_setup.sql) (`on_auth_user_created`), not in migrations.
- **`is_profile_admin()`**: [20260512120000_admin_moderation_rls.sql](supabase/migrations/20260512120000_admin_moderation_rls.sql); uses **`profiles.role`**.
- **Profiles SELECT**: migration [20260512140000_profiles_public_select.sql](supabase/migrations/20260512140000_profiles_public_select.sql) restricts policy to **`authenticated`** (not anonymous). Legacy [supabase_setup.sql](supabase_setup.sql) used `using (true)` without role — **drift** if both were applied differently.

---

## API surface

- **[api/scrape-wziks.ts](api/scrape-wziks.ts)** — Vercel Node handler (`export default`); scrapes ISI announcements, Groq optional for nominative names, upserts `announcements` + `lecturer_names_cache` with service-role Supabase client. Requires env vars (e.g. `GROQ_API_KEY`, Supabase URL + **service** key — see file).
- **[vercel.json](vercel.json)** — currently **`{ "version": 2 }`** only. Function routing/rewrites are **defaults** (API routes under `/api` map to `api/`). Document env secrets in deployment, not in repo.

---

## Known drift

- **`comment_likes`**, **`comment_replies`**, **`notifications`**, **`posts`**, **`events`**, **`media` storage**: used in app and/or RPC but **not created** in [supabase/migrations/](supabase/migrations/) (partial coverage in [supabase_setup.sql](supabase_setup.sql)).
- **`get_replies_engagement_snapshot`** references **`comment_likes`** / **`comment_replies`** — add migrations or remove RPC if tables are absent.
- **`profiles.role` / `is_banned`** — used in [src/App.tsx](src/App.tsx) and types; **`is_banned` not in migration folder** (may exist only in live DB).
- **[src/supabaseClient.ts](src/supabaseClient.ts)** — **hardcoded** project URL and anon key (rotate in Supabase if leaked; prefer env for new work).
- **Policy naming**: [supabase_setup.sql](supabase_setup.sql) also defines `profiles_select_all` but with **different role scope** than [20260512140000_profiles_public_select.sql](supabase/migrations/20260512140000_profiles_public_select.sql) — reconcile in DB.
- **Realtime**: only **`announcements`** added to publication in migrations; **`follows`**, **`likes`**, **`comments`**, **`comment_likes`**, **`notifications`** subscriptions in code may require matching **Supabase Dashboard → Realtime** settings.

---

## Glassmorphism, theme, Tailwind v4

- **Global CSS** [src/index.css](src/index.css): `@import "tailwindcss"`, `@custom-variant dark`, dense **`@theme { ... }`** block mapping design tokens, `@layer base` CSS variables for light/dark (glass borders, gold accents).
- **Theme toggle** [src/ThemeContext.tsx](src/ThemeContext.tsx) — toggles `document.documentElement` class `dark`, persists `uj-theme`, optional View Transitions API.
- **Cards** — [src/components/ui/BaseCard.tsx](src/components/ui/BaseCard.tsx) uses [src/styles/theme.ts](src/styles/theme.ts) (`theme.colors.surface.glass` = `backdrop-blur-md`, layered borders/shadows).
- **Profile mobile glass** — [src/styles/mobile-theme.ts](src/styles/mobile-theme.ts) `PROFILE_MOBILE.card.glassClass` (and related `glassLight` / `glassDark`) for profile shell blur/saturation.

---

## Services & adapters

- **[src/services/DataService.ts](src/services/DataService.ts)** — Facade: clubs, announcements (+ realtime subscribe), unified posts mapping, events adapter, **no raw `App` imports**.
- **Adapters** — [AnnouncementsAdapter.ts](src/services/adapters/AnnouncementsAdapter.ts), [PostsAdapter.ts](src/services/adapters/PostsAdapter.ts), [EventsAdapter.ts](src/services/adapters/EventsAdapter.ts), [ClubsAdapter.ts](src/services/adapters/ClubsAdapter.ts); common patterns in [BaseAdapter.ts](src/services/adapters/BaseAdapter.ts).
- **[src/services/EventIngestor.ts](src/services/EventIngestor.ts)** — separate ingestion path for events data.

---

## Types

- **[src/types/index.ts](src/types/index.ts)** — `Profile`, `Post`, `Comment`, `AppNotification` (legacy domain types).
- **[src/types/content.ts](src/types/content.ts)** — unified content model for feed/widgets (`UnifiedContent`, meta per kind).
- **[src/types/database.ts](src/types/database.ts)** — generated or hand-maintained DB typings (align with actual Supabase).

---

## Component dependency hotspots

| Component | Role |
|-----------|------|
| [BaseCard](src/components/ui/BaseCard.tsx) | All card shells; token-driven variants (`default` / `inner` / `premium`). |
| [UserAvatar](src/components/UserAvatar.tsx) | Shared avatar discipline across feed, profile, modals. |
| [PostCard](src/components/PostCard.tsx) | Post layout + interaction bar contract with App-owned state. |
| [FeedView](src/components/FeedView.tsx) | Feed composition, compose, department filter. |
| [Profile page](src/pages/Profile.tsx) | Profile orchestration; uses `useProfileData`, `useProfileSocialData`, `FollowListsModal`. |
| [Header](src/components/Header.tsx) / [BottomNav](src/components/BottomNav.tsx) | Global navigation; `myProfile` / view callbacks. |
| [ComposeBox](src/components/ComposeBox.tsx) | Create post; storage upload path from App. |
| [CommentThread](src/components/CommentThread.tsx) / [CommentItem](src/components/CommentItem.tsx) | Threaded comments + likes. |

---

*Last validated against migration files and sources in repo root `C:\Users\frani\ujverse`.*

# UJverse — przegląd projektu

> Prezentacja: wizja, architektura i pełna lista funkcjonalności.

---

## 1. Czym jest UJverse

**UJverse** to nowoczesna, dedykowana platforma społecznościowa dla społeczności akademickiej UJ. Łączy w jednym miejscu funkcje social media (feed, profile, komentarze, powiadomienia), oficjalne kanały informacyjne UJ (komunikaty ISI, wydarzenia, koła naukowe) oraz asystenta AI rozumiejącego kontekst uczelni.

- **Cel:** Chronologiczny, akademicki feed bez algorytmów — alternatywa dla rozproszonych źródeł (USOS, PEGAZ, ISI, social media).
- **Wyróżnik:** Real-time UX (Supabase Realtime), wbudowany czat z LLM (Groq + Function Calling), automatyczny scraping komunikatów ISI UJ oraz „glassmorphism" w warstwie UI.

---

## 2. Tech stack

### Frontend
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4 (z `@theme` w `src/index.css`)
- React Router DOM 7 (custom routing hybrid: `useLocation` + `activeView`, bez `<Routes>`)
- `framer-motion` (animacje), `lucide-react` + `@heroicons/react` (ikony)
- `zustand` (store czatu), `react-easy-crop` (kadrowanie), `leaflet` + `react-leaflet` (mapa)
- `react-markdown` + `remark-gfm` (renderowanie wiadomości AI)
- `@meilisearch/instant-meilisearch` + `react-instantsearch` (wyszukiwanie)

### Backend / BaaS
- **Supabase**: PostgreSQL + Auth + Storage + Realtime + RLS
- **Supabase Edge Functions** (`sync-search`) — replikacja do Meilisearch
- **Meilisearch** — wyszukiwarka pełnotekstowa (indeksy: `ujverse_content`, `ujverse_users`)

### Vercel (Serverless)
- `api/chat.ts` — Edge orchestrator AI (Groq + Function Calling + cache w Vercel KV)
- `api/scrape-wziks.ts` — cron scraping komunikatów ISI UJ (+ LLM do parsowania nazwisk wykładowców)
- `api/sync-search.ts` — webhook fallback do Meilisearch
- `@vercel/analytics`, `@vercel/kv`

### LLM
- **Groq** (`llama-3.1-8b-instant`) — przez własny `GroqProvider`
- **Function Calling po stronie serwera** — model sam decyduje, kiedy sięgnąć po świeże dane

---

## 3. Architektura wysokopoziomowa

```
┌──────────────────── UI (React) ─────────────────────┐
│  App.tsx (właściciel session / feed state)          │
│  ├─ Routing hybrydowy (useLocation + activeView)    │
│  ├─ Header / BottomNav / OmniSearchHub              │
│  ├─ Widoki: Feed · Events · Profile · Notifications │
│  │           · Search · Group · SinglePost · Chat   │
│  └─ Komponenty wspólne (BaseCard, Glass, PostCard…) │
└────────────────────────┬────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   DataService       │  ← jedyne wejście UI do danych
              │   + Adaptery        │
              │     (Posts, Events, │
              │      Announcements, │
              │      Clubs, Notifs) │
              └──────────┬──────────┘
                         │
   ┌─────────────────────┼────────────────────────────┐
   │ Supabase            │ Meilisearch     │ LLM API  │
   │ (Postgres + Auth +  │ (Search index)  │ /api/chat│
   │  Realtime + RLS)    │                 │ → Groq   │
   └─────────────────────┴─────────────────┴──────────┘
                         ▲
              Scrapery / cron / webhooks
              (api/scrape-wziks, sync-search,
               supabase/functions/sync-search)
```

### Najważniejsze zasady architektoniczne
1. **`App.tsx`** jest właścicielem `session`, `myProfile` i stanu interakcji z feedem — brak osobnego AuthContext.
2. **Brak `<Routes>`/`<Route>`** — routing to hybryda `useLocation` + `navigate` + `activeView`.
3. **Shadow login** — username mapowany na `{user}@ujverse.test` dla Supabase email auth.
4. **`DataService` + adaptery** to jedyne wejście do danych dla UI — komponenty nie importują bezpośrednio `supabase` poza `App.tsx`.
5. **Tailwind v4** z globalnymi tokenami w `src/index.css` (zmienne CSS, klasa motywu na `<html>` przez `ThemeContext`).

---

## 4. Lista wszystkich funkcji

### A. Społeczność / Feed
- **Chronologiczny feed postów** (`FeedView.tsx`, `PostCard.tsx`).
- **Tworzenie postów** ze zdjęciem (`ComposeBox.tsx`) + upload do Supabase Storage.
- **Hashtagi / Smart Tags** — `#ankieta`, `#pomoc` itd. automatycznie wyciągane z treści, klikalne, indeksowane.
- **Lajki** z optymistycznym UI i animacją „heart pop".
- **Wątki komentarzy z odpowiedziami** (jednopoziomowe nesting).
- **Lajkowanie komentarzy** + licznik (RPC `get_replies_engagement_snapshot`).
- **Strefy / Grupy** (`/groups/:slug`) — automatyczne przypisywanie postów do grup po tagach (DB trigger).
- **Strefy oficjalne**: Ankiety, Ogłoszenia, Pomoc, Praca, Wydarzenia, Nauka, Sport, Kultura, Inicjatywy.
- **Trending Groups** — top strefy z ostatnich 7 dni.
- **Pojedynczy post** (`/thread/:id`) — deep link do dyskusji.
- **Filtrowanie po wydziale**.
- **Realtime feed** — Supabase Realtime na `posts`, `likes`, `comments`.

### B. Profile użytkowników
- **Profil publiczny** (`/profile/:handle`).
- **Edycja profilu** (`ProfileModal.tsx`) — avatar, banner, bio, wydział, username.
- **Cropper zdjęć** — aspect 16:9 dla bannera, kwadrat dla avatara.
- **Zakładki profilu**: Wpisy, Odpowiedzi, Wydarzenia, Multimedia.
- **System obserwacji (follows)** — optymistyczny `toggleFollow` z rollbackiem + Realtime.
- **Modal listy obserwowanych / obserwujących** (`FollowListsModal.tsx`).
- **Badges / odznaki** — wydział, rola.
- **`ProfileFab`** — pływający przycisk akcji z `layoutId` (Framer Motion morph inline ↔ fixed).
- **Skeleton ładowania**.

### C. Wydarzenia
- **Lista i kalendarz wydarzeń** — filtry: Wszystkie / Moje / Oficjalne / Wydarzenie / Wydział / Ogłoszenie.
- **Tworzenie wydarzenia** — tytuł, data, kategoria, opis, lokalizacja z mapy.
- **Picker lokalizacji** — interaktywna mapa Leaflet (Kampus UJ jako default), pin + link Google Maps.
- **Plakat wydarzenia** — upload zdjęcia jako Data URL.
- **RSVP** — uczestnictwo + avatary uczestników.
- **Import wydarzeń z UJ** (`EventIngestor.ts`):
  - `https://wziks.uj.edu.pl/wiadomosci/aktualnosci`
  - `https://www.uj.edu.pl/wiadomosci`
  - `https://www.uj.edu.pl/wiadomosci/kalendarz`
  - Cache w localStorage (TTL 15 min) + fallback statyczny.
- **Eksport do Google Calendar**.
- **WZiKS Official Hub** — pozioma karuzela oficjalnych wpisów UJ.
- **Deep link** do konkretnego eventu.

### D. Komunikaty akademickie (ISI UJ)
- **Automatyczny scraping** `https://isi.uj.edu.pl/studenci/news/komunikaty`.
- **LLM-driven normalizacja nazwisk wykładowców** do mianownika (Groq, fallback do surowych).
- **Klasyfikacja statusu**: `cancelled` / `remote` / `duty`.
- **Deduplikacja** przez `body_fingerprint = md5(body)` (DB trigger).
- **Widget bocznego paska** (`AcademicAnnouncementsWidget.tsx`).
- **Drawer + Pills** — szybki dostęp z mobile.
- **Filtr „okno aktywności"**.
- **Realtime** — nowy komunikat ląduje w widgetcie bez refresh.

### E. Powiadomienia
- **Real-time notifications** (Supabase Realtime).
- **Typy**: `like` / `comment`.
- **Persystencja `is_read`** w bazie (RLS na `auth.uid()`).
- **NotificationPanel** (desktop dropdown), **NotificationSheet** (mobile bottom-sheet), **NotificationPopup** (toast).
- **„Mark all read"** + **„Clear all"**.
- **Pełny widok** (`/notifications`).
- **Animacja „dzwonka"** w Headerze przy nowym powiadomieniu.

### F. Wyszukiwanie (Search)
- **Meilisearch** jako silnik — indeksy `ujverse_content` (posty + komunikaty) i `ujverse_users` (profile).
- **OmniSearchHub** (desktop) — 6 zintegrowanych systemów:
  1. Dynamiczny dropdown „search-as-you-type" (debounce 180 ms, limit 5/sekcja)
  2. Globalna paleta `Ctrl/Cmd+K` + nawigacja klawiszowa
  3. Smart hints („Może szukasz?")
  4. Recent searches (max 3 z localStorage)
  5. **Slash-komendy**: `/p` (posty), `/k` (komunikaty), `/ciemny`, `/jasny`
  6. AbortController + cache 120 s
- **Mobile**: full-screen `SearchBar.tsx` + `SearchModal.tsx`.
- **Pełny widok wyników** — filtry: Wszystko / Posty / Komunikaty / Użytkownicy / Wydarzenia / Multimedia.
- **Wyszukiwanie po tagach** (`#ankieta` → filter `tags = "ankieta"`).
- **Synchronizacja do Meili**: webhook Postgresa → `api/sync-search.ts` oraz Supabase Edge Function `sync-search`.

### G. Asystent AI (UJverse Chat)
- **Inline „wyspa" w feedzie** (`ChatAssistant.tsx`).
- **FAB + bottom-sheet na mobile/tablet** (`ChatAssistantFab.tsx`).
- **Wspólny store** (`useChatStore` w Zustand) → historia widoczna w obu powierzchniach.
- **Streaming SSE** (OpenAI-compatible delta) + `AbortController`.
- **Server-side Function Calling**:
  - `getLatestAnnouncements` — najnowsze komunikaty ISI
  - `getLatestPosts` — najnowsze posty z feedu
  - `searchEvents` — wyszukiwanie wydarzeń
- **Single-shot tool flow** — bez drugiego round-tripu do LLM (~50% mniej tokenów).
- **Persona** (`UJVERSE_SYSTEM_PROMPT`) wstrzykiwana przez `withPersona`.
- **Cache w Vercel KV** (TTL 300 s) — przeżywa cold-starty.
- **Token Budgeting** (`MAX_HISTORY_MESSAGES = 10`).
- **Markdown Guard** — bramka wykrywająca wyciek surowego JSON-a / schematu tool-call.
- **Rate-limit handling**.
- **Logi zużycia tokenów** (tabela `api_usage_logs`).

### H. Koła naukowe / Niezbędnik UJ
- **Widget kół naukowych** + **modal**.
- **Niezbędnik UJ** — szybkie linki do **USOSweb**, **PEGAZ**, **Poczty studenckiej**.
- **MobileDashboard** — pojedynczy poziomy rail mobilny łączący Niezbędnik + Strefy + Pigułki komunikatów.

### I. Moderacja / Bezpieczeństwo
- **Row Level Security (RLS)** na każdej kluczowej tabeli.
- **Admin gate** — `is_profile_admin()` czyta `profiles.role === 'admin'`.
- **Globalny ban konta** (`profiles.is_banned`) — wpisy zbanowanych filtrowane.
- **Zgłaszanie treści** — powody: Spam / Nękanie / Nieodpowiednie / Prawa autorskie / Inne.
- **ConfirmModal** dla destrukcyjnych akcji.
- **ViewErrorBoundary** — łapanie błędów per-widok.

### J. UX / Wizualne smaczki
- **Dark / Light mode** (slash-komenda `/ciemny`, `/jasny`).
- **Glassmorphism** — `BaseCard.tsx` + tokeny w `src/styles/theme.ts` / `mobile-theme.ts`.
- **Framer Motion** — `layoutId` (morph FAB ↔ inline button), `useReducedMotion`.
- **Toasts** (`react-hot-toast`).
- **Mobile-first**: `BottomNav.tsx`, `MobileQuickAccessBar.tsx`, dedykowane bottom-sheety.
- **Skeleton loaders**.
- **Image Lightbox** (full-screen przez React Portal).
- **HorizontalPillScroller** — wspólny komponent karuzeli pigułek.

### K. Autoryzacja / Sesja
- **Supabase Auth** (email/password) z **shadow login**: `username` → `username@ujverse.test`.
- Widoki: Login / Sign-up / Forgot password.
- **Reset hasła** (`/reset-password`).
- **Trigger `handle_new_user`** — auto-tworzenie wiersza w `profiles` po signup.

---

## 5. Mapa modułów

### `src/components/`
- **Wspólne**: `Header`, `BottomNav`, `BaseCard`, `Skeleton`, `HorizontalPillScroller`, `EmptyState`, `ConfirmModal`, `ReportModal`, `ViewErrorBoundary`, `UserAvatar`, `ImageCropper`(+Modal), `LocationPicker`
- **Feed**: `FeedView`, `FeedFilters`, `DepartmentFilter`, `PostCard`, `ComposeBox`, `CommentThread`, `CommentItem`, `Greeting`, `SinglePostView`
- **Profile**: `pages/Profile.tsx` + `profile/{ProfileHero, ProfileIdentity, ProfileTabs, ProfileTabPanel, ProfileSkeleton, ProfileActionButton, ProfileFab, BadgeDock, FacultyAccent}` + panels `{PostsPanel, RepliesPanel, EventsPanel, MediaPanel, PostList}`
- **Wydarzenia**: `EventsView`, `events/EventCard`, `CreateEventModal`, `EventModal`, `CompactEventRow`
- **Komunikaty**: `AcademicAnnouncementsWidget`, `AnnouncementDrawer`, `AnnouncementPills`, `announcements/AnnouncementCard`, `WziksOfficialHub`
- **Powiadomienia**: `NotificationsView` + `notifications/{NotificationPanel, NotificationList, NotificationItem, NotificationPopup, NotificationSheet}`
- **Search**: `OmniSearchHub`, `SearchBar`, `SearchModal`, `SearchPageView`, `HeaderSearchTrigger` + `search/{SearchDashboard, SearchResultRow, SearchUserResultRow}`
- **Chat AI**: `chat/{ChatAssistant, ChatAssistantFab, MessageList}`
- **Grupy/Strefy**: `GroupView`, `GroupCard`, `GroupNav`, `GroupsIndexView`, `ZoneHeader`, `StrefySectionHeader`
- **Mobile**: `mobile/MobileDashboard`, `MobileQuickAccessBar`
- **Inne**: `ClubsModal`, `StudentClubsWidget`, `Niezbednik`, `ProfileModal`, `SettingsView`

### `src/services/`
- `DataService.ts` — facade (jedyne wejście dla UI)
- **Adaptery**: `PostsAdapter`, `EventsAdapter`, `AnnouncementsAdapter`, `ClubsAdapter`, `NotificationsAdapter`, `BaseAdapter`
- `PostService.ts`, `GroupService.ts`, `SearchService.ts`, `TagService.ts`
- `EventIngestor.ts` — silnik importu wydarzeń z UJ
- **AI**: `ai/{LLMService, BielikAdapter, ContextInjectedBielikAdapter, SystemPrompt}`

### `src/hooks/`
- Dane: `useContent`, `useEvents`, `useGroups`, `useTrendingGroups`, `useOfficialTags`
- Profile: `useProfileData`, `useProfileSocialData`
- Search: `useOmniSearch`, `useContentSearch`
- Chat: `useChatSend`
- UI: `useScrollY`, `useMediaQuery`

### `src/lib/`
- Sanityzacja: `sanitizer`, `lecturerDisplayName`, `normalizeSearchHits`
- Komunikaty: `announcementBranding`, `announcementRecency`, `announcementStatusStyles`, `searchAnnouncement`
- Posty: `postTags`, `formatPostCount`, `formatXNumber`
- Search: `meilisearchClient`, `searchCommands`, `searchHints`, `searchHistory`
- Inne: `appToast`, `cropImage`, `channelPresentation`, `departments`, `eventRow`, `groupPaths`, `interactionBar`, `sidePanelStyles`, `zoneListUi`, `utils`

### `api/` (Vercel Serverless)
- `chat.ts` — AI Edge orchestrator
- `scrape-wziks.ts` — cron scraper komunikatów ISI
- `sync-search.ts` — webhook → Meilisearch
- `_lib/`: `GroqProvider`, `supabaseAdmin`, `auth`, `kvCache`, `cache`, `llmService`, `tokenUsage`, `types`, `utils/markdownGuard`, `tools/{registry, getLatestAnnouncements, getLatestPosts, searchEvents}`

### `supabase/migrations/` (24 migracje)
Bootstrap, follows, profiles+username, announcements (+ realtime + source + lecturer cache), comments (parent_id), engagement RPC, events (RLS + select policy), admin moderation, notifications RLS, search webhooks (×3), posts tags (+ RLS), group_memberships, group triggers, groups+zones, api_usage_logs.

---

## 6. Pomysły na slajdy demo

1. **„Co rozwiązujemy"** — fragmentacja informacji na UJ (USOS, PEGAZ, ISI, FB).
2. **Architektura** — diagram z sekcji 3.
3. **Live demo: feed + post + komentarz + powiadomienie** — real-time między dwoma przeglądarkami.
4. **AI Assistant** — „pokaż najnowsze komunikaty z WZiKS" → model wywołuje `getLatestAnnouncements`.
5. **OmniSearch** — `Ctrl+K`, slash-komenda `/p ankieta`, hashtag `#pomoc`.
6. **Komunikaty ISI** — automatyczny scraper + LLM normalizacja nazwisk.
7. **Tech highlight** — Single-shot tool flow, KV cache, optymistyczny UI, RLS.
8. **Roadmap** — cursor-based pagination, DM-y, hashtag discovery, bookmarki.

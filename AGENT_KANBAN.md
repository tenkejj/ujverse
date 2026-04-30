# Agent Kanban - UJverse

## Ostatni Audyt
- **Status:** Zakończony (analiza raportu `docs/ARCHITECTURE_AUDIT_UJVERSE.md` z brancha `cursor/architecture-audit-ujverse-ebb6`)
- **Data:** 2026-04-30
- **Cel:** Wdrożenie poprawek wydajnościowych i naprawa logiki synchronizacji stanów.

---

## Krytyczne poprawki (P0/P1)

- [ ] **Naprawa dublowania liczników obserwujących (P0-1):** Optymistyczne UI w `toggleFollow` (`useProfileSocialData`) nakłada się na Realtime `INSERT` na `follows` — drugi `setFollowersCount(prev => prev + 1)` daje **+2**. Wprowadzić deduplikację / pominięcie Realtime dla własnego followu już odzwierciedlonego optymistycznie albo jedno źródło prawdy po zakończeniu mutacji (`fetchCounts`). Weryfikacja: jeden follow na cudzym profilu vs stan DB i licznik przy włączonym Realtime.

- [ ] **Anulowanie nieaktualnych zapytań i race przy przełączaniu profili:** Audyt (P1-1): przy A→B odpowiedź `fetchCounts` dla A może nadpisać liczniki B — dodać **`AbortController` lub monotoniczny `requestId`** przy batchu `fetchCounts` w `useProfileSocialData`. Osobno (P1-2): w **`useProfileData`** zastąpić zależność `[userId, initialProfile]` stabilnym kluczem (np. `initialProfile?.id`), żeby uniknąć zbędnych refetchy przy nowej referencji obiektu z rodzica (istniejący `cancelled` zostaje; pełny Abort przy rozrostcie fetchy — według potrzeb).

- [ ] **Uszczelnienie subskrypcji Realtime w `App.tsx` (i profilu):** Subskrypcja `follows` bez `filter` (P0-2) — zdarzenia dla wszystkich par follow wywołują handler na każdej otwartej wizycie profilu. Dodać filtry Realtime (np. `following_id` / `follower_id` dla oglądanego kontekstu) lub zwęzić publikację. W `App.tsx` zweryfikować zakres kanałów dla `likes` / komentarzy: szerokie `postgres_changes` + refetch likes dla całej listy `postIds` przy każdej zmianie → ryzyko zbędnych aktualizacji całego drzewa; ograniczyć zakres zdarzeń lub strategię odświeżania.

---

## Optymalizacje i Refaktor (P2)

- [ ] **Optymalizacja fan-out w `fetchRepliesWithPostContext` (`Profile.tsx`):** Zamiast wielu równoległych zapytań per odpowiedź użytkownika (P1-3), rozważyć RPC / funkcję SQL / widok materializowany z kartami wątków lub denormalizację agregatów — redukcja O(replies × tabele) round-tripów.

- [ ] **Unifikacja FacultyAccent (P2-2):** Zastąpienie ad hoc klas Tailwind (`slate`, `zinc`, `brand-gold`) na Feed / Compose / CommentThread / Settings i mobilnym compose w `App.tsx` tokenami spójnymi z `FacultyAccent` / `--profile-*` albo udokumentowany wyjątek „tylko chrome profilu” — według decyzji designu.

---

## Gotowe
- [x] Twardy reset środowiska lokalnego do stabilnego origin/main.
- [x] Odtworzenie struktury planowania na bazie audytu Cloud Agent.

---

*Źródło priorytetów: `docs/ARCHITECTURE_AUDIT_UJVERSE.md` na branchu `cursor/architecture-audit-ujverse-ebb6` (data raportu audytowego: 2026-04-29).*

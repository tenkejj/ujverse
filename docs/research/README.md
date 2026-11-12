# Badania UJverse — przygotowanie po audycie

Stan: 11 listopada 2026. **Materiały i narzędzie pomiaru są przygotowane. Nie zrekrutowano uczestników, nie przeprowadzono wywiadów i nie ma wyników pilotażu.** Nikomu nie wysłano zaproszeń.

Celem jest sprawdzenie, czy student znajdzie informację potrzebną do konkretnego działania, potrafi ocenić jej źródło i sam wróci do serwisu. Ocena wyglądu jest pytaniem pomocniczym, nie głównym wynikiem.

1. [Wywiady z 15–20 studentami](interviews.md): problemy, ostatnie prawdziwe sytuacje, obecne sposoby radzenia sobie.
2. [Pilotaż z 30–50 studentami](pilot-protocol.md): dwa lub trzy wydziały, zadania bez podpowiedzi, pomiar źródła i tygodniowego powrotu.
3. [Zgoda i zarządzanie danymi](consent.md): osobno udział w rozmowie, ewentualne nagranie i dobrowolny pomiar lokalny.
4. Puste arkusze [uczestników](participants-template.csv) i [obserwacji zadań](task-observations-template.csv). Nie zawierają przykładowych, udawanych uczestników.

Przed rekrutacją właściciel projektu wybiera prowadzącego, potwierdza aktualne zadania i źródła oraz ustala sposób dobrowolnego przekazania raportów. Zaproszenia i kontakt wymagają jego osobnej decyzji; przygotowanie tych plików nie oznacza zgody na automatyczne wysyłanie wiadomości.

**Pomiar w aplikacji**

Opcjonalny panel „Pomóż sprawdzić UJverse” zapisuje na urządzeniu po świadomej zgodzie: dni odwiedzin, liczniki kliknięć źródeł i czas od rozpoczęcia zadania do pierwszego kliknięcia źródła. Uczestnik może pobrać JSON i sam zdecydować, czy go przekazać. Pomiar nie wysyła danych automatycznie i nie wymaga nowej usługi, konta ani klucza.

To obserwacja **jednej przeglądarki na jednym urządzeniu**, nie identyfikacja osoby. Zmiana urządzenia, usunięcie pamięci, blokada zapisu lub odmowa zgody ograniczają dane. Nie wolno przedstawiać liczby przeglądarek jako liczby unikalnych studentów ani ogólnych zdarzeń analitycznych jako ukończonych formalności.

Kod: `src/lib/info/productMetrics.ts`, panel: `src/components/info/PilotParticipation.tsx`. Funkcje integracyjne:

- `recordPilotVisit()` na wejściu do publicznego widoku (dzień deduplikowany w Europe/Warsaw).
- `recordUsefulSourceOpen(kind)` wyłącznie przy aktywacji konkretnego linku źródłowego; dozwolone kategorie: `registration`, `announcement`, `event`, `guide`, `tool`, `radar`.
- `startPilotTask(task)` rozpoczyna pomiar zadania wybranego przez uczestnika; maksymalnie 50 prób w jednym lokalnym raporcie.
- `exportPilotMetrics()` zwraca wyłącznie dozwolone pola. Nie zapisuje adresów URL, tekstów pytań/wyszukiwań, danych konta, kierunku, informacji finansowych lub zdrowotnych ani identyfikatora osoby.
- `setPilotParticipation(false)` usuwa lokalny pomiar i oczekujące zadanie. Dane starsze niż 28 dni są odrzucane i usuwane przy następnym odczycie panelu.

Istniejąca ogólna analityka strony jest osobnym mechanizmem. Panel nie powinien sugerować, że wyłączenie pilotażu automatycznie zmienia wszystkie pozostałe ustawienia analityczne serwisu.

**Czego te pliki nie dowodzą**

Nie ma jeszcze potwierdzenia potrzeb, skuteczności ani dopasowania produktu do rynku. Badania z audytu i pojedyncze wypowiedzi są przesłankami do hipotez. Wyniki Barometru Satysfakcji Studenckiej i oficjalnych badań UJ należy sprawdzić oddzielnie, z datą, populacją i metodą; nie zastępują rozmów z odbiorcami pilotażu.

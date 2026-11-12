# „Nie przegap”: pierwszy zakres radaru spraw

Radar przekłada potwierdzone metadane na krótkie działanie, z oficjalnym linkiem i widocznym znaczeniem daty. Nie tworzy obowiązków z tekstu ani streszczenia AI.

Do radaru trafiają:

- Trwające rejestracje z identyfikatorem tury USOSweb oraz rozpoczynające się w ciągu siedmiu dni. Zakończone i niepoprawne zakresy odpadają.
- Komunikaty ze źródłowym statusem odwołania lub trybu zdalnego, dodane w ciągu ostatnich 72 godzin. Komunikat nie oznacza automatycznie zmiany osobistego planu.
- Wyłącznie rekordy z jawnym odnośnikiem HTTPS do domen UJ lub Collegium Medicum. Nie ma przekierowania na dowolny zewnętrzny adres.

Termin rejestracji jest pokazywany jako data i godzina w Europe/Warsaw. Pilność wymaga świeżego potwierdzenia rekordu oraz zgodności z ostatnim przebiegiem źródła. Nieaktualne dane otrzymują akcję „Potwierdź termin rejestracji”, bez kolorystycznego komunikatu pilności. Czas dodania komunikatu jest opisany jako dodanie do UJverse, a nie czas opublikowania lub termin wykonania.

Wybrany wydział zawęża wyniki zgodnie z istniejącą mapą wydziałów. Brak wyboru nie tworzy pozornej personalizacji — pokazuje sprawy z różnych wydziałów i zachęca do zawężenia. Rejestracja wydziałowa nadal wymaga sprawdzenia kierunku, roku i etapu studiów w USOSweb; sam radar nie stwierdza uprawnienia do zapisów.

Przycisk „Sprawdzone” zapisuje na urządzeniu potwierdzenie sprawdzenia danej informacji. Nie potwierdza zapisu na zajęcia lub złożenia wniosku. Zmieniony termin, tytuł, status albo treść komunikatu tworzą nowy identyfikator sprawy; zwykłe odświeżenie czasu potwierdzenia tego nie robi. Oznaczenia mają osobny wersjonowany magazyn `ujverse.radarChecks.v1`, maksymalnie 100 wpisów, synchronizację między kartami i awaryjne działanie w pamięci przy niedostępnym localStorage. Nie przechowują treści źródeł ani danych konta.

Na tym etapie radar nie przypisuje stypendiów, podań ani obowiązkowych formalności na podstawie słów kluczowych. Rozszerzenie wymaga jawnych, ręcznie zweryfikowanych reguł i terminów w źródłach. Przewodniki mogą prowadzić przez te procesy niezależnie od automatycznego radaru.

Komponent `ActionRadar` przyjmuje dane i stany błędu/ładowania obu domen. Nie ukrywa problemu pobrania pod komunikatem „brak spraw”. Opcjonalne `onActionOpen` i `onComplete` pozwalają warstwie pilotażowej rejestrować użyteczne akcje bez wysyłania tytułów lub danych konta.

Weryfikacja: 15 przypadków logiki i trwałości stanu w `tests/info-action-radar.test.ts`: oficjalne domeny i podobne fałszywe adresy, świeżość, przyszłe znaczniki czasu, błędne terminy, wydziały, brak domniemanych obowiązków stypendialnych, deduplikacja, zmiany terminów i treści oraz wersjonowany, ograniczony magazyn. Polecenie: `node --import tsx --test --test-isolation=none tests/info-action-radar.test.ts`. Oględziny pełnego dashboardu wykonuje integracja; nie jest to badanie potrzeb studentów.

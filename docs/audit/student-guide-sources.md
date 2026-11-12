# Procedural guide sources — editorial review 11 November 2026

The three guides in `src/lib/info/guides.ts` are public editorial checklists, not inferred personal obligations. The review date means the source pages were read, not that USOS records were fetched, faculty staff approved the guide or a student's application was submitted. No personal data is stored: local progress is a filtered set of current step ids. Guide text older than 90 days receives a review notice.

## Stypendium rektora

- [UJ: stypendium rektora](https://stypendia.uj.edu.pl/pomoc-materialna/stypendium-rektora) — audience, separate first-year conditions, weighted-average verification, evidence for achievements, general 20 October deadline and the first-year exception. The guide explicitly states that the normal 2026/27 deadline is past; it does not promise eligibility, an award, points, payout or an appeal outcome.
- [UJ: applications for benefits](https://stypendia.uj.edu.pl/pomoc-materialna/wnioski) — electronic submission with “Podpisz i złóż elektronicznie”, no extra printout for such submission, original electronic documents, scanned paper documents and multi-page files. Saving a draft is not presented as submission.
- [Dział Spraw Stypendialnych](https://dydaktyka.uj.edu.pl/centrum/dssp) — first contact via the student's coordinator in USOSweb → Dla studentów → Obsługa; CM scholarship administration is also described there. [Contact page](https://stypendia.uj.edu.pl/kontakt) confirms use of the university email account.

## Akademik

- [Official accommodation portal](https://akademiki.uj.edu.pl/) — separate applicant groups and a separate CM path.
- [How to apply](https://akademiki.uj.edu.pl/studenci/aplikacja) — electronic USOSweb application, applicant form, room preferences, coordinator review and comments in the application.
- [2026/27 schedule](https://akademiki.uj.edu.pl/studenci/harmonogram) — different applicant groups and explicit exclusion of Collegium Medicum. No group-specific cutoff is assigned to a user automatically.
- [During-year applications](https://akademiki.uj.edu.pl/studenci/aplikacja-srodroczna) — starts 15 September 2026, availability-dependent allocation and electronic applications. This is not a guaranteed currently available room.
- [After allocation](https://akademiki.uj.edu.pl/studenci/wyniki) — allocation details, reservation fee deadline and bank details from residence administration, referral validity. The guide copies no bank account, price or universal payment deadline.
- [CM procedure](https://sdka.cm.uj.edu.pl/pl/akademiki/) — destination linked by the official accommodation portal. The managed fetch returned 403; its content is not used as evidence for CM procedure. The UI links there and says that the non-CM schedule does not apply.

## USOS registrations

- [USOSownia UJ: registrations](https://usosownia.uj.edu.pl/usosweb/dla-studentow/rejestracje) — registration types, private calendar of permitted registrations, unit schedules, direct versus staged group assignment and contact with the dean's office if access is missing.
- [USOSownia UJ: attachments](https://usosownia.uj.edu.pl/podpiecia) — regular attachment of courses and dependence on the programme/current university rules. The guide gives no universal attachment deadline.

## Official support links

- [First-year UJ guide](https://rekrutacja.uj.edu.pl/studia-i-stopnia/witaj-na-i-roku).
- [Stay With UJ](https://staywithuj.uj.edu.pl/) — official university support/adaptation project; no claim that UJverse is part of it.
- [SOWA contact](https://sowa.uj.edu.pl/skontaktujsieznami) — appointment instructions. The app links to the service rather than offering treatment or maintaining a copied time-sensitive emergency phone number.

The old `studiuje.uj.edu.pl` routes from older documents were unavailable/404 during this review, so the implementation uses the current official `stypendia.uj.edu.pl` and `akademiki.uj.edu.pl` portals. Financial/legal procedural edge cases remain with the official coordinator and current regulations.

Verification: focused guide data tests cover evidence-link integrity, official HTTPS domains, schema-safe local progress, unknown guide slugs, stale source-review dates and CM separation. Browser integration and production build are handled in the parent task after routing is integrated.

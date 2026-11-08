# Campus workspace refinement — 8 November 2026

This iteration uses the **actual UI Skills MCP connection**, now available in the conversation. The following skills were fetched through `ui_skills.get_skill` after registry discovery:

- [interface-design](https://www.ui-skills.com/skills/dammyjay93/interface-design): one primary AI task, a distinct calendar interaction, existing tokens and purposeful proportions.
- [better-layout](https://www.ui-skills.com/skills/jakubkrehel/better-layout): shared edges, explicit controls, logical reading order, responsive grouping and space below sticky chrome.
- [better-ui](https://www.ui-skills.com/skills/jakubkrehel/better-ui): semantic icons, restrained accent borders, clear states and motion preferences.

The previous note about unavailable MCP tools describes the earlier November 7 session and does not apply to this iteration.

## Visual direction

The student workspace uses the original navy/gold/neutral themes, system font and UJverse logo. The heading is now **Co słychać na UJ?**. More icons and structural boundaries improve scanning, while colour marks meaningful actions, dates and selection. The sidebar is 224 px instead of 288 px and the main content can use 1120 px. The faculty strip shares that width; its reserved 80/88 px heights remain unchanged.

Versuś has a small, distinct identity area beside its question workspace. The companion is an original smooth, hairless rounded scholar with clear round prescription glasses and a book. It retains the 96×96 pixel-art set, all seven activities, small portraits and PNG/WebP/GIF formats. Both system and app reduced-motion preferences still select PNG; animations play one short cycle. The main UJverse logo is unchanged.

The footer and information categories use one Lucide icon style, small tonal icon fields and quiet borders. Two news/deadline previews remain bounded; category selection, hidden sections, saved items and original source links are preserved.

## Interactive calendar

The same calendar is reused on Start and the events page. Start's **Kalendarz** category replaces the old two-item event list. The events page defaults to the calendar; `?widok=lista` opens the list, while `?widok=kalendarz` remains supported.

Selecting dates updates a source-backed daily agenda. Month navigation, Today and nearest-event actions preserve the other query parameters. `miesiac` and `dzien` persist meaningful state. Arrow keys, Home/End and PageUp/PageDown move the selected date and focus. Selected day, today and days with events have static cues. Real event counts and source links are used; event times are not invented.

## Visible data timing

`DataFreshness` is placed above the relevant information rather than only in the footer, on Start and the announcement/registration/events pages. All timestamps use Europe/Warsaw and display a date and hour.

- Announcements: `freshness.latest` is the latest `created_at`, meaning **added to UJverse**, not a source publication time or last scraper run. The existing schema has no reliable last-check timestamp for announcement sources. `full_body_fetched_at` can record failed attempts and is not reused for this purpose.
- Registrations: latest `updated_at` records a confirmation of registration data by the USOS scraper. It does not promise every unit was checked at that exact time.
- Events: latest `scraped_at` records source ingestion of event data.
- **Dane w UJverse sprawdzono** separately uses TanStack Query `dataUpdatedAt`, the successful read into the browser cache. It does not claim the university site was scraped again.

Loading, source errors, unknown times and stale registration data have explicit text. Announcement placeholders suppress old faculty timestamps until the new query completes. No database changes or invented timestamps are introduced.

## Header and existing settings

The existing Settings view was found in history (`dbd2063` already retains its route and header callback). A visible header action restores access beside theme and login. Guests see local Appearance, Data and About sections; account/profile/studies/AI memory require authentication. Settings remount on identity change so password/form state is not retained between accounts.

The original logo is centred on the viewport axis. Measured desktop geometry at 1440 px has its button centre at 720 px; at 320/390/768 px the centre is 160/195/384 px. Header actions do not overlap. Below360 px the theme action moves beside the menu, leaving Settings and login on the right; larger layouts keep the three actions on the right. Sticky scrolling offsets keep focused content clear of the header/faculty strip.

## Verification scope

The user requested no automated test suites. No unit, acceptance, lint or axe suites are run. Code review covered public-settings boundaries, identity reset, request handoff, timestamp meanings and calendar URL/focus handling. Visual previews cover Start, the calendar and guest settings, light/dark/UJ themes, narrow screens and the header at 320/390/768/1440 px. Calendar date selection, month change and ArrowRight were exercised in the visual preview; this is not a complete browser acceptance suite or a real-user usability study. No private account or model inference is claimed.

Previews: [Start desktop](previews/nov8-home-desktop.png), [Start phone](previews/nov8-home-mobile.png), [calendar on Start](previews/nov8-calendar-home.png), [events page](previews/nov8-calendar-page.png), [guest settings](previews/nov8-settings-guest.png).

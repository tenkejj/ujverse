---
name: UJverse student workspace
description: An independent student information workspace with Versuś and source-backed university information.
colors:
  light-brand-ink: "#1e293b"
  light-background: "#F9F7F2"
  light-brand-gold: "#a48955"
  light-text-secondary: "rgb(30 41 59 / 0.62)"
  light-text-label: "rgb(30 41 59 / 0.72)"
  light-border: "rgb(15 23 42 / 0.08)"
  dark-bg-app: "#000000"
  dark-bg-card: "#09090b"
  dark-text-primary: "#f8fafc"
  dark-text-secondary: "#94a3b8"
  dark-border: "rgb(255 255 255 / 0.08)"
  dark-brand-gold: "#c9a227"
  brand-gold-bright: "#e8c84a"
  uj-brand-ink: "#0e1624"
  uj-background: "#0a121c"
  uj-card: "#121c2c"
  uj-text-primary: "#f4f0e6"
  uj-text-secondary: "rgb(244 240 230 / 0.72)"
  uj-brand-gold: "#cdb590"
  uj-brand-gold-bright: "#e8c97a"
  uj-sky: "#6ea8e0"
  uj-border: "rgb(110 168 224 / 0.18)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(30px, 2.6vw, 42px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(28px, 2.2vw, 36px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontSize: "12px"
    lineHeight: 1.5
rounded:
  control: "8px"
  workspace: "12px"
  send: "14px"
  suggestion: "24px"
spacing:
  sidebar-row-gap: "4px"
  resource-grid-gap: "16px"
  workspace-section-gap: "32px"
  dashboard-column-gap: "40px"
components:
  scene-send:
    backgroundColor: "var(--campus-accent)"
    textColor: "var(--campus-bg)"
    rounded: "{rounded.send}"
    padding: "0"
    width: "48px"
  disclosure:
    textColor: "var(--campus-accent)"
  catalogue-filter:
    textColor: "var(--campus-muted)"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  list-search:
    textColor: "var(--campus-muted)"
    rounded: "{rounded.control}"
  resource-card:
    backgroundColor: "var(--campus-bg)"
    textColor: "var(--campus-text)"
    rounded: "{rounded.workspace}"
    padding: "24px"
---

# Design System: UJverse student workspace

## Overview

**Creative North Star: "Codzienny towarzysz studenta UJ"**

UJverse is a student workspace: approachable enough to ask Versuś a question, precise enough to browse university information directly. Preserve the original UJverse logo, the hairless pixel-art scholar with round glasses, the system font and all three existing themes. Neutral surfaces, restrained gold and generous separation between groups carry the identity.

Shared workspace styles establish rhythm and controls; each kind of information gets a layout suited to its task. Continuous announcement feeds, registration dates, an event calendar, illustrated guides and resource cards should remain recognisably different.

**Key Characteristics:**

- Original identity and light/dark/UJ themes.
- Open sections with constrained reading widths.
- Source-aware information and visible interaction states.
- Shared CSS, task-specific information layouts.

This document merges the previous workspace guidance with the implemented redesign. Values come from `src/index.css`, `src/styles/campus.css`, `src/styles/workspace.css`, `src/styles/versus-scene.css` and the shared navigation tokens in `src/styles/mobile-theme.ts`. `workspace.css` supplies the final public-layout overrides; earlier base dimensions are not the current layout contract. Surface strategy remains in `docs/redesign/direction.md`.

Verification status for this revision: the production build and 151 tests passed; 147 route/theme/viewport DOM checks reported no horizontal overflow. Current screenshots could not be captured because of sandbox restrictions and automatic screenshot refusals. The finish review disposition is **recapture**; visual approval remains outstanding. Historical screenshots do not establish the appearance of this revision. Existing PRODUCT.md schema drift is outside this documentation merge.

## Colors

The light theme pairs ivory surfaces with navy ink and muted gold; dark uses black/zinc with bright gold; UJ uses academic navy with warm gold. Frontmatter prefixes identify the source theme; they do not introduce a new runtime palette.

### Primary

The runtime public accent is `--campus-accent`: `--brand-ink` in light and `--brand-gold-bright` in dark/UJ. Gold and navy mark actions, active navigation, focus and small illustrations. Keep `--brand-ink` dark on gold fills in UJ; it is not the soft blue atmosphere token.

### Neutral

`--campus-bg` maps to `--bg-card`; `--campus-side` to `--bg-app`; `--campus-text` to `--text-primary`; `--campus-line` to `--border-app`. Muted text uses `--text-label` in light and `--text-secondary` in dark/UJ. `--campus-tint` and `--campus-hover` use the existing accent mixes at 6% and 10%. Preserve these theme-aware aliases instead of hardcoding the light palette into components.

**The Labelled State Rule.** Semantic colours explain an accompanying status or category. They do not assign a separate decorative palette to every section. Existing cancellation, remote, duty, event and registration state labels retain their semantic colour mapping; guides use the shared neutral/gold palette.

## Typography

**Display and Body Font:** the existing system stack in the frontmatter. There is no separate display or mono family.

The hierarchy is compact and readable: the display role describes the Start greeting; headline describes public page headings; title describes catalogue entry headings; body and label describe feed excerpts and metadata. Section headings on Start use 22px, reducing to 20px on phones. The question field remains 16px with a 28px line height. Announcement source bodies use 15px with 1.75 line height.

**The Reading Width Rule.** A wide workspace does not require wide prose. Announcement titles and excerpts stop at 72ch, expanded source bodies at 75ch, and the complete feed at 1240px. The public search workspace stops at 1320px inside its page container.

## Layout

Shared public layouts use `src/styles/workspace.css`: catalogue pages have a maximum width of 1840px and Start 1760px, with 40px desktop side padding. Guide and search page containers stop at 1560px. Below 1200px, side padding becomes 28px; below 768px it is 20px, and below 380px it is 16px. Phone bottom padding reserves navigation and safe-area space.

Start opens directly with **Cześć, tu Versuś.** The desktop scene places a 280px mascot column beside a question workspace up to 720px, separated by 28px. Below 1200px the mascot column becomes 220px. Below 768px a compact mascot sits beside the greeting, followed by the full-width form; below 380px it reduces again. Only the composer carries the enclosing boundary. Guide links follow the scene. “Na uczelni” and its “Dostosuj” control precede announcements/registrations, with event previews alongside on wide screens. Their columns stack below 1200px. The introductory heading, study-profile picker and “Nie przegap” radar remain absent from Start. A restore action remains available when all information sections are hidden.

Desktop navigation is 224px expanded and 72px collapsed, available from 1024px. Its destinations scroll within the available viewport height; account and settings controls remain outside that scroller. Collapsing hides visible labels while retaining accessible names and titles. The header logo stays on the viewport axis, with theme, settings and login actions. Sticky/fixed chrome reserves space for scrolling content; mobile uses the existing drawer and bottom navigation.

The calendar uses balanced month and agenda columns (0.9:1), with a bounded month grid and 54–64px desktop day cells; below 900px the agenda follows the month. Tools use three columns, two below 1200px and one below 768px. Registrations use two compact card columns from 900px and a single column below; both exact dates stay beneath the course and unit. Do not apply a universal card grid to every information type.

## Elevation & Depth

Public workspace depth comes primarily from neutral surfaces, fine borders and spacing. Announcement feeds, daily agendas and dashboard entries are flat, with separators. Registration and resource cards use a fine border without a resting shadow. Resource cards and the composer have a border without a resting shadow. Sidebar surfaces have no shadow or backdrop blur. Existing modal/drawer elevation remains separate from feed styling; for example, the mobile drawer keeps its theme-specific directional shadow.

Motion responds to interaction and state. The existing send/suggestion transition uses background colour and opacity at 150ms ease-out; navigation uses its existing 150ms colour transition. Preserve Versuś’s seven request/interaction animations and public conversation handoff. Ten public question examples progressively fill the composer; three are visible at rest. Stream presentation has one 32ms queue with a 96ms catch-up budget, memoized completed Markdown blocks and no independent typewriter or 2.2s completion hold. Reduced-motion styles remove public workspace transitions and animation duration.

## Shapes

Controls use gently curved corners; workspace surfaces use the shared radius. The send button retains its own corner shape, and source-backed question suggestions use compact rounded buttons with a bounded “Więcej pytań” disclosure panel. Calendar dates, semantic labels and guide illustrations retain their established grammar. Continuous feed entries have square, borderless outer edges; their separation belongs to the list.

## Components

### Buttons, fields and filters

Controls remain labelled and generally at least 44px high. The send control is 48px wide with a 48px minimum height; its disabled state reduces opacity to 0.4. Focus uses an accent outline (2px, offset 3px), with container focus for the composer and catalogue search. Filters wrap before search, which has a 46px minimum height and a 440px desktop maximum width. Selected filters retain their labelled/pressed state; result options and sort controls stay lightweight.

### Announcements

The catalogue is a continuous list: 20 items initially, then “Załaduj więcej komunikatów” reveals the next batch without replacing the previous entries. Search, status filters, newest/oldest sorting and compact/detailed density use URL state. Compact excerpts stop at 140 characters; detailed mode shows the complete available excerpt. “Czytaj treść” progressively discloses the source body and lazily fetches a full body when available. It exposes loading, retry and expanded states. Source links and local saving remain separate actions; listing-only sources are labelled honestly.

### Registrations

Compact cards place the course and unit above two exact source dates: “Rozpoczęcie” and “Zakończenie”. Missing closure remains “Bez terminu zamknięcia”. Source timing, urgency/countdown eligibility and USOSweb links continue to use the existing logic; the layout does not reinterpret those dates. Saved state remains available.

### Events

The full events view defaults to the balanced calendar and daily agenda, with a list alternative. Selectable dates, daily agenda, month controls, Today/nearest-event actions, keyboard navigation, categories and saved state remain available. Start uses compact event previews separately from this calendar.

### Tools and search

Resource cards use 16px padding and a 112px desktop minimum height (104px on phones). They contain a semantic icon, title, short description, destination indicator and an account requirement where applicable. University services and UJverse tools remain separate groups. Public search provides one labelled field for announcements, registrations, events and tools, with topic suggestions and direct shortcuts before results. Results retain source links and explicit loading, empty and error states.

### Guides and settings

Guides group finances, studies, everyday essentials and support. Preserve theme-aware illustrations, short facts, one official action, applicability, source dates, progressively disclosed steps and local progress. Topic ink/wash use the shared accent/tint in every theme. Local settings remain available without signing in; account and AI-memory controls require authentication and reset on identity changes. Optional research controls require explicit opt-in, keep observations on-device for up to 28 days and provide export/deletion.

### Source freshness and footer

Source-added, confirmed and ingested timestamps remain distinct from the browser’s latest successful data read. Unknown, loading, stale and failure states must remain honest. Footer links group university services and UJverse tools with icons, concise descriptions and account requirements.

## Do's and Don'ts

### Do:

- Do reuse the existing theme variables and shared workspace styles.
- Do preserve source links, faculty preferences, local saved items and authentication requirements.
- Do keep controls labelled, keyboard reachable and visibly focused.
- Do distinguish source timestamps from the browser’s latest successful data read.
- Do retain guide illustrations and Versuś’s existing interaction animations.

### Don't:

- Don't replace the original logo, system font or three theme identities.
- Don't add generic AI gradients, replacement branding or a repeated decorative card grid to information feeds.
- Don't infer publication dates, invent source content or imply an unavailable AI response.
- Don't treat historical screenshots or DOM geometry as visual approval of the current build.

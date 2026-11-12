<p align="center">
  <a href="README.md">Polski</a> · <strong>English</strong>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">University announcements, deadlines and help with student life at UJ.</p>

<p align="center">
  <a href="https://ujverse.vercel.app/">Open UJverse</a> ·
  <a href="https://github.com/tenkejj/ujverse">GitHub</a> ·
  <a href="LICENSE">License</a>
</p>

UJverse is an independent service for students of Jagiellonian University. It combines information from official university websites with the Versuś assistant, search and student tools. Announcements, registrations, events and guides are available **without creating an account**.

The project is not affiliated with or endorsed by UJ. Confirm important deadlines and rules using the linked official source.

## What is available

| Feature | What it provides | Route |
| --- | --- | --- |
| Start | Entry to a conversation with Versuś, university information, a calendar and saved items | `/` |
| Versuś | Conversation about announcements, registration, events and student matters | `/chat` |
| Announcements | Faculty notices, category filters, full content and original sources | `/komunikaty` |
| Registrations | Current and upcoming rounds from the public USOSweb catalogue | `/rejestracje` |
| Events | Calendar, day selection and university events | `/wydarzenia` |
| Search | Search across information, guides and tools | `/szukaj` |
| Guides | Step-by-step help with student finances, studies, everyday essentials and support | `/poradniki` |
| Toolkit | USOSweb, PEGAZ, student email and useful links | `/niezbednik` |
| Find a room | Room and building search | `/sale` |

A labelled faculty selector is available in the header. The selection and saved information stay in the browser without changing account details. Light, dark and UJ themes are available, with preferences at `/settings`.

Guides explain applicability, preparation, steps, deadlines, contacts and official sources. Their local checklists do not submit applications or register students in USOSweb.

### Features that require an account

- **My timetable** (`/moj-plan`) — ICS import from USOSweb, day and week views, exams and briefings.
- **Aula** (`/aula`) — cohort channels, messages, reactions, polls, attachments, notes and tasks.
- **Community** (`/spolecznosc`) — posts, comments, profiles, following and community events.
- **Registration reminders** (`/usos`) — reminders before rounds and community submissions.
- **Couponek UJ** (`/znizki`), **Study spaces** (`/miejsca`) and **Notifications** (`/notifications`).

Opening a personal feature without a session leads to sign-in with a return to the requested view. Local settings are available without an account; account settings require a session.

## Versuś

Versuś uses UJverse data and GPT-OSS models served by **Groq**. The default configuration uses GPT-OSS 20B for lighter tasks and composing answers, and GPT-OSS 120B for a broader set of tools. Server environment variables can override these models.

Simple questions, including some procedural questions, receive prepared replies without another model call. When a model is needed, Groq receives the question, the necessary conversation context and the information used in the answer. “O Versusiu” explains the assistant's sources, operation and limitations.

Public questions do not require sign-in. Access to a saved timetable and other account data requires a verified session. Versuś does not complete USOS formalities or search the entire internet for every question. Responses can contain mistakes or rely on delayed information.

## Sources and freshness

| Data | Source | Scheduled collection |
| --- | --- | --- |
| Announcements | Official UJ faculty websites | 06:00, 14:00 and 20:00 UTC |
| Registrations | Public USOSweb catalogue | 06:15 and 19:00 UTC |
| Events | Calendar at uj.edu.pl | 05:00 UTC |

Schedules are defined in [vercel.json](vercel.json). Data is not collected live, and a schedule does not guarantee a successful refresh. Interface dates use Europe/Warsaw. The service distinguishes announcement addition, registration confirmation and event ingestion. Stale registration data receives a warning and countdowns are hidden.

## Technology and structure

| Layer | Technologies |
| --- | --- |
| Interface | React 19, TypeScript, Vite 7, Tailwind CSS 4, Framer Motion, Lucide |
| Navigation and state | React Router 7, TanStack Query, Zustand |
| Database and accounts | Supabase: PostgreSQL, RLS, Auth, Storage, Realtime |
| API and scheduled jobs | Vercel Functions, Edge and Cron |
| Assistant | Groq, caching and rate limits using Vercel KV |
| Search | Bounded Supabase/PostgREST queries with current-session permissions |

```text
src/components/       views and shared interface components
src/hooks/            data fetching and preferences
src/lib/info/         information and guide logic
src/services/         DataService, adapters and assistant client
api/                  chat, scrapers and server functions
supabase/migrations/  database schema and access policies
scripts/              maintenance tools
public/               logo, mascot and other assets
```

## Local development

Requirements: **Node.js 24**, npm and access to a configured Supabase project. These instructions are for the project owner and authorized collaborators; use of the source is governed by [LICENSE](LICENSE).

```bash
git clone https://github.com/tenkejj/ujverse.git
cd ujverse
npm ci
cp .env.example .env.local
```

Set the project URL and its **public** Supabase key in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

The legacy `VITE_SUPABASE_ANON_KEY` name is also accepted. The database needs the schema and access policies from the [migrations](supabase/migrations/). Copying placeholder values alone does not connect any data.

```bash
npm run dev
```

Open **http://localhost:5173**. If that port is occupied, use the address printed in the terminal. This starts the Vite frontend and Supabase reads; **it does not start functions in `api/`**.

For local chat and other API functionality, configure server variables, authenticate and link Vercel CLI to the project, then run this instead of standalone Vite:

```bash
npx vercel dev --listen 3000
```

Open **http://localhost:3000**. The development chat client defaults to this API address; `VITE_API_BASE_URL` can override the chat API location.

### Environment configuration

Start with [.env.example](.env.example). Keep secrets in `.env.local` or Vercel environment settings.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public client configuration |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access for API functions |
| `GROQ_API_KEY` | Chat API access to Groq |
| `GROQ_MODEL`, `GROQ_SMALLTALK_MODEL` | Optional assistant model overrides |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared cache and rate limits |
| `CRON_SECRET` | Scheduled job authorization |
| `SECRET_WEBHOOK_KEY` | Synchronization webhook authorization |

`VITE_*` variables are exposed to the browser. Never use them for a service-role key, Groq key or other secrets. Application search uses Supabase and does not require Meilisearch; optional server-side synchronization of public announcements is disabled by default.

### Useful commands

```bash
npm run build    # TypeScript checks and production frontend build
npm run preview  # local preview of the built frontend
npm test         # application module tests
```

`npm run preview` does not start the API either. Local disposable PostgreSQL access-policy checks are described in the [public RLS script](scripts/pivot-rls-check/run.sh) and [Aula checks](scripts/aula-security-check/README.md).

## Deploying to Vercel

The project uses a **prebuilt** deployment to ship the frontend and the complete set of API functions together. After authenticating Vercel CLI under the intended account:

```bash
npx vercel link
npx vercel pull --yes --environment=production
npm run deploy:prod
```

The PowerShell script [deploy.ps1](deploy.ps1) is also available. Database migrations are applied separately in Supabase; Vercel deployment does not run them. Server variables must be configured in the target Vercel environment.

## Privacy and access

Public pages use university information. Timetables, Aula messages and other personal data require a session and database/API authorization. RLS policies enforce access independently of visible controls and interface filters.

Faculty selection, saved items and guide progress stay in the browser. The optional “Pomóż sprawdzić UJverse” measurement requires separate consent, stays on the device for up to 28 days and supports export or deletion. It never sends a report automatically. General site analytics are a separate mechanism.

## Author and license

**Franciszek Dranka** · [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)

The source is available for inspection under a [proprietary license](LICENSE), rather than an open-source license. Other uses, commercial licensing or white-label arrangements require contacting the author.

Copyright © 2026 Franciszek Dranka. The UJverse name and logo are the author's marks.

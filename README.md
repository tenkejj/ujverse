# UJverse

> Author: **Franciszek Dranka** &nbsp;·&nbsp; Contact: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl) &nbsp;·&nbsp; Copyright © 2026 — All Rights Reserved (see [LICENSE](./LICENSE)).

UJverse is a modern, real-time social platform designed exclusively for the academic community. It provides students and academic staff with a dedicated space to share updates, exchange knowledge, and stay connected through a fluid, highly responsive user interface. 

The application is built with a strong focus on performance, real-time data synchronization, and a premium user experience, bridging the gap between outdated university forums and noisy mainstream social media.

## Project Vision & Motivation

The primary goal of UJverse is to centralize academic discourse in a distraction-free environment. Traditional social networks are heavily algorithm-driven and saturated with unrelated content, making it difficult for students to find critical university updates, share notes, or discuss faculty-specific topics. 

UJverse solves this by offering a tailored, chronological ecosystem where the community identity is at the forefront. Every feature is designed to facilitate quick information retrieval and meaningful academic interaction.

## Core Features

* **Real-time Feed & Interactions:** Posts, comments, and likes are synchronized instantly across all connected clients using Supabase Realtime, creating a live community pulse.
* **Optimistic UI:** Immediate visual feedback for user actions (like toggling a like or posting a comment) before the server confirms the transaction, ensuring a seamless and lag-free experience.
* **Advanced Media Handling:** Secure image uploads via Supabase Storage, integrated with a custom-built, full-screen Lightbox utilizing React Portals to escape CSS stacking contexts and provide a native-like photo viewing experience.
* **Comprehensive Notification System:** A real-time notification center tracking user interactions (likes, comments) with strict database-level persistent "read/unread" state management.
* **Deep Linking & Routing:** Dedicated single-post views and individual user profiles (`/post/:id`, `/user/:id`) allowing for easy content sharing and focused discussions.

## Tech Stack & Architecture

**Frontend:**
* React (with Hooks)
* TypeScript for type safety and predictable data flow
* Vite for rapid development and optimized builds
* Tailwind CSS for scalable, utility-first styling
* React Router DOM for client-side routing
* Lucide React for consistent iconography

**Backend as a Service (BaaS):**
* Supabase (PostgreSQL Database)
* Supabase Auth for secure user authentication and session management
* Supabase Storage for media hosting
* Row Level Security (RLS) ensuring strict data access control at the database level

## Design Philosophy

The user interface of UJverse is built around the concept of reducing cognitive load. Key design principles include:
* **Glassmorphism & Depth:** Strategic use of blurred backgrounds and translucent elements to create a clear visual hierarchy without heavy borders.
* **Responsive Layouts:** Components like the `PostCard` dynamically hug their content, ensuring images of varying aspect ratios are displayed perfectly without awkward empty spaces.
* **Minimalism:** Stripping away unnecessary text labels (e.g., icon-only navigation) and streamlining user profile creation to focus purely on identity and content.

## Deployment

Production deploys go to Vercel as **prebuilt artifacts** rather than via Vercel's git auto-detect pipeline. The remote `vercel build` running on Vercel's infrastructure deterministically refuses to register `api/scrape-wziks.ts` as a serverless function (the file passes TypeScript `nodenext` checks and esbuild bundles it cleanly, but Vercel's auto-detect silently drops it from the function list — confirmed by the hard error `"doesn't match any Serverless Functions inside the api directory"` when listed explicitly under `functions` in `vercel.json`). The local `vercel build` does not have this glitch and produces a `.vercel/output/` artifact containing both lambdas plus an isolated `/api/*` routing config.

Until the remote auto-detect is fixed (Vercel support or repro upstream), production deploys must be run manually:

```powershell
# Windows / PowerShell
./deploy.ps1
```

```bash
# Cross-shell (npm script)
npm run deploy:prod
```

Both invoke the same sequence:

1. `npx vercel build --prod` — local Vite build + local `@vercel/node` lambda compilation into `.vercel/output/`.
2. `npx vercel deploy --prebuilt --prod --force --yes` — upload the prebuilt artifact to production, bypassing remote re-detection.

Vercel's git auto-deploy should be disabled in the project dashboard (Project Settings → Git) to avoid the auto-deploy reverting `/api/scrape-wziks` to a 404/SPA-fallback state after each push.

First-time setup on a fresh checkout:

```powershell
npx vercel link --yes                              # link to tenkejjs-projects/ujverse
npx vercel pull --yes --environment=production     # populate .vercel/.env.production.local
```

## Future Roadmap

As the platform grows, the architecture is prepared to support several advanced features:
* Implementation of cursor-based pagination (Infinite Scroll) for optimal rendering of large feeds.
* Direct messaging (1-on-1 real-time chat) between community members.
* Advanced content discovery via clickable hashtags and a dedicated search infrastructure.
* Content bookmarking for saving important academic notes and schedules.

## Author

UJverse was designed, architected, and implemented by **Franciszek Dranka** (Uniwersytet Jagielloński, Kraków). The project is a personal, independent work — it is not affiliated with, endorsed by, or sponsored by Uniwersytet Jagielloński, despite carrying the "UJ" prefix in its community-facing name.

- Author: Franciszek Dranka
- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repository: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)
- Production: [ujverse.pl](https://ujverse.pl)

For commercial licensing, white-label deployments, partnerships, or any usage beyond personal source-review (see [LICENSE §2](./LICENSE)), please contact the author directly.

## License

Copyright © 2026 Franciszek Dranka. **All rights reserved.**

This software is released under a proprietary license. You may **view** the source for personal, non-commercial code-review purposes, but you may **not** copy, fork, mirror, deploy, modify, or use it (in whole or in part) to train AI/ML systems without prior written permission from the author. The full terms are in [LICENSE](./LICENSE).

The name **"UJverse"** and the UJverse logo are unregistered trademarks of Franciszek Dranka.
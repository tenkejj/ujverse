# UJverse

UJverse is an independent, unofficial information service for students at Uniwersytet Jagielloński. It brings together public faculty announcements, USOSweb registration deadlines, official events and university tools. These are available without an account. Personal plans, notifications and community features require authentication.

Versuś is a public AI assistant for university information and an important entry point. The interface must make asking a question approachable while allowing students to browse the same information directly. Actual answers depend on the configured backend; do not invent responses or claim measured speed.

## Design context

The user explicitly wants the original UJverse logo, light/dark/UJ themes and font stack preserved. They reject generic AI gradients, replacement branding, cramped dashboards and repeated cards or table-like lists. The latest reference is [Baltic Wheels](https://balticwheels.pl/en/), for its generous sections, clear hierarchy and space between groups. This is a working student hub with real content and controls, not a marketing page.

## Stack and validation

Existing React, TypeScript, Vite, React Router, Tailwind, shared theme tokens and Supabase. Reuse the current data hooks and access model. Browser checks and a production build are required for changed UI. No deployment is authorized for this work.

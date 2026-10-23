# Compass

Renellence's 1-on-1 app: the **weekly 1-on-1** (45 min, Monday) and the **monthly 1-on-1** (60 min, the first Monday of
the month), run by the manager with one rep at a time. It is the middle of the weekly sales loop:
Friday check-in in Edge -> 1-on-1 in Compass -> the week in Pulse -> next week's results.

- Spec: the "weekly-loop-handoff" (README, NOTE_FOR_YOUSEF, screens 08-18, prototypes in `source/`).
- Stack: React + Vite, the same as Edge's web app (`renellence-edge/web`), with Edge's design tokens and components
  copied into `src/edge.css` and `src/icons.jsx`, plus the handoff's light-blue accents in `src/compass.css`.
- **Data: sample only for now.** The database is a proposal waiting for the owner's approval:
  [`docs/compass-data-proposal.md`](docs/compass-data-proposal.md) and the unrun migration
  [`db/compass-001-proposal.sql`](db/compass-001-proposal.sql). Screens read and write only through `src/data/index.js`;
  `VITE_DATA_SOURCE=sample` (default) uses fictional data in `src/data/sample.js` and saves nothing.
- Data rules: `renellence-edge/docs/data-model-sop.md` is binding. Never add, rename or remove a table, field or enum value
  in Supabase v2 without the owner's yes. Demo data stays fully fictional (no real rep, staff or customer names).

## Run it

```
npm install
npm run dev        # http://localhost:5183
npm run build      # dist/
```

Screenshots of every screen in the handoff's states (for side-by-side checks against the PNGs):
`npx vite preview` then `node scripts/shots.mjs shots` (Playwright, installed as a dev dependency; it needs
`npx playwright install chromium` once).

## Screens

| Weekly (tab "Weekly") | Monthly (tab "Monthly") |
|---|---|
| 1 Last week (08) · 2 Second look (09) · 3 Visits (10) · 4 Roleplay (10b) · 5 Calls (11) · 6 Focus (12) · Done (13) | 1 Last month (14) · 2 Next month (15) · 3 My Fifty (16) · 4 Growth (17) · Done (18) |

The person menu (top right) picks which rep the 1-on-1 is with.

## Deploying on Vercel (owner steps)

The Vercel CLI isn't used. Import the repo once in the dashboard:

1. Vercel dashboard -> **Add New... -> Project** -> Import Git Repository -> pick **Info-Renellence/compass**
   (if it isn't listed: "Adjust GitHub App Permissions" and give the Vercel app access to the `compass` repo).
2. **Project name: `compass`** (this gives https://compass.vercel.app if the name is free; otherwise Vercel adds a suffix
   and you can add `compass.vercel.app`-style domains later under Settings -> Domains).
3. Framework preset: **Vite** (read from `vercel.json`). Root directory: `./`. Build command `npm run build`, output `dist`
   (both already in `vercel.json`; leave the overrides off).
4. Environment variables, for now only:
   - `VITE_DATA_SOURCE` = `sample` (Production and Preview). This is the default anyway; it's set so the switch is visible.
5. Deploy. Production branch: `main`.

Later, in phase 3 (after the database is approved and the API is built), add these as **server-only** variables
(never prefixed `VITE_`, never in the repo):
- `COMPASS_V2_DATABASE_URL`: Supabase v2 (`ojphplepzuwchjtuycpv`) pooled connection string, the same kind as Edge's
  `EDGE_V2_DATABASE_URL`.
- `GOOGLE_CLIENT_ID`: the same Google OAuth web client Edge uses, with `https://compass.vercel.app` added to its
  Authorized JavaScript origins in Google Cloud.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: the session store, as Edge's sign-in uses.
- then switch `VITE_DATA_SOURCE` to `api`.

Sign-in will be Google, @renellence.com only, plus an active row in `users` (as Edge), checked on the server.

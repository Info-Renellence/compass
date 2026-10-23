# Compass

Renellence's 1-on-1 app: the **weekly 1-on-1** (45 min, Monday) and the **monthly 1-on-1** (60 min, the first Monday of
the month), run by the manager with one rep at a time. It is the middle of the weekly sales loop:
Friday check-in in Edge -> 1-on-1 in Compass -> the week in Pulse -> next week's results.

- Spec: the "weekly-loop-handoff" (README, NOTE_FOR_YOUSEF, screens 08-18, prototypes in `source/`).
- Stack: React + Vite, the same as Edge's web app (`renellence-edge/web`), with Edge's design tokens and components
  copied into `src/edge.css` and `src/icons.jsx`, plus the handoff's light-blue accents in `src/compass.css`.
- **Data:** screens read and write only through `src/data/index.js`. `VITE_DATA_SOURCE=sample` (default) uses
  fictional data in `src/data/sample.js` and saves nothing (for demos); `VITE_DATA_SOURCE=api` uses the Compass API.
- **API:** one Vercel function, `api/compass.js` (GET `?op=` reads, POST `{op}` writes), as Edge's `api/edge.js`.
  It uses Supabase v2 through `COMPASS_V2_DATABASE_URL` only. Sign-in is Google with an @renellence.com address plus an
  active admin `users` row (admins only). Writes log to `change_logs` with source `compass`. The approved data model is
  [`docs/compass-data-proposal.md`](docs/compass-data-proposal.md) and `renellence-edge/db/v2-010-compass.sql`.
  The shared rules (`api/_compass/book.js`, `lists.js`, `time.js`, `http.js`) are unchanged copies of Edge's. Compass's
  own rules are in `api/_compass/rules.js`.
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

See [`docs/vercel-setup.md`](docs/vercel-setup.md): import the repo, set the env vars, and add the origin to the Google client.

## Tests (test database only)

`npm run test:db` runs the API ops against Supabase v1 (`TEST_DATABASE_URL` from `../my-fifty/.env.test`). A v2
address is refused, nothing but localhost and v1 can be reached (`test/run/no-network.js`), and every test is rolled
back. Fixtures are marked `demo-test-compass-` / `@demo.invalid`.

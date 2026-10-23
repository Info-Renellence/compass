# Compass on Vercel: owner steps

Compass is one Vite app plus one Vercel function (`api/compass.js`), on the Hobby plan (60 s per call, set in
`vercel.json`). It reads and writes Supabase **v2**, and only admins can sign in.

## 1. Import the repo (once)

1. Vercel dashboard -> **Add New... -> Project** -> Import Git Repository -> **Info-Renellence/compass**.
   If it isn't listed: "Adjust GitHub App Permissions" and give the Vercel app access to the `compass` repo.
2. Project name: **`compass`** (gives https://compass.vercel.app if the name is free).
3. Framework preset **Vite**, root `./`. Build command, output folder and functions all come from `vercel.json`, so leave
   the overrides off. Production branch: `main`.

## 2. Environment variables

Settings -> Environment Variables. Add each one for **Production** (and Preview if you want previews to work).
Server-only values must **never** start with `VITE_` and are never committed to the repo.

| Name | Value | Notes |
|---|---|---|
| `COMPASS_V2_DATABASE_URL` | The Supabase **v2** (`ojphplepzuwchjtuycpv`) pooled connection string, port 6543 (transaction pooler) | The same kind of URL as Edge's `EDGE_V2_DATABASE_URL`; you can copy Edge's value. Compass reads no other database variable. |
| `GOOGLE_CLIENT_ID` | Edge's Google OAuth web client ID (the same value as Edge's `GOOGLE_CLIENT_ID`) | Public (it appears in the page), but set it here so the server can check sign-ins. |
| `COMPASS_SESSION_SECRET` | A long random string, e.g. the output of `openssl rand -hex 32` | Signs Compass's 30-day sign-in sessions. Changing it signs everyone out. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional: Edge's Upstash token | Edge derives its session key from this when it has no secret of its own. Compass does the same if `COMPASS_SESSION_SECRET` is missing. You only need one of the two. |
| `VITE_DATA_SOURCE` | `api` | Switches the screens from sample data to the real API. It is read at **build** time, so redeploy after changing it. `sample` = demo mode, which saves nothing. |

Then **Redeploy** (Deployments -> ... -> Redeploy) so the build picks up `VITE_DATA_SOURCE`.

## 3. Add the origin to the Google client

Google Cloud Console -> APIs & Services -> Credentials -> the OAuth 2.0 web client Edge uses ->
**Authorized JavaScript origins** -> add `https://compass.vercel.app` (and any other Compass domain) -> Save.
It can take a few minutes to start working.

## 4. Who can sign in

You need a Google account on @renellence.com **and** an active row in v2's `users` table with `kind = 'admin'`
(owner's choice "admins only", 2026-10-23: admin@, info@, aria.moghimi@, caterina.paggos@). A rep, head office or
anyone else gets "Compass is for admins only".

## 5. Before the first real session

- `renellence-edge/db/v2-010-compass.sql` must be applied on **v2**. Compass needs its tables, and its writes use the
  `compass` change-log source.
- Monthly targets come from `targets` (kind `target`, metric `revenue`). With no target the screens show "No target set".

## Local development (test database only)

Tests and local runs use Supabase **v1** (the test database) only. `TEST_DATABASE_URL` is read from
`../my-fifty/.env.test`, and a v2 address is refused.

```
npm run test:db                                   # the API ops against v1, every test rolled back
VITE_DATA_SOURCE=api npm run build
npm run serve:test -- 5385 <an admin's email>     # dist + API on http://localhost:5385, signed in as that admin
```

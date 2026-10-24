# Run 3, lane C (Compass + whole pipeline + ops), 2026-10-23, 7 PM to 11:50 PM Toronto

Database: Supabase v1 (test copy of today's v2) only. v2 is never reached: Compass's env.js refuses a v2 address; the ops
scripts run with a lane-C preload (`run3/laneC/ops-guard.js` in the session scratchpad) that adds the network guard and
makes every v2 entry point of `ops/lib/conn.js` throw (the pooler host is shared by v1 and v2, so a host guard alone
can't tell them apart). Stripe is blocked or stubbed; n8n is refused.

## Compass baseline (6:47 PM, main b3f4cff, before any push)
- `npm run test:db`: 5 passed, 0 failed.
- `node --test test/shared-fingerprint.test.js`: 2 passed, 0 failed.
- `npm run build`: ok.
- Note: Compass has no `npm test` script (the brief names one); the unit-level test is the fingerprint test above.

## Log
- 6:48 Real-data reads: weekly + monthly for the 5 real active reps as a real admin: all 200, 1.2 to 2.1 s each, no NaN /
  undefined in any answer, the visit cap (15) held on the two books that hit it.
- 6:55 Cross-app numbers on the 5 real reps' books: Edge Home (as the rep), Compass monthly and weekly (as an admin) and
  Pulse Today (as the rep) agree exactly on October's Ordered, the month's target and the Fifty count for every rep.
- 7:02 Whole-loop test (`renellence-edge/test/run/crossapp-compass.test.js`): passes (Edge check-in -> Compass weekly
  -> Pulse week -> visits back into Compass and Edge -> monthly gap forecast into Edge's Forecast).
  Known gap confirmed: a My Fifty status set in Compass (`fifty_statuses`) shows in neither Edge nor Pulse.
- 7:05 ops on v1 (lane-C guard on): daily-report, role-changes, replay --dry, flags show / init --dry / set --dry, and
  reconcile (--no-stripe, and with Stripe stubbed) all run; `flags.js v2 show` is refused by the guard.
  migrations/check.js SKIPPED on purpose: it reads v2's structure, and nothing may connect to v2 tonight.
  Two ops bugs found and fixed (renellence-ops, local commits): see Findings.
- 7:10 ops tests: daily-report 22/22 (+1 new), role-changes 9/9, replay 12/12, Claude runner (mocked) 15/15.
  `reconcile.test.js` NOT run: it applies the v2-011 order-dispatch DDL inside its transaction (a structure change, even
  rolled back) and needs an exclusive lock on orders, which timed out against the other lanes' tests. Pure checks added
  in `reconcile-pure.test.js` instead.
- 7:15 Intake Deno tests (`npx deno@2.1.4 test supabase/functions/`, network limited to localhost): 25/25.
- 7:25 Fake signed webhooks against the real `ingest` handler served on 127.0.0.1:5541, writing to v1 (through a local
  SQL proxy on 5542, because Deno's npm postgres can't resolve the pooler on this laptop): 22/22. Signed events saved
  once, repeats dropped, 10 parallel copies saved once, wrong secret / old timestamp / changed body / no header refused
  with 401, bad JSON 400, unknown source 404, GET 405, a 2 MB event accepted, SignatureAPI answers 503 (its source value
  comes with v2-012, not applied). The 9 rows it wrote were deleted right after (ingest_events back to 5).

- 7:30 Access attacks and bad input (scratch `run3/laneC/attacks.test.js`, rolled back): prototype op names, wrong
  methods, forged / tampered / expired / Edge-looking session tokens, a key rotation, bad and wrong-kind rep ids, SQL
  text, another rep's accounts in picks / second look / gap forecasts / Fifty statuses, bad targets, goals ("refer" is
  refused), skills, NUL text, 11 commitments, 5,000-character text (cut to 200), repeated saves: 6/6, nothing leaked.
- 7:32 Load: 80 weekly + monthly reads (all 20 reps, twice) at once: all 200, 49 s wall for one local process with a
  3-connection pool (1.2 to 2 s each when alone). Fine for one manager; noted.
- 7:36 Screens on the real books (local server on 5543 as a real admin, built with the API, every POST blocked in the
  browser): weekly steps 1-5 and monthly 1-3 for the 5 real reps at 1440x900, plus 1024x768: no console or page errors,
  no NaN / undefined / null text, no sideways scroll. Server stopped after.
- 7:38 Time edges (pure): every week of 2026 starts Monday and ends Sunday 23:59 Toronto, including the DST weeks
  (169 h / 167 h); the monthly plans the month whose first week it is, else the coming month, for every week of the year.
- 7:40 Cross-app test extended (renellence-edge 035a5bd, test only): the feature switches across the three apps.
- 7:42 Edge's check-in suggestions vs Compass's own sorting of the week, on the 5 real books: 459 same, 137 differ (C6).
- 7:46 Going cold at exactly 30 days (C7) fixed in Compass, pushed 89ebb58 (Compass gate: test:db 6/6, fingerprint 2/2,
  build ok).

- 7:50 Compass saves on each of the 5 real books (`run3/laneC/realwrites.test.js`, one rolled-back transaction per rep):
  weekly_save, a second save the same week, monthly_save with every gap forecast and the suggested Fifty statuses;
  then Pulse Today shows the week exactly as saved (focus, visit and call counts), Edge Home shows the focus, Edge's
  Forecast shows every gap forecast, and the committed-forecast snapshot equals the month's forecasts on screen: 5/5.
  Checked after: no Compass row left (one_on_ones 0, fifty_statuses 0, metric_snapshots 0).
- 7:55 Real non-admin users (the 5 reps) are refused on every Compass read and write (403 admins_only).
- 7:58 Monday Oct 26 (fake clock, read-only): Compass reads the real rep's Edge check-in draft (created on v2 at 5:01 PM
  today, copied here) as "Draft, not sent" with its 127 picks. Note for the owner: Edge's Friday Check In is already
  writing to production, while `renellence-edge/docs/test-run-rules.md` still says it runs on sample data only.

- 8:00 An empty book (a rep with no accounts): weekly and monthly open, both saves work (rolled back).
- 8:02 Browser save flow on committed FAKE rows (fake admin + fake rep with 6 fictional accounts, marked
  demo-test-r3-c- / demo-test-r3-C-; local server 5543): weekly steps 1-6, Save the week, two commitment toggles,
  monthly with 3 gap forecasts added, Save November, reopen: posts weekly_save / weekly_commitments x2 / monthly_save
  all 200, no console errors. Pulse Today then shows "2 visits · 1 call", focus close, target 3; Edge Home the focus;
  Edge Forecast the 3 gap forecasts; change_logs source compass. Found C8 (fixed) and C9.
- 8:05 Compass fix pushed cd9c7ca (C8), with a new browser test (`npm run test:ui`); test:db 6/6, fingerprint 2/2,
  build ok. Server on 5543 stopped.
- 8:08 replay.js on v1 with two fake failed events (committed, then deleted): --dry requeues the Quo one and leaves the
  n8n one for n8n; the real run with --source quo commits only that one.

- 8:09 Two commitment changes at once (two quick chip taps), on the committed fake rows: the same commitment was added
  twice in 4 of 5 rounds (C11). Fixed and pushed ba0b937 (rep lock first, as weekly_save); the same parallel check on v1
  afterwards: no duplicates in 5 rounds. A first try at a committed-row concurrency test left 4 inactive fake users
  (`demo-test-compass-race-*@demo.invalid`, fictional names): their tasks, sessions and check-ins were deleted, but a
  user row can't be deleted once change_logs names it (foreign key), so they were switched off instead. The kept test
  needs no database.
- 8:12 300 random write bodies (weekly_save, monthly_save, weekly_commitments): never a 500.
- 8:14 Monthly "could close the gap" and the next month's forecasts on the 5 real books: amounts and reasons plausible
  (reorder rhythm 3 to 15 weeks, first orders in the last 60 days); no negative or zero amounts.

- 8:20 Manager re-saves the week after the rep confirmed it in Pulse and marked a visit Missed (rolled back): Pulse
  stays "confirmed" for the changed week (C12, owner), and the visit turned into a call kept its missed mark and showed
  under next week's "Missed visits" (C13). C13 fixed and pushed c7812b1 (test:db 7/7, fingerprint + lock 3/3, build ok).

- 8:25 Wipe of lane C's fake rows (scratch `run3/laneC/wipe-c.js`): removed 7 orders + 7 lines, 3 forecasts, 27 tasks,
  2 sessions, 1 check-in, 6 picks, 3 statuses, 1 snapshot; the webhook rows were already removed. Kept, because the
  test login can't switch triggers off and change_logs (append-only) names them by foreign key: 6 fictional users
  (switched off; demo-test-r3-c-* and demo-test-compass-race-* @demo.invalid) and 6 fictional contacts (no orders,
  legacy_id demo-test-r3-C-c1..c6). The owner can remove them with the change_logs-aware pattern of
  renellence-edge/db/wipe-edge-test.sql, run as the database owner (script kept as `run3/laneC/wipe-c-owner.js.txt`).
  No `flags` or `order_dispatch` row was ever committed by lane C.

- 8:30 End-of-run re-checks: Compass test:db 7/7, fingerprint + lock 3/3, test:ui 1/1, build ok; cross-app test 2/2;
  ops tests daily-report 23/23, role-changes 9/9, replay 12/12, reconcile-pure 3/3, Claude runner 15/15. (A first
  pass of test:db and the cross-app test, run while lane A's gate held v1, failed 2 and 1 on contention; both green
  when re-run alone.) No lane C server running.

## Findings
- C1 (medium, ops, FIXED renellence-ops fa7d9ee): `reconcile.js --no-stripe` listed every succeeded card payment as
  "Marked paid, but no Stripe payment found" (42 on the copy) and said it compared them with 0 Stripe payments.
- C2 (low, ops, FIXED renellence-ops ba20bb4): the daily health report's headline counted the lines of the role-change
  section (header + footer included): 2 changes read as "4 role or access changes to check".
- C3 (known gap, confirmed, not built): Compass's My Fifty statuses are stored but shown in neither Edge nor Pulse.
- C4 (owner, info): Compass monthly "forecast accuracy" is always empty: it reads a `metric_snapshots` row (metric
  `forecast`, the 1st of the month) that no job writes on v2 yet (Compass proposal open question 10).
- C5 (low, test): `ops/reconcile/reconcile.test.js` runs DDL (v2-011) on v1 inside its transaction; it can't run while
  others test, and it goes against "never change the structure". Proposal: seed the dispatch columns' values in a fake
  orders list instead (compare() is pure), or run it only on a private database.
- C6 (medium, needs the owner): when a rep sends no Friday check-in, Compass sorts the week itself and says it sorts it
  "as the check-in would", but its rules differ from Edge's check-in: on the 5 real books 137 of 596 suggestions differ.
  Mostly: Edge suggests Call for a lead nobody has called yet (86) and for an ad lead of any age (16) and for a follow-up
  due this week (7+), where Compass says Wait; plus the "biggest late forecast" tie rule and the event rule. Whatever
  Compass sorts is frozen into the week Pulse shows. Proposal: one shared `suggest()` copy (like book.js) used by both,
  after the owner says which defaults are right.
- C7 (low, FIXED Compass 89ebb58): at exactly 30 days with no order or visit Compass called a My Fifty account going cold
  (Visit, "No order or visit since", At risk); Edge's check-in, book.js and Pulse say more than 30 days.
- C8 (low-medium, FIXED Compass cd9c7ca): each 1-on-1 step (and the done screen) opened at the previous step's scroll
  position, because Next sits at the bottom: the step title and the step tabs were under the sticky top bar, and the
  done screen's check mark was hidden.
- C9 (low, wording, not fixed): the weekly done line says "1 calls" / "1 visits" (Pulse says "1 call").
- C10 (info): replay.js can only move a failed event back to waiting until a v2 processor exists (its header says so);
  the daily report then lists it as "waited more than 2 hours". Expected until the processors are written.
- C11 (low-medium, FIXED Compass ba0b937): two quick taps on the done screen's commitment chips could add the same
  commitment (the manager's to-do) twice. Left (low, not fixed): the two saves can still land in either order, so the
  last tap may not be the one kept; a fix would queue the chip saves in the page.
- C12 (low, needs the owner): if the manager re-saves a week after the rep pressed "Confirm my week" in Pulse, Pulse still
  shows it as confirmed, so the rep isn't asked to look at the changed week. Decide: reset week_confirmed_at on a re-save
  that changes picks or the focus (Compass), or leave it.
- C13 (low, FIXED Compass c7812b1): a visit marked Missed then changed to a call by a re-save was listed under the next
  1-on-1's "Missed visits".

# Compass: database proposal (phase 1)

**Status: APPROVED by the owner 2026-10-23** (the 5 tables, `tasks.one_on_one_id`, `change_logs_source` + `compass`,
the `settings` row `compass`, and the recommended option for all four choices in section 8). **Not approved, deferred:**
`events.customer_reward` and dropping `forecast_activities` (neither was part of this migration). The final migration is
`renellence-edge/db/v2-010-compass.sql` (no approval guard); **not applied yet** to v1 or v2 (dry-run on v1, rolled back).
The owner runs the applies. Written 2026-10-23 for the weekly sales loop
(Friday check-in in Edge -> weekly 1-on-1 in Compass -> the week in Pulse -> next week's results; monthly 1-on-1 ->
Edge forecasts and My Fifty statuses). The owner approves each table and field before anything is run (SOP section 8).

- Binding rules: `renellence-edge/docs/data-model-sop.md` (sections 2, 3, 4, 7, 8, 9) and the v2-008 naming rules.
- Read for this proposal: v2's live schema (read-only transaction: 29 tables, all enums, RLS policies, helper functions,
  triggers; `tasks` has 0 `one_on_one` rows today, `targets` is empty), `renellence-edge/db/v2-00*.sql`,
  `my-fifty/db/001-my-fifty.sql`, `my-fifty/CHANGELOG-v2.md`, Edge's focus code (`api/_edge/view.js` GOALS,
  `writes.js` `focus_set`, `reads.js` home focus) and the handoff (README, NOTE_FOR_YOUSEF, screens 01-18, prototypes).
- The proposal SQL: [`db/compass-001-proposal.sql`](../db/compass-001-proposal.sql), kept as the record. **Never run it**:
  the final, approved file is `renellence-edge/db/v2-010-compass.sql` (same structure; it also grants the tables like
  every v2 table, adds two indexes, table comments, and checks a picked account is the rep's own on write).

## 1. In one paragraph

Five new tables (`checkins`, `account_picks`, `forecast_changes`, `one_on_ones`, `fifty_statuses`), one new column on an
existing table (`tasks.one_on_one_id`), ten new enum types, one new value in an existing list
(`change_logs_source` + `compass`), one RLS helper (`can_see_checkin`) and one `settings` row (`compass`). Everything
else the screens show (wins, visits and calls done, forecast landed, attainment, forecast accuracy, the parked list,
"Could close the gap", the suggested picks' inputs) is **derived** from contacts, orders, forecasts, interactions,
agreements, targets and metric_snapshots, as the SOP requires. The weekly focus is **not** a new table: it stays Edge's
existing "This week's focus" task (`tasks.source = one_on_one`, title = one of the six goal keys).

## 2. From the handoff's data model to this proposal

The handoff README says its model is "a starting point, not final". Here is what each part becomes, and why.

| Handoff | Proposal | Why |
|---|---|---|
| `weekly_checkin` (rep_id, week_start, submitted_at, help_note) | **`checkins`** | Same fields, SOP names (`week_start_date`, `rep_id`). Plural noun (rule 1) |
| `account_pick` (checkin_id, account_id, suggested_pick, suggested_reason, rep_pick, final_pick, purpose) | **`account_picks`** + frozen `sort_group` | "Account" is `contacts` (SOP 4: the contact is the account), so `contact_id`. The group is frozen because it changes after Friday (SOP rule 9) |
| `second_look` (account_pick_id, fact_line, decision) | **2 columns on `account_picks`**: `second_look_fact`, `second_look_decision` | It belongs to one pick and can't stand alone: a column, not a table (SOP 2.3) |
| `visit_outcome` (account_pick_id, status done/missed, missed_reason) | **2 columns on `account_picks`**: `visit_interaction_id`, `missed_at` | Done = the Pulse visit that already lands in `interactions`; linking it avoids a stored status (SOP 2.4). Missed is just a time: no reason is asked (owner 2026-10-23) |
| `forecast_change` (forecast_id, change_type, from_value, to_value, reason) | **`forecast_changes`** without from/to values | The old and new due date and amounts are already in `change_logs` (forecasts has the `log_changes` trigger); storing them again would duplicate (SOP 8.2). Only the kind and the reason are new |
| `weekly_focus` (rep_id, week_start, goal_key, action_target, action_actual, result_actual) | **Edge's existing focus task** + `one_on_ones.focus_action_target_count` | The goal is already a task (owner decision 3, 2026-10-22). Actuals are counted, never stored (SOP 2.4) |
| `weekly_session` (rep_id, week_start, roleplay_skill, roleplay_character, roleplay_done, cat_commitments[]) | **`one_on_ones`** (`kind` weekly) + commitments as **`tasks`** | One table per real noun, variations by `kind` (SOP 2.2). Commitments are things someone has to do: `tasks` already holds those (SOP 4), assigned to the manager |
| `monthly_session` (rep_id, month, target, forecast_committed, skill_key, notes_ref) | **`one_on_ones`** (`kind` monthly) | The target is `targets` (kind target, metric revenue). The committed forecast is a dated number: `metric_snapshots` (SOP 4). Notes: see open question 7 |
| `fifty_status` (account_id, month, status green/amber/red) | **`fifty_statuses`** (on_track · watch · at_risk) | Repeats every month, so its own table (SOP 2.5). Values named as the screen says them |
| `parked_until = today + 30 days` | **Derived** (no column) | "Parked until" = the check-in week of the latest `final_pick = park` + `settings.compass.park_days`. Option B below if the owner wants a column |
| Forecasts added on the gap step, `source = monthly_1on1` | **Normal `forecasts` rows**, no new field | `change_logs` already records who created each forecast and from where; the new `compass` source value tells them apart. Option B: `forecasts.one_on_one_id` |

## 3. The new tables and fields

Every table gets `id uuid`, `created_at`, `updated_at` (except the append-style `forecast_changes`), the
`touch_updated_at` and `log_changes` triggers, RLS, and indexes on every column a rule uses.

### `checkins`: the Friday check-in (one per rep per week)
| Field | Type | Key | Notes |
|---|---|---|---|
| `rep_id` | uuid | FK `users.id`, UNIQUE with week | The rep |
| `week_start_date` | date | UNIQUE with rep | The Monday of the week being planned (checked: a Monday) |
| `submitted_at` | timestamptz | | Empty = draft. Edge's gold "due" dot shows from Friday morning until this is set |
| `help_note` | text | | "Where I need help from <manager>", optional. Shown first in the 1-on-1 |

### `account_picks`: every account sorted on Friday, and how its week ended
| Field | Type | Key | Notes |
|---|---|---|---|
| `checkin_id` | uuid | FK `checkins.id`, UNIQUE with contact | |
| `contact_id` | uuid | FK `contacts.id` | The account |
| `sort_group` | enum `account_picks_sort_group` | | candidate · onboarded · fifty · lead, **frozen** at the check-in |
| `suggested_pick` | enum `account_picks_pick` | | visit · call · wait · park |
| `suggested_reason` | text | | The one line shown after "Suggested:" (frozen: the rule's words that day) |
| `rep_pick` | enum `account_picks_pick` | | The rep's Friday choice, kept as it was |
| `final_pick` | enum `account_picks_pick` | | What was agreed on Monday (second look, removed, "make it a visit"); empty until saved |
| `purpose` | text | | The visit or call purpose, written from the meeting notes after the meeting |
| `second_look_fact` | text | | Set when the pick is queued for Second look; the plain fact line |
| `second_look_decision` | enum `account_picks_second_look_decision` | | keep · change; empty = not discussed (optional, Next never blocks) |
| `visit_interaction_id` | uuid | FK `interactions.id` | **Done**: the Pulse visit (`kind meeting`, `mode in_person` or `video`) that closed it |
| `missed_at` | timestamptz | | **Missed**: when the rep marked it missed in Pulse. No reason is asked (owner 2026-10-23) |

A visit is Done when `visit_interaction_id` is set, Missed when `missed_at` is set (never both), open otherwise.

### `forecast_changes`: the reason behind each forecast change on Friday
| Field | Type | Key | Notes |
|---|---|---|---|
| `forecast_id` | uuid | FK `forecasts.id`, UNIQUE with check-in | |
| `checkin_id` | uuid | FK `checkins.id` | |
| `change_kind` | enum `forecast_changes_change_kind` | | moved · dropped (late rows) · pushed_later · reduced · went_up · pulled_forward |
| `reason` | enum `forecast_changes_reason` | | clinic_timing · still_has_stock · budget · decision_maker_unreachable · no_next_step · chose_other_brand · estimate_off (slips) · more_patient_demand · new_product_line · clinic_pulled_forward (rises; estimate_off fits both) |
| `created_by_id` | uuid | FK `users.id` | |

### `one_on_ones`: each weekly or monthly 1-on-1
| Field | Type | Key | Notes |
|---|---|---|---|
| `kind` | enum `one_on_ones_kind` | | weekly · monthly (the first 1-on-1 of a month is monthly, replacing the weekly one) |
| `rep_id` | uuid | FK `users.id`, UNIQUE with kind + date | |
| `held_by_id` | uuid | FK `users.id` | The admin who ran it (Cat) |
| `session_date` | date | | |
| `checkin_id` | uuid | FK `checkins.id` | Weekly: the check-in it starts from |
| `focus_action_target_count` | integer | | Weekly: the lead measure, 1-15 (e.g. 3 sampled clinics asked for an order date) |
| `skill` | enum `one_on_ones_skill` | | Weekly: the roleplay skill · monthly: the skill of the month (the weekly default all month) |
| `roleplay_character` | enum `one_on_ones_roleplay_character` | | skeptic · fence_sitter · rusher · fan · gatekeeper · newcomer |
| `roleplay_done_at` | timestamptz | | "Done, back to it" |
| `completed_at` | timestamptz | | "Save the week" / "Save November" |
| `week_confirmed_at` | timestamptz | | Weekly: the rep's one tap in Pulse |
| `deleted_at` | timestamptz | | Soft delete |

### `fifty_statuses`: a status for every My Fifty account, once a month
| Field | Type | Key | Notes |
|---|---|---|---|
| `contact_id` | uuid | FK `contacts.id`, UNIQUE with month | |
| `month_start_date` | date | | The 1st of the month |
| `status` | enum `fifty_statuses_status` | | on_track · watch · at_risk |
| `one_on_one_id` | uuid | FK `one_on_ones.id` | The monthly session that set it |
| `set_by_id` | uuid | FK `users.id` | |

### Changes to existing structure
- **`tasks.one_on_one_id`** uuid FK `one_on_ones.id` (new, nullable). Ties the weekly focus task and the manager's
  commitments to their session. Commitments: `assignee_id` = the manager, `created_by_id` = the manager,
  `source = one_on_one`, `kind = todo`, `title` = the commitment ("Send the price-objection guide"), **no `contact_id`**
  (so the rep never sees them under the existing tasks policy, as the handoff asks), due at the end of the week.
- **`change_logs_source` + `compass`** (new value), so Compass's writes (forecasts added on the gap step, statuses,
  focus) are told apart, like `my_fifty`.
- **`settings` row `compass`** (data, not structure): `max_visits` 15, `park_days` 30, `second_look_max` 4,
  `sampled_no_order_days` 20, `fifty_quiet_days` 30, check-in due Friday 17:00. Thresholds are never hard-coded.

## 4. How it links to existing data

```
users ──< checkins ──< account_picks >── contacts ──< orders, forecasts, interactions, agreements, onboardings
  │           │              └── visit_interaction_id ──> interactions (the Pulse visit)
  │           └──< forecast_changes >── forecasts
  └──< one_on_ones ──> checkins
          ├──< tasks (one_on_one_id): the weekly focus (rep) + the manager's commitments
          └──< fifty_statuses >── contacts
targets (kind target, metric revenue)  ·  metric_snapshots (forecast on the 1st, committed forecast)  ·  settings.compass
```

| Screen | What it shows | Where it comes from |
|---|---|---|
| Weekly 1 | "<Rep> wants to talk about" | `checkins.help_note` (this week's check-in) |
| Weekly 1 | Wins | Derived from last week: agreements (onboarding completed), sample orders, paid-product orders (Ordered rules) |
| Weekly 1 | Last week's focus | Last weekly `one_on_ones` -> its focus task (goal key) + `focus_action_target_count`; actuals counted from Pulse interactions and orders (rule per goal, section 5) |
| Weekly 1 | My Fifty count and change | Derived (an order in the last 3 months), compared with a week ago |
| Weekly 1 | Forecast landed | Forecasts due last week (`due_date`) that turned into Ordered by their due day |
| Weekly 1 | Visits / calls done of planned | Last week's `account_picks.final_pick` visit/call vs Pulse `interactions` that week (a video call counts as a visit; a no-show doesn't) |
| Weekly 1 | Missed visits | `account_picks.missed_at` from last week's check-in (names only, no reasons) |
| Weekly 1 | Forecast changes, "Sent Fri 4:12 pm" | `forecast_changes` + `forecasts` (current due date or dropped) + `checkins.submitted_at` |
| Weekly 2 | Second look | `account_picks` where `second_look_fact` is set; decision -> `second_look_decision` and `final_pick` |
| Weekly 3, 5 | Visits, calls | `account_picks` (final pick), group pill = `sort_group`, purpose = `purpose` |
| Weekly 4 | Roleplay | `one_on_ones.skill`, `roleplay_character`, `roleplay_done_at`; default skill = this month's monthly `skill`; the gold dot = a match between the help note and a skill (simple keyword rule) |
| Weekly 6 | One focus | Edge's focus task (unchanged write: `focus_set`) + `focus_action_target_count` |
| Weekly done | "<Manager> will…" | `tasks` (assignee = manager, `one_on_one_id`) |
| Monthly 1 | Target and attainment | `targets` (kind target, metric revenue, the month) vs Ordered |
| Monthly 1 | Forecast accuracy | `metric_snapshots` of the forecasts on the 1st (Edge's monthly snapshot job) vs Ordered |
| Monthly 1 | Why forecasts slipped | `forecast_changes.reason` for the month's check-ins, counted |
| Monthly 1 | Weekly focus this month | The month's weekly `one_on_ones` + their focus tasks + counted actuals |
| Monthly 2 | Target / forecast / gap; already forecast | `targets` + `forecasts` due that month |
| Monthly 2 | Could close the gap | Derived: contacts with no forecast that month and a reorder rhythm, an event or a stated plan; "+ Add" writes a normal `forecasts` row (logged with source `compass`) |
| Monthly 3 | My Fifty check | `fifty_statuses` (suggested from order rhythm, saved when agreed) |
| Monthly 4 | Skill for the month | monthly `one_on_ones.skill` |
| Monthly done | Committed forecast | A `metric_snapshots` row (metric `forecast_committed`, the month) written at save |

## 5. Simple rules first (suggestions, second look, focus actuals)

All thresholds come from `settings.compass` (and the existing `edge` / `my_fifty` settings). They run when the
check-in opens on Friday (suggestions) and over the weekend (second look), and their words are frozen on the pick.

- **Suggested pick** (first match wins): samples sent `sampled_no_order_days`+ ago with no order -> Visit · onboarding
  signed, no samples -> Visit (Call if signed in the last 2 days) · My Fifty going cold (30 days, no order or visit) ->
  Visit · late forecast -> Call (Visit if it is the biggest) · payment failed -> Call · event lead with no follow-up ->
  Call · new ad lead -> Call · ordered in the last 14 days, nothing open -> Wait · 2+ unanswered calls in 3 weeks -> Park.
- **Second look** (at most `second_look_max`, only where the rep's pick differs from the suggestion and the data points
  elsewhere): parked but samples 20+ days ago with no order · My Fifty on Wait with 30+ days and no order or visit ·
  event lead parked with no call since the event · a Visit to an account that ordered recently while a stronger account
  was skipped. Stored as a plain fact line; no comparison wording.
- **Focus actuals** (counted from Pulse and orders for the focus week): close = sampled contacts with a visit or call
  whose outcome asked for an order date (`interactions.outcome`, see open question 9) / first paid orders · warm = quiet
  My Fifty contacts visited / reorders · grow = current accounts with a visit mentioning a second line / accounts
  ordering a new `product_line` · fill = warm leads given samples or onboarding / new candidates · events = invites (`event_attendees.invited_by_id`) / registered (`status rsvp`
  or attended).

## 6. Access (row-level security, SOP section 7)

| Table | Rep | Admin |
|---|---|---|
| `checkins` | Read and write their own (`rep_id = me()`) | All |
| `account_picks`, `forecast_changes` | Through their own check-in (`can_see_checkin()`, a new security-definer helper like `can_see_contact`) | All |
| `one_on_ones` | Read their own | Read and write all (the manager runs the session) |
| `fifty_statuses` | Read for contacts they can see (`can_see_contact`) | Read and write all |
| `tasks` | Unchanged policy; commitments have no contact and are assigned to the manager, so reps don't see them | All |

Compass's server (phase 3) will check the same rules in code, like Edge's: Google sign-in, @renellence.com only, an
active `users` row; only `users.kind = 'admin'` may open another rep's 1-on-1. The rep's one-tap confirmation and visit
outcomes are written by Pulse's server, which checks the rep.

## 7. What Edge and Pulse must change

**Edge (`no-hubspot`, after approval)**
- New sidebar tab **Friday Check In** under Expenses (styled per the handoff; gold dot from Friday morning until
  `checkins.submitted_at`, then a check). UI built on sample data on branch `compass-checkin`, not merged.
- Reads: late forecasts + forecasts changed since last Friday (from `change_logs`), every account the rep owns with its
  derived group and the suggested pick (section 5), parked accounts left out until their date.
- Writes (`api/_edge/writes.js`): forecast moves/drops through the existing forecast writes plus a `forecast_changes`
  row each; the check-in (`checkins` + all `account_picks`) in one transaction on Submit; Park sets nothing else.
- Home's focus card: unchanged (it already reads the latest `one_on_one` goal task for the week). Optionally show the
  action target ("3 sampled clinics asked for an order date") from `one_on_ones`.
- Forecast page: forecasts added in the monthly 1-on-1 appear as normal forecasts. Customers: show the latest
  `fifty_statuses` status on My Fifty rows (On track / Watch / At risk).
- `focus_set` stays the one way to write the goal; Compass calls the same rule (one goal per week, the latest wins) and
  also sets `tasks.one_on_one_id`.
- SOP section 10 and the edge-dictionary-v2 artifacts get the new tables; `my-fifty/CHANGELOG-v2.md` logs the change.

**Pulse (My Fifty, `main`, after approval): the week view (not started, as asked)**
- **Today, top:** "This week's focus" (goal name + "<n> <weekly action>") and, until confirmed, a single
  **"Confirm my week"** button showing "N visits · N calls" -> sets `one_on_ones.week_confirmed_at`.
- **This week's visits:** the agreed visits (`final_pick = visit`) with their purpose. Logging a visit as usual creates
  the `interactions` row; Pulse links it (`visit_interaction_id`) = **Done**. A **Missed** button marks it missed (no reason asked)
  -> `missed_at`. Every visit ends Done or Missed.
- **This week's calls:** the agreed calls with their purpose; logging a call works as today.
- Parked accounts are hidden from Pulse's suggestions until their date. Nothing about suggestions or changes is shown.
- Pulse's `book.js` / `lists.js` (shared with Edge) gain the parked filter; keep both copies in sync.

**n8n:** none needed for phase 3. The meeting notes (purposes, next steps, extra commitments) come from the note taker
(open question 7). A weekend job for Second look can be a Compass/Edge daily cron (Hobby plan: once a day is enough).

## 8. Options the owner may prefer (one decision each): decided 2026-10-23, option A for all four

1. **Parked until:** A) derived from the latest Park pick + `park_days` *(Recommended: nothing stored twice)* ·
   B) `contacts.parked_until_date` (simpler queries, but a second copy of the same fact).
2. **Forecasts from the monthly 1-on-1:** A) normal forecasts, told apart by `change_logs.source = compass`
   *(Recommended: no new field)* · B) `forecasts.one_on_one_id` (a direct link, one more field).
3. **Weekly and monthly sessions:** A) one `one_on_ones` table with `kind` *(Recommended: SOP 2.2)* ·
   B) two tables as in the handoff (clearer columns, two nouns for one thing).
4. **Visit outcome:** A) columns on `account_picks` *(Recommended)* · B) a separate `visit_outcomes` table as in the
   handoff (one more table for two fields).

## 9. Open questions for the owner

1. **Cat's `users` row.** Caterina (Business Manager) needs an active `users` row with `kind = 'admin'` to sign in and see
   all reps. This is a data change, not structure. **What is her @renellence.com email?**
2. **GitHub repo.** `gh` is signed in as `yousefk07`, which has only read access to `Info-Renellence` repos
   (`Info-Renellence` is a user account, not an organisation), so `Info-Renellence/compass` could not be created.
   Create it as Info-Renellence (`gh auth login` with that account, then `gh repo create Info-Renellence/compass
   --private`) or add `yousefk07` as a collaborator, then push the local repo.
3. **Who may open Compass?** Proposed: admins run sessions for any rep; a rep signing in sees only their own sessions,
   read-only. Or admins only?
4. **The "Friday check-in" link in Compass's app bar.** Most screens show it, but the README says the app bar has two tabs
   (Weekly · Monthly) and the check-in is summarised in step 1. Built per the README; confirm.
5. **Stepper label "Practice" vs "Roleplay".** Screens 08 and 11 say Practice, 10b and the README say Roleplay. Built as
   Roleplay.
6. **Monthly skills list:** screen 17 shows 6 skills (no "Getting past the gatekeeper", plus "Planning the week"); the
   prototype has all 7. Built with all 7 so every weekly skill can be the month's skill. "Planning the week" has no
   roleplay character: is it a monthly-only skill?
7. **The meeting note taker.** Which tool writes purposes, next steps and extra commitments after the meeting, and where
   does it deliver them? Proposed: its output lands in `ai_outputs` (kind `next_steps`), which would need a new FK
   `ai_outputs.one_on_one_id` (one more "exactly one link" parent), and is applied to `account_picks.purpose` and
   manager `tasks`.
8. **Missed-visit reasons:** removed by the owner (2026-10-23). A missed visit is only marked missed, with no reason.
9. **Counting focus actions** like "asked for an order date" or "shown a second line" needs Pulse to capture them.
   Proposed: new `interactions.outcome` values (it is free text today, no structure change), e.g. `asked_order_date`,
   `showed_second_line`. Agree the list. (Referrals removed by the owner, 2026-10-23.)
10. **Forecast accuracy** needs a snapshot of each rep's forecasts on the 1st (`metric_snapshots`). Edge's old cron
    (`/api/forecast?snapshot=1`, 1st of the month) belongs to the v1 routes; confirm a v2 snapshot job.
11. **Monthly targets:** `targets` is empty in v2. Who enters each rep's monthly revenue target, and where (Edge admin)?
12. **The rep's week start:** the check-in plans Monday-Sunday (Toronto). Holidays: does a Monday holiday move the 1-on-1
    (and the monthly session) to Tuesday?
13. **Sample names.** The handoff uses a real rep's first name (Emily) and Cat; the sample data uses made-up names
    (rep "Tessa", manager "Bea") as the SOP requires. Real names appear only from the real API.
14. **change_logs volume:** a check-in writes one `account_picks` row per owned account (every lead too), each logged by
    the trigger. Fine at today's size; say if you'd rather not log `account_picks` inserts. **Answered 2026-10-23: log them** (every insert is logged).

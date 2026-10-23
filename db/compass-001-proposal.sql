-- ============================================================================================================
-- Compass: PROPOSED migration for Supabase v2 (ojphplepzuwchjtuycpv).  *** NOT RUN. DO NOT RUN WITHOUT THE OWNER'S YES. ***
-- Written 2026-10-23 for docs/compass-data-proposal.md. v2 holds real production data since 2026-10-22.
-- Follows renellence-edge/docs/data-model-sop.md (sections 2, 3, 7, 8) and the v2-008 naming rules.
-- When approved: apply the agreed parts only, log every change in my-fifty/CHANGELOG-v2.md, update SOP section 10,
-- and the edge-dictionary-v2 artifacts. Practise it first on v1 (the test database), like v2-008.
-- The script refuses to run unless the session sets: set compass.approved = 'yes';
-- ============================================================================================================

begin;

do $$ begin
  if coalesce(current_setting('compass.approved', true), '') <> 'yes' then
    raise exception 'compass-001 is a proposal: not approved by the owner yet';
  end if;
end $$;

-- ---------- 1. Fixed lists (enums), named <table>_<column> ---------------------------------------------------
create type account_picks_pick as enum ('visit', 'call', 'wait', 'park');                 -- suggested_pick, rep_pick, final_pick
create type account_picks_sort_group as enum ('candidate', 'onboarded', 'fifty', 'lead'); -- frozen at the check-in
create type account_picks_second_look_decision as enum ('keep', 'change');
create type account_picks_missed_reason as enum ('clinic_closed', 'ran_out_of_time', 'clinic_rescheduled', 'contact_unavailable', 'other');
create type forecast_changes_change_kind as enum ('moved', 'dropped', 'pushed_later', 'reduced', 'went_up', 'pulled_forward');
create type forecast_changes_reason as enum (
  'clinic_timing', 'still_has_stock', 'budget', 'decision_maker_unreachable', 'no_next_step', 'chose_other_brand',
  'estimate_off', 'more_patient_demand', 'new_product_line', 'clinic_pulled_forward');
create type one_on_ones_kind as enum ('weekly', 'monthly');
create type one_on_ones_skill as enum ('price_pushback', 'ask_for_order', 'book_next_step', 'ask_referral', 'gatekeeper', 'cold_visit', 'plan_week');
create type one_on_ones_roleplay_character as enum ('skeptic', 'fence_sitter', 'rusher', 'fan', 'gatekeeper', 'newcomer');
create type fifty_statuses_status as enum ('on_track', 'watch', 'at_risk');

-- New value in an existing list: changes made from Compass are told apart in change_logs (like my_fifty).
alter type change_logs_source add value if not exists 'compass';

-- ---------- 2. checkins: the rep's Friday check-in, one per rep per week -------------------------------------
create table checkins (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references users(id),
  week_start_date date not null,                 -- the Monday of the week being planned
  submitted_at timestamptz,                      -- empty = still a draft
  help_note text,                                -- "Where I need help from <manager>" (optional)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rep_id, week_start_date),
  constraint checkins_week_start_is_monday check (extract(isodow from week_start_date) = 1)
);

-- ---------- 3. account_picks: every account the rep sorted on Friday, and how its week ended --------------------
create table account_picks (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  sort_group account_picks_sort_group not null,  -- frozen: the group the account was in on Friday (SOP rule 9)
  suggested_pick account_picks_pick not null,
  suggested_reason text not null,                -- the one-line reason shown next to "Suggested"
  rep_pick account_picks_pick not null,          -- what the rep chose on Friday (kept as it was)
  final_pick account_picks_pick,                 -- what was agreed on Monday; empty until the 1-on-1 is saved
  purpose text,                                  -- the visit or call purpose, written from the meeting notes
  second_look_fact text,                         -- set when the pick is queued for "Second look" (plain fact line)
  second_look_decision account_picks_second_look_decision,
  visit_interaction_id uuid references interactions(id),  -- Done: the Pulse visit that closed it
  missed_reason account_picks_missed_reason,     -- Missed: why (from Pulse)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkin_id, contact_id),
  constraint account_picks_done_or_missed check (visit_interaction_id is null or missed_reason is null)
);

-- ---------- 4. forecast_changes: the reason for each forecast change made on Friday ---------------------------
-- The old and new values themselves stay in change_logs (forecasts already has the log_changes trigger).
create table forecast_changes (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null references forecasts(id),
  checkin_id uuid not null references checkins(id) on delete cascade,
  change_kind forecast_changes_change_kind not null,
  reason forecast_changes_reason not null,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (checkin_id, forecast_id)
);

-- ---------- 5. one_on_ones: each weekly or monthly 1-on-1 ---------------------------------------------------
create table one_on_ones (
  id uuid primary key default gen_random_uuid(),
  kind one_on_ones_kind not null,
  rep_id uuid not null references users(id),
  held_by_id uuid references users(id),          -- the admin who ran it
  session_date date not null,
  checkin_id uuid references checkins(id),       -- weekly: the Friday check-in it starts from
  focus_action_target_count integer check (focus_action_target_count between 1 and 15), -- weekly: the lead measure
  skill one_on_ones_skill,                       -- weekly: roleplay skill · monthly: skill of the month
  roleplay_character one_on_ones_roleplay_character,
  roleplay_done_at timestamptz,
  completed_at timestamptz,                      -- "Save the week" / "Save <month>"
  week_confirmed_at timestamptz,                 -- weekly: the rep's one tap in Pulse
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rep_id, kind, session_date),
  constraint one_on_ones_weekly_fields check (kind = 'weekly' or (checkin_id is null and focus_action_target_count is null and roleplay_character is null and roleplay_done_at is null and week_confirmed_at is null))
);

-- The weekly focus stays Edge's task (source one_on_one, title = goal key); the manager's commitments are tasks too
-- (assignee = the manager, no contact). Both are tied to their session by this one new column.
alter table tasks add column one_on_one_id uuid references one_on_ones(id);

-- ---------- 6. fifty_statuses: once a month, every My Fifty account gets a status --------------------------
create table fifty_statuses (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  month_start_date date not null check (extract(day from month_start_date) = 1),
  status fifty_statuses_status not null,
  one_on_one_id uuid references one_on_ones(id),
  set_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, month_start_date)
);

-- ---------- 7. Indexes on every column a rule or a screen filters on (SOP section 7) ------------------------
create index checkins_rep_id_idx on checkins (rep_id);
create index account_picks_contact_id_idx on account_picks (contact_id);
create index account_picks_final_pick_idx on account_picks (final_pick) where final_pick = 'park';
create index forecast_changes_forecast_id_idx on forecast_changes (forecast_id);
create index one_on_ones_rep_id_idx on one_on_ones (rep_id, session_date desc);
create index one_on_ones_checkin_id_idx on one_on_ones (checkin_id);
create index tasks_one_on_one_id_idx on tasks (one_on_one_id);
create index fifty_statuses_month_idx on fifty_statuses (month_start_date);

-- ---------- 8. Standard triggers: updated_at and the change log ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['checkins', 'account_picks', 'one_on_ones', 'fifty_statuses'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['checkins', 'account_picks', 'forecast_changes', 'one_on_ones', 'fifty_statuses'] loop
    execute format('create trigger log_changes after insert or update or delete on public.%I for each row execute function public.log_changes()', t);
  end loop;
end $$;

-- ---------- 9. Row-level security (SOP section 7): a rep sees only their own; admins see all ----------------
create or replace function public.can_see_checkin(cid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from checkins c where c.id = cid and c.rep_id = public.me())
$$;

alter table checkins enable row level security;
create policy own on checkins for all to authenticated
  using (rep_id = me() or is_admin()) with check (rep_id = me() or is_admin());

alter table account_picks enable row level security;
create policy by_checkin on account_picks for all to authenticated
  using (can_see_checkin(checkin_id)) with check (can_see_checkin(checkin_id));

alter table forecast_changes enable row level security;
create policy by_checkin on forecast_changes for all to authenticated
  using (can_see_checkin(checkin_id)) with check (can_see_checkin(checkin_id) and can_see_contact((select f.contact_id from forecasts f where f.id = forecast_id)));

-- 1-on-1s: the rep reads their own; only admins create or change them (the rep's week confirmation goes through
-- Pulse's server, which checks the rep).
alter table one_on_ones enable row level security;
create policy rep_read on one_on_ones for select to authenticated using (deleted_at is null and (rep_id = me() or is_admin()));
create policy admin_write on one_on_ones for all to authenticated using (is_admin()) with check (is_admin());

-- My Fifty statuses: readable with the contact; set by admins in the monthly 1-on-1.
alter table fifty_statuses enable row level security;
create policy by_contact_read on fifty_statuses for select to authenticated using (can_see_contact(contact_id));
create policy admin_write on fifty_statuses for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- 10. Settings row (data, not structure): the loop's thresholds, never hard-coded ------------------
insert into settings (key, value) values ('compass', jsonb_build_object(
  'max_visits', 15, 'park_days', 30, 'second_look_max', 4,
  'sampled_no_order_days', 20, 'fifty_quiet_days', 30, 'checkin_due_weekday', 5, 'checkin_due_time', '17:00'))
on conflict (key) do nothing;

-- rollback;  -- practise runs end here
commit;

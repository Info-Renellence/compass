// Compass ops against the test database (Supabase v1), each test rolled back.
//   node --require ./test/run/no-network.js test/run/db-compass.test.js
'use strict';
const path = require('path');
const fs = require('fs');
const h = require('./h');
const { test, eq, ok } = h;
const session = require(path.join(h.ROOT, 'api/_compass/session'));

// A rep with a small fictional book, and an admin to run the 1-on-1.
async function setup(sql) {
  const admin = await h.user(sql, { kind: 'admin', name: 'Bea Testadmin' });
  const rep = await h.user(sql, { kind: 'rep', name: 'Tessa Testrep' });
  const cand = await h.contact(sql, rep, { first: 'Noor', last: 'Sample' });
  await h.samples(sql, cand.id, { at: h.ago(30), deliveredAt: h.ago(25) });
  const fifty = await h.contact(sql, rep, { first: 'Kai', last: 'Sample' });
  await h.order(sql, fifty.id, { at: h.ago(80) });
  await h.order(sql, fifty.id, { at: h.ago(40) });
  const recent = await h.contact(sql, rep, { first: 'Raj', last: 'Sample' });
  await h.order(sql, recent.id, { at: h.ago(3) });
  const onb = await h.contact(sql, rep, { first: 'Ria', last: 'Sample' });
  await h.onboarded(sql, onb.id, { at: h.ago(6) });
  return { admin, rep, cand, fifty, recent, onb };
}

test('access: an admin gets in; a rep, head office, an inactive admin, an outsider and signed-out users are refused', async (sql) => {
  const { admin, rep } = await setup(sql);
  eq((await h.get(admin, 'session')).status, 200, 'admin');
  eq((await h.get(rep, 'session')).data.error, 'admins_only', 'rep');
  eq((await h.post(rep, 'weekly_save', { repId: rep.id, plan: {} })).status, 403, 'rep cannot write');
  const ho = await h.user(sql, { kind: 'head_office' });
  eq((await h.get(ho, 'session')).status, 403, 'head office');
  const off = await h.user(sql, { kind: 'admin', active: false });
  eq((await h.get(off, 'session')).data.error, 'not_set_up', 'inactive admin');
  eq((await h.get(null, 'session')).status, 401, 'signed out');
  eq((await h.call(null, 'GET', 'session', {}, { authorization: 'Bearer junk' })).status, 401, 'unverifiable token');
  process.env.COMPASS_SESSION_SECRET = 'test-' + h.uid();
  eq((await h.call(null, 'GET', 'session', {}, { authorization: 'Bearer ' + session.mint({ email: 'someone@gmail.com' }).token })).status, 401, 'outsider');
  eq((await h.call(null, 'GET', 'session', {}, { authorization: 'Bearer ' + session.mint({ email: h.MARK + h.uid() + '@renellence.com' }).token })).status, 403, 'not in users');
  eq((await h.get(null, 'config')).status, 200, 'config is public');
  process.env.VERCEL = '1';
  try { eq((await h.get(admin, 'session')).status, 401, 'dev sign-in ignored on Vercel'); } finally { delete process.env.VERCEL; }
});

test('reads: session, weekly and monthly have the screens\' shape', async (sql) => {
  const { admin, rep, cand, fifty, onb } = await setup(sql);
  const s = (await h.get(admin, 'session')).data;
  ok(s.reps.some((r) => r.id === rep.id) && !s.reps.some((r) => r.id === admin.id), 'reps list active reps only');
  const w = await h.get(admin, 'weekly', { rep: rep.id });
  eq(w.status, 200, 'weekly');
  for (const k of ['rep', 'manager', 'session', 'checkin', 'wins', 'lastFocus', 'tiles', 'missedVisits', 'forecastChanges', 'accounts', 'secondLook', 'roleplay', 'commitments']) ok(k in w.data, 'weekly.' + k);
  const by = Object.fromEntries(w.data.accounts.map((a) => [a.id, a]));
  eq([by[cand.id].group, by[cand.id].suggestedPick], ['candidate', 'visit'], 'sampled 25 days, no order');
  eq([by[fifty.id].group, by[fifty.id].suggestedPick], ['fifty', 'visit'], 'going cold');
  eq(by[onb.id].group, 'onboarded', 'onboarded');
  eq((await h.get(admin, 'weekly', { rep: admin.id })).status, 404, 'an admin is not a rep');
  const m = await h.get(admin, 'monthly', { rep: rep.id });
  eq(m.status, 200, 'monthly');
  for (const k of ['session', 'lastMonth', 'nextMonth', 'fifty', 'monthSkill']) ok(k in m.data, 'monthly.' + k);
  ok(m.data.fifty.some((f) => f.id === fifty.id && f.suggested === 'at_risk'), 'fifty status suggested');
});

test('weekly_save: check-in, picks, session, typed focus task (latest wins), commitments; all logged as compass; no visit cap (2026-10-27)', async (sql) => {
  const { admin, rep, cand, fifty } = await setup(sql);
  const w = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  const plan = (goal) => ({ picks: w.accounts.map((a) => ({ id: a.id, finalPick: a.id === fifty.id ? 'call' : a.repPick })), secondLook: [],
    focus: { text: goal, notes: 'notes for ' + goal }, roleplay: { skill: 'price_pushback', character: 'skeptic', done: true }, commitments: ['Send the price-objection guide'] });
  const r1 = await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan('Get Dr. Sample to a first order') });
  eq(r1.status, 200, 'saved ' + JSON.stringify(r1.data));
  const r2 = await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan('Call every clinic going quiet') });
  eq(r2.data.id, r1.data.id, 'one weekly session per week');
  const [o] = await sql`select * from one_on_ones where id = ${r1.data.id}`;
  eq([o.kind, o.focus_action_target_count, o.skill, !!o.roleplay_done_at, o.held_by_id], ['weekly', null, 'price_pushback', true, admin.id], 'session');
  const goals = await sql`select title, body, one_on_one_id from tasks where assignee_id = ${rep.id} and source = 'one_on_one' and deleted_at is null`;
  eq(goals.map((g) => [g.title, g.body, g.one_on_one_id]), [['Call every clinic going quiet', 'notes for Call every clinic going quiet', r1.data.id]], 'one live focus, the latest, with the notes');
  const again = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  eq([again.saved.focusText, again.saved.focusNotes], ['Call every clinic going quiet', 'notes for Call every clinic going quiet'], 'reopened week shows the focus');
  const com = await sql`select assignee_id, contact_id, title from tasks where one_on_one_id = ${r1.data.id} and assignee_id <> ${rep.id} and deleted_at is null`;
  eq(com.map((t) => [t.assignee_id, t.contact_id, t.title]), [[admin.id, null, 'Send the price-objection guide']], 'commitment for the admin, no contact');
  eq((await h.post(admin, 'weekly_commitments', { repId: rep.id, commitments: ['Join Tessa at the visit'] })).status, 200, 'commitments changed');
  eq((await sql`select title from tasks where one_on_one_id = ${r1.data.id} and assignee_id = ${admin.id} and deleted_at is null`).map((t) => t.title), ['Join Tessa at the visit']);
  const [p] = await sql`select final_pick from account_picks where checkin_id = ${r1.data.checkinId} and contact_id = ${cand.id}`;
  eq(p.final_pick, 'visit', 'final pick');
  for (const [t, id] of [['one_on_ones', r1.data.id], ['checkins', r1.data.checkinId], ['tasks', r1.data.focusTaskId]]) {
    const logs = await h.logsFor(sql, t, id);
    ok(logs.length && logs.every((l) => l.source === 'compass'), t + ' logged as compass');
  }
  await sql`update settings set value = value || '{"max_visits": 1}'::jsonb where key = 'compass'`;
  const two = plan('Visit them all'); two.picks = two.picks.map((x) => (x.id === fifty.id ? { id: x.id, finalPick: 'visit' } : x));
  eq((await h.post(admin, 'weekly_save', { repId: rep.id, plan: two })).status, 200, 'no visit cap in the 1-on-1 any more');
  const park = plan('Park one'); park.picks = park.picks.map((x) => (x.id === fifty.id ? { id: x.id, finalPick: 'park' } : x));
  eq((await h.post(admin, 'weekly_save', { repId: rep.id, plan: park })).status, 200, 'Park from Find a customer');
  eq((await h.post(admin, 'weekly_save', { repId: rep.id, plan: Object.assign(plan('x'), { focus: { text: '   ' } }) })).data.error, 'bad_focus');
});

test('second_look_list: picks that differed from the suggestion in sent check-ins, with ordered-since', async (sql) => {
  const { admin, rep, cand } = await setup(sql);
  const w = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  const [ck] = await sql`insert into checkins (rep_id, week_start_date, submitted_at) values (${rep.id}, ${w.session.weekStartDate}, now())
    on conflict (rep_id, week_start_date) do update set submitted_at = now() returning id`;
  await sql`delete from account_picks where checkin_id = ${ck.id} and contact_id = ${cand.id}`;
  await sql`insert into account_picks (checkin_id, contact_id, sort_group, suggested_pick, suggested_reason, rep_pick)
    values (${ck.id}, ${cand.id}, 'candidate', 'visit', 'Samples, no order', 'wait')`;
  const r = await h.get(admin, 'second_look_list', { rep: rep.id });
  eq(r.status, 200, 'answers');
  const row = r.data.rows.find((x) => x.contactId === cand.id);
  ok(row && row.repPick === 'wait' && row.suggestedPick === 'visit' && typeof row.outcome.ordered === 'boolean', 'the differing pick, with an outcome');
  ok(r.data.rows.every((x) => x.repPick !== x.suggestedPick), 'only differing picks');
});

test('monthly_save: skill, gap forecast, My Fifty statuses, committed forecast; logged as compass', async (sql) => {
  const { admin, rep, fifty } = await setup(sql);
  const m = (await h.get(admin, 'monthly', { rep: rep.id })).data;
  const gap = m.nextMonth.gap.map((g) => g.id);
  const r = await h.post(admin, 'monthly_save', { repId: rep.id, plan: { addedForecasts: gap, fiftyStatus: m.fifty.map((f) => ({ id: f.id, status: 'watch' })), skill: 'ask_for_order' } });
  eq(r.status, 200, 'saved ' + JSON.stringify(r.data));
  eq(r.data.forecastsAdded, gap.length, 'gap forecasts');
  const [s] = await sql`select fs.status, cl.source::text as source from fifty_statuses fs join change_logs cl on cl.entity_id = fs.id where fs.contact_id = ${fifty.id}`;
  eq([s.status, s.source], ['watch', 'compass'], 'status logged as compass');
  const [snap] = await sql`select metric_value from metric_snapshots where rep_id = ${rep.id} and metric = 'forecast_committed'`;
  ok(snap, 'committed forecast');
  eq((await h.post(admin, 'monthly_save', { repId: rep.id, plan: { addedForecasts: gap, fiftyStatus: [], skill: 'ask_for_order' } })).data.forecastsAdded, 0, 'no second forecast');
  eq((await h.post(admin, 'monthly_save', { repId: rep.id, plan: { addedForecasts: [], fiftyStatus: [{ id: admin.id, status: 'watch' }], skill: 'ask_for_order' } })).data.error, 'not_in_fifty');
});

// Run 3 (2026-10-23): going cold is MORE than fifty_quiet_days with no order or visit, as Edge's check-in (checkin.js
// suggest, `>`), book.js goingCold and Pulse's rule ("more than 30 days"). At exactly 30 days Compass said Visit /
// "Going cold" / at risk while Edge's check-in said nothing was due.
test('going cold at exactly 30 days is not yet cold (as Edge and Pulse); at 31 it is', async (sql) => {
  const { admin, rep } = await setup(sql);
  const d30 = await h.contact(sql, rep, { first: 'Thirty', last: 'Sample' });
  await h.order(sql, d30.id, { at: h.ago(60) });
  await h.order(sql, d30.id, { at: h.ago(30) });
  const d31 = await h.contact(sql, rep, { first: 'Thirtyone', last: 'Sample' });
  await h.order(sql, d31.id, { at: h.ago(60) });
  await h.order(sql, d31.id, { at: h.ago(31) });
  const by = Object.fromEntries((await h.get(admin, 'weekly', { rep: rep.id })).data.accounts.map((a) => [a.id, a]));
  ok(!/Going cold/.test(by[d30.id].suggestedReason) && by[d30.id].suggestedPick !== 'visit', '30 days: ' + JSON.stringify(by[d30.id]));
  ok(!/No order or visit since/.test(by[d30.id].fact), '30 days fact: ' + by[d30.id].fact);
  eq([by[d31.id].suggestedPick, /Going cold · 31 days/.test(by[d31.id].suggestedReason)], ['visit', true], '31 days');
  const f = Object.fromEntries((await h.get(admin, 'monthly', { rep: rep.id })).data.fifty.map((x) => [x.id, x.suggested]));
  eq([f[d30.id], f[d31.id]], ['on_track', 'at_risk'], 'My Fifty status suggestion');
});

// Run 3 (2026-10-23): "Missed visits" lists only agreed visits. A visit the rep marked Missed in Pulse that the manager
// then changed to a call (a re-save the same week) kept its missed mark and was listed as a missed visit.
test('missed visits: only picks that are still visits', async (sql) => {
  const { admin, rep, cand, fifty } = await setup(sql);
  const wk = h.weeks();
  const [ci] = await sql`insert into checkins (rep_id, week_start_date, submitted_at) values (${rep.id}, ${wk.lastMon}, now()) returning id`;
  await sql`insert into account_picks (checkin_id, contact_id, sort_group, suggested_pick, suggested_reason, rep_pick, final_pick, missed_at)
    values (${ci.id}, ${cand.id}, 'candidate', 'visit', 'r', 'visit', 'visit', now()), (${ci.id}, ${fifty.id}, 'fifty', 'visit', 'r', 'visit', 'call', now())`;
  const w = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  eq(w.missedVisits.map((m) => m.name), ['Noor Sample'], 'the visit, not the one turned into a call');
});

// Against Edge's committed files (git HEAD), so work in progress in Edge doesn't fail Compass.
test('shared rules are exact copies of Edge\'s committed ones (never forked)', async () => {
  const edge = path.join(h.ROOT, '..', 'renellence-edge');
  if (!fs.existsSync(edge)) return;
  const { execFileSync } = require('child_process');
  for (const f of ['book', 'lists', 'time', 'http']) {
    const mine = fs.readFileSync(path.join(h.ROOT, 'api/_compass', f + '.js'), 'utf8').split('\n').slice(1).join('\n');
    const theirs = execFileSync('git', ['-C', edge, 'show', 'HEAD:api/_edge/' + f + '.js'], { encoding: 'utf8' });
    eq(mine === theirs, true, f + '.js matches Edge');
  }
});

h.run();

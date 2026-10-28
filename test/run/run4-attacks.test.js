// Run 4 lane A (2026-10-27): access and bad-input attacks on Compass after the weekly rework. Test database (v1) only,
// every test rolled back. Fictional rows only.
//   node --require ./test/run/no-network.js test/run/run4-attacks.test.js
'use strict';
const path = require('path');
const h = require('./h');
const { test, eq, ok } = h;

async function setup(sql) {
  const admin = await h.user(sql, { kind: 'admin', name: 'Bea Testadmin' });
  const admin2 = await h.user(sql, { kind: 'admin', name: 'Cy Testadmin' });
  const rep = await h.user(sql, { kind: 'rep', name: 'Tessa Testrep' });
  const rep2 = await h.user(sql, { kind: 'rep', name: 'Uma Testrep' });
  const mine = await h.contact(sql, rep, { first: 'Noor', last: 'Sample' });
  await h.samples(sql, mine.id, { at: h.ago(30), deliveredAt: h.ago(25) });
  const theirs = await h.contact(sql, rep2, { first: 'Ola', last: 'Other' });
  await h.order(sql, theirs.id, { at: h.ago(40) });
  const ho = await h.user(sql, { kind: 'head_office', name: 'Hal Office' });
  const off = await h.user(sql, { kind: 'rep', name: 'Ina Inactive', active: false });
  return { admin, admin2, rep, rep2, mine, theirs, ho, off };
}
const plan = (w, over) => Object.assign({ picks: w.accounts.map((a) => ({ id: a.id, finalPick: a.repPick })), secondLook: [], focus: { text: 'Focus line', notes: '' }, roleplay: {}, commitments: [] }, over || {});

test('R4C-rep: only an active rep can be the subject; head office, an admin, an inactive rep, a junk id are not', async (sql) => {
  const { admin, rep, ho, off, admin2 } = await setup(sql);
  for (const [who, want] of [[ho, 404], [admin2, 404], [off, 404], [{ id: 'not-a-uuid' }, 400], [{ id: '' }, 400]]) {
    for (const op of ['weekly', 'monthly', 'second_look_list']) eq((await h.get(admin, op, { rep: who.id })).status, want, op + ' with ' + (who.kind || who.id));
  }
  eq((await h.get(admin, 'weekly', {})).status, 400, 'no rep');
  eq((await h.get(admin, 'weekly', { rep: rep.id.toUpperCase() })).status, 200, 'upper-case uuid is the same rep');
  for (const op of ['weekly_save', 'weekly_commitments', 'monthly_save']) {
    eq((await h.post(admin, op, { repId: ho.id, plan: {} })).status, 404, op + ' for head office');
    eq((await h.post(admin, op, { repId: off.id, plan: {} })).status, 404, op + ' for an inactive rep');
  }
});

test('R4C-ops: a write by GET, a read by POST, prototype names, junk bodies are all refused without a 500', async (sql) => {
  const { admin, rep } = await setup(sql);
  for (const op of ['weekly_save', 'monthly_save', 'weekly_commitments', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 'session ', 'WEEKLY']) {
    const g = await h.get(admin, op, { rep: rep.id });
    ok(g.status === 400 && g.data.error === 'unknown_op', 'GET ' + JSON.stringify(op) + ' -> ' + g.status + ' ' + JSON.stringify(g.data).slice(0, 80));
  }
  for (const op of ['weekly', 'monthly', 'session', 'second_look_list', '__proto__', 'constructor', 'toString', 'config', undefined, null, 5, ['weekly_save'], { a: 1 }]) {
    const p = await h.post(admin, op, { repId: rep.id });
    ok(p.status === 400 || p.status === 200 && op === undefined, 'POST ' + JSON.stringify(op) + ' -> ' + p.status);
    ok(p.status !== 500, 'no 500 for POST op ' + JSON.stringify(op));
  }
  eq((await h.call(admin, 'DELETE', 'weekly', {})).status, 405, 'DELETE');
  eq((await h.call(admin, 'PUT', 'weekly_save', {})).status, 405, 'PUT');
});

test('R4C-save: plan shapes and sizes never reach a 500; another rep\'s accounts are refused; text is cut', async (sql) => {
  const { admin, rep, theirs, mine } = await setup(sql);
  const w = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  const bodies = [
    { repId: rep.id }, { repId: rep.id, plan: 'x' }, { repId: rep.id, plan: [] }, { repId: rep.id, plan: null }, { repId: rep.id, plan: 5 },
    { repId: rep.id, plan: plan(w, { focus: 'text' }) }, { repId: rep.id, plan: plan(w, { focus: { text: ['a'] } }) }, { repId: rep.id, plan: plan(w, { focus: { text: { toString: 'x' } } }) },
    { repId: rep.id, plan: plan(w, { focus: { text: 'ok\u0000nul' } }) }, { repId: rep.id, plan: plan(w, { focus: { text: 'ok', notes: 'n\u0000' } }) },
    { repId: rep.id, plan: plan(w, { picks: 'x' }) }, { repId: rep.id, plan: plan(w, { picks: [null, 5, 'x', {}] }) }, { repId: rep.id, plan: plan(w, { picks: [{ id: theirs.id, finalPick: 'visit' }] }) },
    { repId: rep.id, plan: plan(w, { picks: [{ id: mine.id, finalPick: 'VISIT' }] }) }, { repId: rep.id, plan: plan(w, { picks: [{ id: mine.id, finalPick: ['visit'] }] }) },
    { repId: rep.id, plan: plan(w, { secondLook: [{ id: theirs.id, decision: 'keep' }] }) }, { repId: rep.id, plan: plan(w, { secondLook: [{ id: mine.id, decision: 'maybe' }] }) },
    { repId: rep.id, plan: plan(w, { roleplay: { skill: '__proto__' } }) }, { repId: rep.id, plan: plan(w, { roleplay: { character: 5 } }) },
    { repId: rep.id, plan: plan(w, { commitments: 'x' }) }, { repId: rep.id, plan: plan(w, { commitments: [null, 5, {}, { text: ['a'] }, { text: { toString: 'x' } }] }) },
    { repId: rep.id, plan: plan(w, { commitments: new Array(11).fill(0).map((_, i) => 'c' + i) }) },
    { repId: { toString: 'x' }, plan: plan(w) }, { repId: [rep.id], plan: plan(w) },
  ];
  for (let i = 0; i < bodies.length; i++) {
    const r = await h.post(admin, 'weekly_save', bodies[i]);
    ok(r.status !== 500, 'body ' + i + ' -> ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 100));
    if (r.status === 200) console.log('      body ' + i + ' was accepted: ' + JSON.stringify(bodies[i]).slice(0, 110));
  }
  eq((await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan(w, { picks: [{ id: theirs.id, finalPick: 'visit' }] }) })).data.error, 'not_in_week', 'another rep\'s account is not in this week');
  const long = 'x'.repeat(5000);
  const r = await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan(w, { focus: { text: long, notes: long } }) });
  eq(r.status, 200, 'long text is accepted and cut');
  const [t] = await sql`select title, body from tasks where id = ${r.data.focusTaskId}`;
  eq([t.title.length, t.body.length], [200, 2000], 'cut to 200 / 2000');
  // 20,000 junk picks
  const many = Array.from({ length: 20000 }, (_, i) => ({ id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), finalPick: 'visit' }));
  const t0 = Date.now();
  const big = await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan(w, { picks: many }) });
  eq(big.status, 400, 'junk picks refused');
  console.log('      20,000 junk picks refused in ' + (Date.now() - t0) + ' ms');
  // no rows from the failed saves beyond the one good save
  eq((await sql`select count(*)::int n from one_on_ones where rep_id = ${rep.id} and kind = 'weekly' and deleted_at is null`)[0].n, 1, 'one session');
});

test('R4C-two-admins: a second admin saving the same week takes over the session and the commitments (one session, one manager)', async (sql) => {
  const { admin, admin2, rep } = await setup(sql);
  const w = (await h.get(admin, 'weekly', { rep: rep.id })).data;
  const a = await h.post(admin, 'weekly_save', { repId: rep.id, plan: plan(w, { commitments: ['From the first admin'] }) });
  const b = await h.post(admin2, 'weekly_save', { repId: rep.id, plan: plan(w, { commitments: ['From the second admin'] }) });
  eq([a.status, b.status, a.data.id === b.data.id], [200, 200, true], 'one session');
  const live = await sql`select title, assignee_id from tasks where one_on_one_id = ${a.data.id} and assignee_id <> ${rep.id} and deleted_at is null`;
  console.log('      live commitments after both saves:', JSON.stringify(live.map((t) => t.title + (t.assignee_id === admin2.id ? ' (second admin)' : ' (first admin)'))));
  eq(live.map((t) => t.title), ['From the second admin'], 'the second save replaces the first admin\'s commitments');
  const [s] = await sql`select held_by_id from one_on_ones where id = ${a.data.id}`;
  eq(s.held_by_id, admin2.id, 'held by the second admin');
});

test('R4C-monthly: statuses and forecasts only for this rep\'s own accounts', async (sql) => {
  const { admin, rep, theirs, mine } = await setup(sql);
  eq((await h.post(admin, 'monthly_save', { repId: rep.id, plan: { skill: 'price_pushback', fiftyStatus: [{ id: theirs.id, status: 'watch' }] } })).data.error, 'not_in_fifty', 'another rep\'s account has no status here');
  eq((await h.post(admin, 'monthly_save', { repId: rep.id, plan: { skill: 'price_pushback', addedForecasts: [theirs.id] } })).data.error, 'not_in_gap', 'nor a forecast');
  eq((await h.post(admin, 'monthly_save', { repId: rep.id, plan: { skill: 'price_pushback', fiftyStatus: [{ id: mine.id, status: 'on_track' }] } })).data.error, 'not_in_fifty', 'a sample account is not in My Fifty');
  for (const p of [{ skill: 'nope' }, { skill: ['price_pushback'] }, { skill: 'price_pushback', addedForecasts: 'x' }, { skill: 'price_pushback', fiftyStatus: [{ id: mine.id, status: 'bad' }] }, 'x', null, []]) {
    const r = await h.post(admin, 'monthly_save', { repId: rep.id, plan: p });
    ok(r.status !== 500, 'monthly plan ' + JSON.stringify(p) + ' -> ' + r.status);
  }
  eq((await sql`select count(*)::int n from forecasts where contact_id = ${theirs.id} and created_by_id = ${admin.id}`)[0].n, 0, 'no forecast written for the other rep');
});

h.run();

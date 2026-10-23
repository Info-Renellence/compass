// Everything Compass reads (GET /api/compass?op=<op>). The shapes are the ones src/data/sample.js documents, so the
// screens work the same on sample data and on the real API. Every read is for one rep (?rep=<users.id>, an active rep)
// and is scoped to that rep's own book (contacts.owner_id), as row-level security would scope it.
const { fail, isUuid } = require('./http');
const T = require('./time');
const B = require('./book');
const R = require('./rules');

// The rep a session is with: an active users row of kind rep.
async function repFor(sql, id) {
  if (!isUuid(id)) throw fail(400, 'bad_id');
  const [u] = await sql`select id, email, full_name, kind, preferences from users where id = ${id} and is_active and kind = 'rep'`;
  if (!u) throw fail(404, 'not_found');
  const name = u.full_name || u.email.split('@')[0];
  const [first, ...rest] = name.split(/\s+/);
  return { id: u.id, kind: u.kind, preferences: {}, name, first, last: rest.join(' '), ini: R.initials(name) };
}

// "Sent Fri 4:12 pm"
function sentLabel(at) {
  if (!at) return null;
  const d = new Date(at);
  const day = d.toLocaleDateString('en-CA', { timeZone: T.TZ, weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { timeZone: T.TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, ' ');
  return 'Sent ' + day.replace('.', '') + ' ' + time;
}

// The latest focus goal of a week (Edge's rule: one per week, the latest wins), with its session's action target.
async function focusOf(sql, repId, wk) {
  const [t] = await sql`select t.id, t.title, t.created_at, t.one_on_one_id, o.focus_action_target_count as target from tasks t
      left join one_on_ones o on o.id = t.one_on_one_id and o.deleted_at is null
    where t.assignee_id = ${repId} and t.source = 'one_on_one' and t.deleted_at is null and t.title = any(${R.GOALS})
      and t.due_at >= ${wk.start} and t.due_at <= ${wk.end} order by t.created_at desc limit 1`;
  if (!t) return null;
  let target = t.target;
  if (target == null) {
    const [o] = await sql`select focus_action_target_count as n from one_on_ones where rep_id = ${repId} and kind = 'weekly' and session_date = ${wk.mon} and deleted_at is null`;
    target = o ? o.n : null;
  }
  return { id: t.id, goal: t.title, setAt: t.created_at, target, oneOnOneId: t.one_on_one_id };
}

async function session(sql, repId, kind, day) {
  const [s] = await sql`select * from one_on_ones where rep_id = ${repId} and kind = ${kind} and session_date = ${day} and deleted_at is null`;
  return s || null;
}

// The latest monthly skill on or before a day (the default skill in that month's roleplays).
async function monthSkill(sql, repId, day) {
  const [m] = await sql`select skill from one_on_ones where rep_id = ${repId} and kind = 'monthly' and deleted_at is null and skill is not null
    and session_date <= ${day} and session_date > ${T.addDays(day, -45)} order by session_date desc limit 1`;
  return m ? m.skill : null;
}

// Suggested commitments for the manager: from the help note's skill and this week's plan; saved ones come first, on.
const GUIDE = {
  price_pushback: 'Send the price-objection guide', ask_for_order: 'Send the closing questions', book_next_step: 'Send the next-step checklist',
  gatekeeper: 'Send the front-desk script', cold_visit: 'Send the cold-visit opener',
};
function commitments(saved, skill, rep, accounts, x) {
  const out = saved.map((t) => ({ key: 's' + t.id, text: t.title, on: true }));
  const add = (text) => { if (text && !out.some((c) => c.text === text)) out.push({ key: 'k' + out.length, text, on: false }); };
  add(GUIDE[skill || ''] || null);
  const visit = accounts.find((a) => a.repPick === 'visit');
  if (visit) add('Join ' + rep.first + ' at ' + R.firstName(x.byId[visit.id]) + '’s visit');
  if (x.biggestLate && x.byId[x.biggestLate]) add('Check ' + R.firstName(x.byId[x.biggestLate]) + '’s forecast with the clinic');
  add('Ask marketing for a post for ' + rep.first + '’s accounts');
  if (!saved.length && out.length) out[0].on = true;
  return out.slice(0, 6);
}

// Last week's wins: onboardings signed, samples placed, orders placed (the SOP's Ordered).
async function wins(sql, x, from, to) {
  const ids = x.people.map((p) => p.id);
  const out = [];
  const signed = ids.length ? await sql`select ob.primary_contact_id as cid from agreements a join onboardings ob on ob.agreement_id = a.id
    where a.kind = 'onboarding' and a.status = 'completed' and ob.primary_contact_id = any(${ids})
      and a.completed_at >= ${T.atLocal(from, 0, 0)} and a.completed_at <= ${T.atLocal(to, 23, 59)}` : [];
  for (const r of signed) { const p = x.byId[r.cid]; if (p) out.push({ title: p.name + ' signed onboarding', sub: p.clinic || 'Onboarding complete' }); }
  const sampled = x.people.filter((p) => p.orders.some((o) => B.isSample(o) && R.inRange(B.placedAt(o), from, to)));
  if (sampled.length) out.push({ title: 'Samples placed at ' + R.plural(sampled.length, 'clinic'), sub: sampled.slice(0, 3).map(R.firstName).join(', ') + (sampled.length > 3 ? ' and more' : '') });
  for (const p of x.people) {
    for (const o of p.orders.filter((o) => B.isOrder(o) && R.inRange(B.placedAt(o), from, to))) {
      const again = p.orders.some((e) => B.isOrder(e) && e.id !== o.id && new Date(B.placedAt(e)) < new Date(B.placedAt(o)));
      out.push({ title: p.name + (again ? ' reordered' : ' placed a first order'), sub: R.money(o.total) + ' · ' + R.short(B.placedAt(o)), total: o.total });
    }
  }
  return out.slice(0, 6).map((w) => ({ title: w.title, sub: w.sub }));
}

// "Could close the gap": accounts with no forecast in the month that are likely to order (a reorder rhythm, a first
// order that just landed, or a booked event). Each comes with the forecast "+ Add" would write.
async function gapRows(sql, x, monthKey) {
  const from = R.monthStart(monthKey), to = R.monthEnd(monthKey);
  const has = new Set(x.fcs.filter((f) => T.ymd(f.due_date).slice(0, 7) === monthKey).map((f) => f.contact_id));
  const ids = x.people.map((p) => p.id);
  const evRows = ids.length ? await sql`select ea.contact_id, e.name, e.starts_at from event_attendees ea join events e on e.id = ea.event_id
    where ea.contact_id = any(${ids}) and ea.status = 'rsvp' and e.deleted_at is null and e.starts_at >= ${T.atLocal(from, 0, 0)} and e.starts_at <= ${T.atLocal(to, 23, 59)}` : [];
  const evBy = Object.fromEntries(evRows.map((r) => [r.contact_id, r]));
  const today = x.today;
  const due = (d) => { let v = d < from ? from : d > to ? to : d; if (v < today) v = today; return v > to ? null : v; };
  const out = [];
  for (const p of x.people) {
    if (has.has(p.id)) continue;
    const os = p.orders.filter(B.isOrder).sort((a, b) => new Date(B.placedAt(a)) - new Date(B.placedAt(b)));
    if (!os.length) continue;
    const avg = os.reduce((a, o) => a + o.total, 0) / os.length;
    const syringes = Math.max(1, Math.round(avg / R.SYRINGE_PRICE));
    const last = B.placedAt(os[os.length - 1]);
    let why = null, day = null;
    if (os.length >= 2) {
      const gaps = os.slice(1).map((o, i) => T.daysBetween(B.placedAt(os[i]), B.placedAt(o)));
      const every = Math.max(7, Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length));
      const next = T.addDays(T.ymd(last), every);
      if (next <= to && next >= T.addDays(from, -every)) { why = 'Orders about every ' + Math.max(1, Math.round(every / 7)) + ' weeks · last order ' + R.short(last); day = next; }
    } else if (T.daysBetween(last, Date.now()) <= 60) { why = 'First order ' + R.short(last) + ' · reorder likely'; day = T.addDays(from, 14); }
    if (!why && evBy[p.id]) { why = 'Coming to ' + evBy[p.id].name + ' ' + R.short(evBy[p.id].starts_at); day = T.ymd(evBy[p.id].starts_at); }
    const dueDate = why ? due(day) : null;
    if (!dueDate) continue;
    out.push({ id: p.id, name: p.name, ini: R.initials(p.name), why, amount: syringes * R.SYRINGE_PRICE, syringes, dueDate });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
}

// The status suggested for a My Fifty account from its order rhythm.
function suggestedStatus(p, x) {
  if (p.coldDays >= x.cfg.compass.fifty_quiet_days) return 'at_risk';
  if (x.late[p.id] || x.failedAt[p.id]) return 'watch';
  return 'on_track';
}

const orderedIn = (x, rep, from, to) => x.people.flatMap((p) => p.orders.filter(B.isOrder)).filter(R.creditedTo(rep))
  .filter((o) => R.inRange(B.placedAt(o), from, to)).reduce((a, o) => a + o.total, 0);
async function targetOf(sql, repId, monthKey) {
  const [t] = await sql`select target_value from targets where rep_id = ${repId} and kind = 'target' and (metric = 'revenue' or metric is null)
    and period_start_date <= ${R.monthStart(monthKey)} and period_end_date >= ${R.monthStart(monthKey)} order by metric nulls last, period_start_date desc limit 1`;
  return t ? Number(t.target_value) : null;
}
function whyForecast(p) {
  if (!p) return 'Forecast';
  if (p.stage === 'fifty') return p.paidOrders > 1 || p.orders.filter(B.isOrder).length > 1 ? 'Regular reorder' : 'Second order';
  if (p.stage === 'candidate') return 'First order after samples';
  if (p.orders.some(B.isOrder)) return 'Back to ordering';
  return 'First order';
}

const OPS = {
  // Who is signed in, and the reps a 1-on-1 can be with (active reps only).
  async session(sql, me) {
    const rows = await sql`select id, full_name, email from users where is_active and kind = 'rep' order by full_name nulls last, email`;
    return {
      me: { first: me.first, name: me.name, kind: me.kind, email: me.email },
      reps: rows.map((u) => { const name = u.full_name || u.email.split('@')[0]; const [first, ...rest] = name.split(/\s+/); return { id: u.id, first, last: rest.join(' '), ini: R.initials(name) }; }),
    };
  },

  // The weekly 1-on-1 for the rep's current week (Monday to Sunday, Toronto).
  async weekly(sql, me, q) {
    const rep = await repFor(sql, q.get('rep'));
    const x = await R.load(sql, rep);
    const c = x.cfg.compass;
    const wk = R.weekOf(x.today), lw = R.weekOf(T.addDays(wk.mon, -7));
    const [[checkin], [lastCheckin], sess, lastFocus] = await Promise.all([
      sql`select * from checkins where rep_id = ${rep.id} and week_start_date = ${wk.mon}`,
      sql`select * from checkins where rep_id = ${rep.id} and week_start_date = ${lw.mon}`,
      session(sql, rep.id, 'weekly', wk.mon),
      focusOf(sql, rep.id, lw),
    ]);
    let picks;
    if (checkin) picks = (await sql`select * from account_picks where checkin_id = ${checkin.id}`).filter((a) => x.byId[a.contact_id]);
    else picks = R.derivePicks(x, await B.parkedUntil(sql, x.people.map((p) => p.id), { days: c.park_days, today: wk.mon }), wk.mon);   // the shared Park rule (book.js)
    const accounts = picks.map((a) => {
      const p = x.byId[a.contact_id];
      return { id: p.id, name: p.name, ini: R.initials(p.name), group: a.sort_group, fact: R.fact(p, x), suggestedPick: a.suggested_pick, suggestedReason: a.suggested_reason,
        repPick: a.rep_pick, purpose: a.purpose || '', finalPick: a.final_pick || null };
    });
    const stored = picks.filter((a) => a.second_look_fact).map((a) => ({ contact_id: a.contact_id, fact: a.second_look_fact, decision: a.second_look_decision }));
    const look = stored.length ? stored : checkin ? R.secondLook(picks, x) : [];

    // Last week: focus, tiles, missed visits.
    let lf = null;
    if (lastFocus) {
      const n = await R.focusActuals(sql, rep, x, lastFocus.goal, lw.mon, lw.sun);
      lf = { goal: lastFocus.goal, setLabel: 'Set ' + R.short(lastFocus.setAt), actionDone: n.action, actionTarget: lastFocus.target, result: n.result, resultNote: '' };
    }
    const lastPicks = lastCheckin ? (await sql`select * from account_picks where checkin_id = ${lastCheckin.id}`) : [];
    const acts = await R.activity(sql, x.people.map((p) => p.id), lw.mon, lw.sun);
    const visitedSet = new Set(acts.filter(R.isVisit).map((i) => i.contact_id));
    const calledSet = new Set(acts.filter(R.isCall).map((i) => i.contact_id));
    const plannedV = lastPicks.filter((a) => a.final_pick === 'visit'), plannedC = lastPicks.filter((a) => a.final_pick === 'call');
    const tile = (planned, set, done) => (lastCheckin ? { done: planned.filter((a) => done(a) || set.has(a.contact_id)).length, planned: planned.length } : { done: set.size, planned: null });
    const fiftyNow = x.people.filter((p) => R.inFiftyAt(p, Date.now(), x.cfg.fifty_months)).length;
    const fiftyThen = x.people.filter((p) => R.inFiftyAt(p, Date.now() - 7 * T.DAY, x.cfg.fifty_months)).length;
    const dueLast = x.fcs.filter((f) => R.inRange(f.due_date, lw.mon, lw.sun));
    const landed = dueLast.filter((f) => x.byId[f.contact_id] && R.fcState(x.byId[f.contact_id], f, x.today) === 'ordered').length;
    const changes = checkin ? await sql`select fc.change_kind, fc.reason, f.contact_id, f.due_date, f.deleted_at from forecast_changes fc join forecasts f on f.id = fc.forecast_id
      where fc.checkin_id = ${checkin.id} order by fc.created_at` : [];
    const KIND = { moved: 'moved to ', pushed_later: 'pushed to ', pulled_forward: 'pulled forward to ', dropped: 'dropped', reduced: 'reduced', went_up: 'went up' };
    const skill = R.noteSkill(checkin && checkin.help_note);
    const saved = sess ? await sql`select id, title from tasks where one_on_one_id = ${sess.id} and assignee_id <> ${rep.id} and deleted_at is null order by created_at` : [];
    const focusNow = await focusOf(sql, rep.id, wk);

    return {
      rep: { id: rep.id, first: rep.first, ini: rep.ini },
      manager: { first: me.first },
      session: { kind: 'weekly', dateLabel: R.dateLabel(wk.mon), minutes: 45, weekStartDate: wk.mon, id: sess ? sess.id : null, completedAt: sess ? sess.completed_at : null,
        maxVisits: c.max_visits },
      checkin: { id: checkin ? checkin.id : null, submittedLabel: checkin ? sentLabel(checkin.submitted_at) || 'Draft, not sent' : 'No Friday check-in', helpNote: (checkin && checkin.help_note) || '' },
      wins: await wins(sql, x, lw.mon, lw.sun),
      lastFocus: lf,
      tiles: {
        fifty: { count: fiftyNow, note: fiftyNow === fiftyThen ? 'No change this week' : (fiftyNow > fiftyThen ? '+' : '') + (fiftyNow - fiftyThen) + ' this week' },
        forecastLanded: { landed, due: dueLast.length },
        visits: tile(plannedV, visitedSet, (a) => !!a.visit_interaction_id),
        calls: tile(plannedC, calledSet, () => false),
      },
      missedVisits: lastPicks.filter((a) => a.missed_at && x.byId[a.contact_id]).map((a) => ({ name: x.byId[a.contact_id].name })),
      forecastChanges: changes.filter((r) => x.byId[r.contact_id]).map((r) => ({ who: R.firstName(x.byId[r.contact_id]),
        what: KIND[r.change_kind] + (KIND[r.change_kind].endsWith(' ') ? R.monthName(T.ymd(r.due_date).slice(0, 7)) : ''), reason: R.REASONS[r.reason] || r.reason })),
      accounts,
      secondLook: look.map((l) => ({ id: l.contact_id, fact: l.fact, decision: l.decision || null })),
      roleplay: { noteSkill: skill, noteCharacter: skill ? R.SKILL_CHARACTER[skill] : null, monthSkill: await monthSkill(sql, rep.id, wk.sun) },
      commitments: commitments(saved, skill, rep, accounts, x),
      // What this session already saved, so reopening it shows the agreed week.
      saved: sess ? { goal: focusNow && focusNow.oneOnOneId === sess.id ? focusNow.goal : null, target: sess.focus_action_target_count, skill: sess.skill,
        character: sess.roleplay_character, practiced: !!sess.roleplay_done_at } : null,
    };
  },

  // The monthly 1-on-1 for the month this week plans (rules.plannedMonth).
  async monthly(sql, me, q) {
    const rep = await repFor(sql, q.get('rep'));
    const x = await R.load(sql, rep);
    const wk = R.weekOf(x.today);
    const M = R.plannedMonth(x.today), L = R.addMonths(M, -1), P = R.addMonths(M, -2);
    const sess = await session(sql, rep.id, 'monthly', wk.mon);
    const [tL, tP, tM] = await Promise.all([targetOf(sql, rep.id, L), targetOf(sql, rep.id, P), targetOf(sql, rep.id, M)]);
    const oL = orderedIn(x, rep, R.monthStart(L), R.monthEnd(L)), oP = orderedIn(x, rep, R.monthStart(P), R.monthEnd(P));
    const [snap] = await sql`select metric_value from metric_snapshots where rep_id = ${rep.id} and metric = 'forecast' and snapshot_date = ${R.monthStart(L)}`;
    const snapV = snap ? Number(snap.metric_value) : 0;
    const endL = T.atLocal(R.monthEnd(L), 23, 59), endP = T.atLocal(R.monthEnd(P), 23, 59);
    const inL = x.people.filter((p) => R.inFiftyAt(p, endL, x.cfg.fifty_months)), inP = new Set(x.people.filter((p) => R.inFiftyAt(p, endP, x.cfg.fifty_months)).map((p) => p.id));
    const joined = inL.filter((p) => !inP.has(p.id)), diff = inL.length - inP.size;
    const slips = await sql`select fc.reason, count(*)::int as n from forecast_changes fc join checkins c on c.id = fc.checkin_id
      where c.rep_id = ${rep.id} and c.week_start_date >= ${R.monthStart(L)} and c.week_start_date <= ${R.monthEnd(L)} and fc.change_kind = any(${R.SLIP_KINDS})
      group by 1 order by 2 desc, 1`;
    const top = slips[0];
    // Weekly focus in the month: every Monday of it with a focus goal.
    const weeks = [];
    for (let d = R.weekOf(R.monthStart(L)).mon; d <= R.monthEnd(L); d = T.addDays(d, 7)) if (d >= R.monthStart(L)) weeks.push(d);
    const focusWeeks = [];
    for (const mon of weeks) {
      const f = await focusOf(sql, rep.id, R.weekOf(mon));
      if (!f) continue;
      const n = await R.focusActuals(sql, rep, x, f.goal, mon, T.addDays(mon, 6));
      focusWeeks.push({ week: R.short(mon + 'T12:00:00Z'), goal: f.goal, done: n.action, target: f.target || 0 });
    }
    const fcM = x.fcs.filter((f) => T.ymd(f.due_date).slice(0, 7) === M && x.byId[f.contact_id]);
    const statuses = await sql`select contact_id, status from fifty_statuses where month_start_date = ${R.monthStart(M)} and contact_id = any(${x.people.map((p) => p.id)})`;
    const statusBy = Object.fromEntries(statuses.map((s) => [s.contact_id, s.status]));
    const prevSkill = await monthSkill(sql, rep.id, T.addDays(wk.mon, -1));
    return {
      rep: { id: rep.id, first: rep.first, ini: rep.ini },
      manager: { first: me.first },
      session: { kind: 'monthly', dateLabel: R.dateLabel(wk.mon), minutes: 60, monthKey: M, lastMonth: R.monthName(L), nextMonth: R.monthName(M), lastMonthShort: R.monthName(L).slice(0, 3),
        prevMonth: R.monthName(P), id: sess ? sess.id : null, completedAt: sess ? sess.completed_at : null },
      lastMonth: {
        target: tL, ordered: oL, prevPercent: tP ? Math.round(oP / tP * 100) : null,
        forecastAccuracy: snapV > 0 ? Math.round(Math.min(oL, snapV) / snapV * 100) : null, accuracyNote: R.short(R.monthStart(L) + 'T12:00:00Z'),
        fifty: { count: inL.length, note: (diff === 0 ? 'No change' : (diff > 0 ? '+' : '') + diff) + ' this month' + (joined.length ? ' · ' + joined.slice(0, 2).map(R.firstName).join(' and ') + ' joined' : '') },
        slipped: slips.map((s) => [R.REASONS[s.reason] || s.reason, s.n]),
        pattern: top && top.n >= 2 ? (R.REASONS[top.reason] || top.reason).toLowerCase() + ' came up ' + top.n + ' times. Worth asking about it earlier in the month.' : '',
        focusWeeks,
      },
      nextMonth: {
        target: tM,
        forecast: fcM.map((f) => { const p = x.byId[f.contact_id]; return { id: f.id, name: p.name, ini: R.initials(p.name), why: whyForecast(p) + ' · due ' + R.short(f.due_date), amount: R.fcValue(f) }; }),
        gap: (await gapRows(sql, x, M)).map(({ id, name, ini, why, amount }) => ({ id, name, ini, why, amount })),
      },
      fifty: x.people.filter((p) => p.stage === 'fifty').sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ id: p.id, name: p.name, ini: R.initials(p.name), fact: R.fact(p, x), suggested: statusBy[p.id] || suggestedStatus(p, x), saved: statusBy[p.id] || null })),
      monthSkill: (sess && sess.skill) || prevSkill || 'price_pushback',
    };
  },
};

module.exports = { OPS, repFor, gapRows, focusOf, sentLabel, suggestedStatus };

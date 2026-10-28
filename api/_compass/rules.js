// Compass's own rules: the week and month a session is for, the suggested pick, the fact line, Second look, the
// help-note skill match and the focus actuals (docs/compass-data-proposal.md sections 4 and 5). Everything here is
// worked out from v2's records at read time; nothing derived is stored except what a save freezes on purpose
// (account_picks.suggested_pick / suggested_reason / sort_group / second_look_fact, SOP rule 9).
//
// The shared rules (stages, Ordered, paid, reached, going cold) are NOT here: they are book.js, copied from Edge.
// Thresholds come from settings (key compass, plus my_fifty / edge), never hard-coded; DEFAULTS only fill a missing key.
const T = require('./time');
const B = require('./book');

// Edge's "This week's focus" keys (renellence-edge/api/_edge/view.js GOALS; test/rules.test.js checks they match).
const GOALS = ['close', 'warm', 'grow', 'fill', 'events'];
// The roleplay skill and its matching character (src/data/catalog.js SKILLS; the test checks they match).
const SKILL_CHARACTER = { price_pushback: 'skeptic', ask_for_order: 'fence_sitter', book_next_step: 'rusher', gatekeeper: 'gatekeeper', cold_visit: 'newcomer', plan_week: null };
const SKILLS = Object.keys(SKILL_CHARACTER);
const CHARACTERS = ['skeptic', 'fence_sitter', 'rusher', 'fan', 'gatekeeper', 'newcomer'];
const PICKS = ['visit', 'call', 'wait', 'park'];
const FIFTY_STATUSES = ['on_track', 'watch', 'at_risk'];
const REASONS = {
  clinic_timing: 'Clinic’s timing', still_has_stock: 'Still has stock', budget: 'Budget or cash flow',
  decision_maker_unreachable: 'Can’t reach the decision maker', no_next_step: 'No next step', chose_other_brand: 'Chose another brand',
  estimate_off: 'Estimate was off', more_patient_demand: 'More patient demand', new_product_line: 'New product line',
  clinic_pulled_forward: 'Clinic pulled it forward',
};
const SLIP_KINDS = ['moved', 'dropped', 'pushed_later', 'reduced'];

const DEFAULTS = { max_visits: 15, park_days: 30, second_look_max: 4, sampled_no_order_days: 20, fifty_quiet_days: 30 };
const SYRINGE_PRICE = 225;   // Edge's forecast default (reads.js forecast: syringePrice 225, cannula 185)
const CANNULA_PRICE = 185;
const NEW_LEAD_DAYS = 14;      // "new ad lead -> Call": a Meta lead nobody has contacted, in the last two weeks
const RECENT_ORDER_DAYS = 14;   // "ordered in the last 14 days, nothing open -> Wait" (proposal section 5)

// Book settings (my_fifty, holidays) plus Compass's thresholds (settings key compass).
async function settings(sql) {
  const [cfg, rows] = await Promise.all([B.settings(sql), sql`select key, value from settings where key = any(${['compass', 'edge']})`]);
  const by = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const edge = by.edge || {};
  return Object.assign(cfg, { fifty_months: edge.fifty_months || cfg.fifty_months }, { compass: Object.assign({}, DEFAULTS, by.compass || {}) });
}

// ---- dates ------------------------------------------------------------------------------------------------
// The Toronto week (Monday 00:00 to Sunday 23:59) that a day falls in (copied from renellence-edge/api/_edge/view.js weekOf).
function weekOf(day) {
  const d = day || T.ymd();
  const mon = T.addDays(d, -((T.weekday(d) + 6) % 7));
  const sun = T.addDays(mon, 6);
  return { mon, sun, start: T.atLocal(mon, 0, 0), end: T.atLocal(sun, 23, 59) };
}
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthStart = (key) => key + '-01';
const monthEnd = (key) => T.addDays(monthStart(addMonths(key, 1)), -1);
const monthName = (key) => MONTH_LONG[+key.slice(5, 7) - 1];
// The month a monthly 1-on-1 plans: the month whose first week this is (the week holds the 1st, or Monday is day 1-7);
// otherwise, mid-month, the coming month.
function plannedMonth(today) {
  const wk = weekOf(today);
  if (wk.sun.slice(0, 7) !== wk.mon.slice(0, 7)) return wk.sun.slice(0, 7);
  if (+wk.mon.slice(8, 10) <= 7) return wk.mon.slice(0, 7);
  return addMonths(wk.mon.slice(0, 7), 1);
}
const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const dateLabel = (day) => DOW[T.weekday(day)] + ' ' + T.short(day + 'T12:00:00Z').toUpperCase();
const inRange = (at, from, to) => { if (!at) return false; const d = T.ymd(at); return d >= from && d <= to; };

// ---- words -----------------------------------------------------------------------------------------------
const short = (at) => (at ? T.short(at) : '');
function kMoney(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1000) { const k = v / 1000; return '$' + (k >= 100 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')) + 'K'; }
  return '$' + v.toLocaleString('en-CA');
}
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');
// The first LETTER of each of the first two words, as Edge's view.js and Pulse (run 4: "Jo (Ann's Nurse)" showed "J(").
const initials = (name) => String(name || '').replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w) => (w.match(/\p{L}/u) || [''])[0]).filter(Boolean).slice(0, 2).map((c) => c.toUpperCase()).join('');
// "Dr. Noor" / "Kai": how the screens name someone in a sentence.
const firstName = (p) => (/^Dr\.\s/.test(p.name) ? 'Dr. ' + (p.first || p.name.split(/\s+/)[1] || '') : p.first || p.name.split(/\s+/)[0]);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

// ---- forecasts (copied from renellence-edge/api/_edge/reads.js fcValue / fcState) ---------------------------
function fcValue(f) { return (f.syringes || 0) * Number(f.syringe_price || 0) + (f.cannula_boxes || 0) * Number(f.cannula_box_price || 0) + (f.needle_boxes || 0) * Number(f.needle_box_price || 0); }
function fcState(p, f, today) {
  const due = T.ymd(f.due_date);
  const from = due.slice(0, 7) + '-01';
  const onTime = p.orders.some((o) => { if (!B.isOrder(o)) return false; const d = T.ymd(B.placedAt(o)); return d >= from && d <= due; });
  return onTime ? 'ordered' : (today || T.ymd()) > due ? 'late' : 'forecast';
}
// Orders that count for a rep (Edge's creditedTo for a rep): their own or nobody's.
const creditedTo = (rep) => (o) => !o.rep_id || o.rep_id === rep.id;

// ---- the rep's book plus what the rules need beyond it --------------------------------------------------------
async function load(sql, rep) {
  const cfg = await settings(sql);
  const { people } = await B.book(sql, rep, { cfg });
  const ids = people.map((p) => p.id);
  const today = T.ymd();
  const none = !ids.length;
  const [signed, fcs, failed, events, calls] = await Promise.all([
    none ? [] : sql`select ob.primary_contact_id as cid, max(a.completed_at) as at from agreements a join onboardings ob on ob.agreement_id = a.id
      where a.kind = 'onboarding' and a.status = 'completed' and ob.primary_contact_id = any(${ids}) group by 1`,
    none ? [] : sql`select id, contact_id, due_date, syringes, syringe_price, cannula_boxes, cannula_box_price, needle_boxes, needle_box_price, created_at
      from forecasts where contact_id = any(${ids}) and deleted_at is null order by due_date`,
    none ? [] : sql`select o.contact_id as cid, max(p.created_at) as at from payments p join orders o on o.id = p.order_id
      where o.contact_id = any(${ids}) and p.kind = 'charge' and p.status = 'failed' and p.is_test is not true and p.created_at > now() - interval '14 days'
        and not exists (select 1 from payments q where q.order_id = p.order_id and q.status = 'succeeded' and q.created_at > p.created_at) group by 1`,
    none ? [] : sql`select c.id as cid, e.starts_at from contacts c join events e on e.id = c.lead_source_event_id where c.id = any(${ids})`,
    none ? [] : sql`select i.contact_id as cid,
        count(*) filter (where not ${B.REACHED(sql)})::int as unanswered, count(*) filter (where ${B.REACHED(sql)})::int as reached
      from interactions i where i.contact_id = any(${ids}) and i.deleted_at is null and ${B.CALL(sql)} and not ${B.INBOUND(sql)}
        and i.status is distinct from 'scheduled' and i.status is distinct from 'cancelled' and i.occurred_at > now() - interval '21 days' group by 1`,
  ]);
  const signedAt = Object.fromEntries(signed.map((r) => [r.cid, r.at]));
  const failedAt = Object.fromEntries(failed.map((r) => [r.cid, r.at]));
  const eventAt = Object.fromEntries(events.map((r) => [r.cid, r.starts_at]));
  const callsBy = Object.fromEntries(calls.map((r) => [r.cid, r]));
  const fcBy = B.group(fcs, 'contact_id');
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  // The late forecasts (due before today, no order by the due day) and the biggest one.
  const late = {};
  for (const f of fcs) {
    const p = byId[f.contact_id];
    if (p && fcState(p, f, today) === 'late' && !late[p.id]) late[p.id] = { amount: fcValue(f), due: f.due_date };
  }
  const biggestLate = Object.keys(late).sort((a, b) => late[b].amount - late[a].amount)[0] || null;
  return { cfg, people, byId, fcs, fcBy, signedAt, failedAt, eventAt, callsBy, late, biggestLate, today };
}

// The group an account is sorted into (frozen on the pick at the check-in).
function groupOf(p) {
  if (p.stage === 'fifty') return 'fifty';
  if (p.stage === 'candidate') return 'candidate';
  return p.leadGroup === 'onboarded' ? 'onboarded' : 'lead';
}

// The plain fact line next to an account.
function fact(p, x) {
  const g = groupOf(p);
  if (g === 'candidate') {
    const s = p.sampleOrder || {};
    const how = s.delivered_at ? 'arrived ' + short(s.delivered_at) : s.shipped_at ? 'shipped ' + short(s.shipped_at) : 'ordered ' + short(B.placedAt(s));
    return 'Samples ' + how + ' · no order';
  }
  if (g === 'onboarded') return 'Onboarding signed ' + (x.signedAt[p.id] ? short(x.signedAt[p.id]) : '') + ' · no samples yet';
  if (g === 'fifty') {
    if (x.late[p.id]) return 'Late forecast ' + kMoney(x.late[p.id].amount) + ' · last order ' + short(p.lastOrderAt);
    if (x.failedAt[p.id]) return 'Card declined ' + short(x.failedAt[p.id]);
    if (p.coldDays > x.cfg.compass.fifty_quiet_days) return 'No order or visit since ' + short(p.lastActiveAt);
    return 'Ordered ' + short(p.lastOrderAt);
  }
  const src = p.sourceKind === 'social' ? 'Meta lead · came in ' + short(p.createdAt)
    : p.sourceKind === 'event' ? 'Event lead' + (p.eventName ? ' · ' + p.eventName : '')
      : p.leadGroup === 'warm' ? 'Warm · ordered before, last ' + short(p.lastOrderAt)
        : p.sourceKind === 'warm' ? 'Warm lead' : 'Cold lead';
  return src + (p.lastTouchAt ? ' · last touch ' + short(p.lastTouchAt) : ' · never contacted');
}

// The suggested pick and its one-line reason (proposal section 5, first match wins).
function suggest(p, x) {
  const c = x.cfg.compass, g = groupOf(p), now = Date.now();
  if (g === 'candidate' && p.samplesAt && p.sampleDays >= c.sampled_no_order_days) return ['visit', 'Samples ' + p.sampleDays + ' days ago and no order. Ask for the date.'];
  if (g === 'onboarded') {
    const d = x.signedAt[p.id] ? T.daysBetween(x.signedAt[p.id], now) : null;
    if (d != null && d <= 2) return ['call', 'Signed ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago') + '. Book a sample drop.'];
    if (d != null && d > 14) return ['visit', 'Signed ' + d + ' days ago and still no samples. Drop samples.'];
    return ['visit', (d != null ? 'Signed ' + d + ' days ago' : 'Signed') + ' with no samples. Drop samples while it’s fresh.'];
  }
  if (g === 'fifty' && p.coldDays > c.fifty_quiet_days) return ['visit', 'Going cold · ' + p.coldDays + ' days. Go in person.'];
  if (x.late[p.id]) return x.biggestLate === p.id ? ['visit', 'Biggest late forecast. Confirm the order or a new date.'] : ['call', 'Late forecast. Ask for the new date.'];
  if (x.failedAt[p.id]) return ['call', 'Payment failed. Send a new link.'];
  const ev = x.eventAt[p.id];
  if (g === 'lead' && p.sourceKind === 'event' && ev && new Date(ev) < new Date(now) && (!p.lastTouchAt || new Date(p.lastTouchAt) < new Date(ev))) {
    return ['call', 'Came to ' + (p.eventName || 'the event') + ' ' + T.daysBetween(ev, now) + ' days ago and nobody called.'];
  }
  if (g === 'lead' && p.sourceKind === 'social' && p.isNew && T.daysBetween(p.createdAt, now) <= NEW_LEAD_DAYS) return ['call', 'New Meta lead. Call within the week.'];
  if (p.lastOrderAt && T.daysBetween(p.lastOrderAt, now) <= RECENT_ORDER_DAYS) {
    const d = T.daysBetween(p.lastOrderAt, now);
    return ['wait', 'Ordered ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago') + '.'];
  }
  const calls = x.callsBy[p.id];
  if (calls && calls.unanswered >= 2 && !calls.reached) return ['park', 'No answer to ' + calls.unanswered + ' calls. Try again next month.'];
  if (g === 'fifty') return ['wait', 'Nothing due right now.'];
  if (g === 'candidate') return p.samplesAt ? ['call', 'Check in on the samples.'] : ['wait', 'Samples are on the way.'];
  return ['wait', 'Nothing due this week.'];
}

// Every account the rep owns, sorted for the week as the Friday check-in would (used when there is no check-in):
// accounts parked within park_days are left out until their date. The rep's pick is the suggestion; visits past the
// weekly cap become calls (the suggestion itself stays).
function derivePicks(x, parkedUntil, weekMon) {
  const c = x.cfg.compass;
  const out = [];
  for (const p of x.people) {
    if (parkedUntil[p.id] && parkedUntil[p.id] > weekMon) continue;
    const [pick, reason] = suggest(p, x);
    out.push({ contact_id: p.id, sort_group: groupOf(p), suggested_pick: pick, suggested_reason: reason, rep_pick: pick, final_pick: null, purpose: null, second_look_fact: null, second_look_decision: null });
  }
  const rank = (a) => (a.suggested_reason.startsWith('Biggest') ? 0 : a.sort_group === 'candidate' ? 1 : a.sort_group === 'onboarded' ? 2 : a.sort_group === 'fifty' ? 3 : 4);
  const visits = out.filter((a) => a.rep_pick === 'visit').sort((a, b) => rank(a) - rank(b));
  visits.slice(c.max_visits).forEach((a) => { a.rep_pick = 'call'; });
  return out;
}

// Second look (proposal section 5): at most second_look_max picks where the rep's pick differs from the suggestion and
// the data points elsewhere. Only the plain fact line is kept.
function secondLook(picks, x) {
  const c = x.cfg.compass, now = Date.now();
  const skippedStrong = picks.some((a) => a.suggested_pick === 'visit' && ['wait', 'park'].includes(a.rep_pick));
  const out = [];
  for (const a of picks) {
    if (out.length >= c.second_look_max) break;
    if (a.rep_pick === a.suggested_pick) continue;
    const p = x.byId[a.contact_id];
    if (!p) continue;
    let f = null;
    if (a.rep_pick === 'park' && p.stage === 'candidate' && p.samplesAt && p.sampleDays >= c.sampled_no_order_days) f = 'Samples ' + p.sampleDays + ' days ago · no order yet';
    else if (a.rep_pick === 'wait' && p.stage === 'fifty' && p.coldDays >= c.fifty_quiet_days) f = 'My Fifty · ' + p.coldDays + ' days since the last order or visit';
    else if (a.rep_pick === 'park' && p.sourceKind === 'event' && p.stage === 'lead' && x.eventAt[p.id] && (!p.lastTouchAt || new Date(p.lastTouchAt) < new Date(x.eventAt[p.id]))) f = 'Came to ' + (p.eventName || 'the event') + ' ' + short(x.eventAt[p.id]) + ' · no call since';
    else if (a.rep_pick === 'visit' && skippedStrong && p.lastOrderAt && T.daysBetween(p.lastOrderAt, now) <= RECENT_ORDER_DAYS) f = 'Ordered ' + short(p.lastOrderAt) + ' · nothing due right now';
    if (f) out.push({ contact_id: a.contact_id, fact: f });
  }
  return out;
}

// The help note -> the skill it is about (the gold dot on Roleplay; a simple keyword rule, proposal section 4).
const NOTE_RULES = [
  ['price_pushback', /\b(price|pricing|pricier|expensive|cost|discount|cheaper)/i],
  ['gatekeeper', /\b(front desk|gatekeeper|reception|can.?t reach|can.?t get (to|past)|never (in|there))/i],
  ['ask_for_order', /\b(clos(e|ing)|commit|ask(ing)? for the order|order date|on the fence|think about it)/i],
  ['book_next_step', /\b(next step|follow.?up|book(ing)?|meeting|busy|rush)/i],
  ['cold_visit', /\b(cold|walk.?in|new clinic|intro|first visit|never heard)/i],
];
function noteSkill(note) {
  const hit = NOTE_RULES.find(([, re]) => re.test(note || ''));
  return hit ? hit[0] : null;
}

// ---- focus actuals (proposal section 5), counted for one week from Pulse interactions and orders -------------
// The weekly action (lead measure) and the result (lag measure) of a goal for the rep's book, for the week from..to.
// Until the outcome values of open question 9 are agreed, "asked for an order date" and "shown a second line" are counted
// as the reached visit or call itself.
const isVisit = (i) => i.kind === 'meeting' && ['in_person', 'video'].includes(i.mode) && i.reached;
const isCall = (i) => (i.kind === 'call' || (i.kind === 'meeting' && !i.mode)) && i.direction !== 'in';
async function activity(sql, ids, from, to) {
  if (!ids.length) return [];
  return sql`select i.contact_id, i.kind::text as kind, i.mode::text as mode, i.direction::text as direction, i.occurred_at, ${B.REACHED(sql)} as reached
    from interactions i where i.contact_id = any(${ids}) and i.deleted_at is null and i.status is distinct from 'scheduled' and i.status is distinct from 'cancelled'
      and i.occurred_at >= ${T.atLocal(from, 0, 0)} and i.occurred_at <= ${T.atLocal(to, 23, 59)}`;
}
async function productLines(sql) {
  const rows = await sql`select sku, product_line from products`;
  return Object.fromEntries(rows.map((r) => [r.sku, r.product_line]));
}

async function focusActuals(sql, rep, x, goal, from, to) {
  const people = x.people, ids = people.map((p) => p.id), c = x.cfg.compass;
  const fromAt = T.atLocal(from, 0, 0);
  const before = (at) => at && new Date(at) < fromAt;
  const acts = await activity(sql, ids, T.addDays(from, -c.fifty_quiet_days), to);
  const inWeek = acts.filter((i) => inRange(i.occurred_at, from, to));
  const touched = (pred) => new Set(inWeek.filter(pred).map((i) => i.contact_id));
  const orders = (p) => p.orders.filter(B.isOrder);
  const samples = (p) => p.orders.filter(B.isSample);
  if (goal === 'close') {
    const sampled = people.filter((p) => samples(p).some((o) => T.ymd(B.placedAt(o)) <= to) && !orders(p).some((o) => before(B.placedAt(o))));
    const hit = touched((i) => (isVisit(i) || (isCall(i) && i.reached)));
    return { action: sampled.filter((p) => hit.has(p.id)).length, result: people.filter((p) => inRange(p.firstOrderAt, from, to)).length };
  }
  if (goal === 'warm') {
    const visited = touched(isVisit);
    const quiet = people.filter((p) => {
      if (!visited.has(p.id)) return false;
      const last = orders(p).map(B.placedAt).filter(before).sort().pop();
      if (!last || T.daysBetween(last, fromAt) > 31 * (x.cfg.fifty_months || 3)) return false;   // was in My Fifty
      const lastVisit = acts.filter((i) => i.contact_id === p.id && isVisit(i) && before(i.occurred_at)).map((i) => i.occurred_at).sort().pop();
      const lastActive = [last, lastVisit].filter(Boolean).map((d) => new Date(d)).sort((a, b) => a - b).pop();
      return T.daysBetween(lastActive, fromAt) >= c.fifty_quiet_days;
    });
    const reorders = people.filter((p) => orders(p).some((o) => inRange(B.placedAt(o), from, to)) && orders(p).some((o) => before(B.placedAt(o))));
    return { action: quiet.length, result: reorders.length };
  }
  if (goal === 'grow') {
    const visited = touched(isVisit);
    const current = people.filter((p) => orders(p).some((o) => before(B.placedAt(o))));
    const lines = await productLines(sql);
    const lineSet = (os) => new Set(os.flatMap((o) => (o.summary || []).filter((l) => !l.free && Number(l.price) > 0).map((l) => lines[l.sku])).filter((l) => l && l !== 'misc'));
    const newLine = current.filter((p) => {
      const old = lineSet(orders(p).filter((o) => before(B.placedAt(o))));
      const now = lineSet(orders(p).filter((o) => inRange(B.placedAt(o), from, to)));
      return [...now].some((l) => !old.has(l));
    });
    return { action: current.filter((p) => visited.has(p.id)).length, result: newLine.length };
  }
  if (goal === 'fill') {
    const sentRows = ids.length ? await sql`select ob.primary_contact_id as cid from agreements a join onboardings ob on ob.agreement_id = a.id
      where a.kind = 'onboarding' and ob.primary_contact_id = any(${ids}) and a.sent_at >= ${fromAt} and a.sent_at <= ${T.atLocal(to, 23, 59)}` : [];
    const sent = new Set(sentRows.map((r) => r.cid));
    const firstSample = (p) => samples(p).map(B.placedAt).sort()[0];
    const leads = people.filter((p) => !orders(p).some((o) => before(B.placedAt(o))) && !samples(p).some((o) => before(B.placedAt(o))));
    const given = leads.filter((p) => sent.has(p.id) || inRange(firstSample(p), from, to));
    return { action: given.length, result: leads.filter((p) => inRange(firstSample(p), from, to) && !orders(p).length).length };
  }
  if (goal === 'events') {
    const [r] = await sql`select count(*) filter (where ea.invited_by_id = ${rep.id} and ea.created_at >= ${fromAt} and ea.created_at <= ${T.atLocal(to, 23, 59)})::int as invited,
        count(*) filter (where ea.status in ('rsvp', 'attended') and ea.updated_at >= ${fromAt} and ea.updated_at <= ${T.atLocal(to, 23, 59)}
                           and (ea.invited_by_id = ${rep.id} or ea.contact_id = any(${ids})))::int as registered
      from attendees ea where ea.event_id is not null`;   // event rows only (attendees also holds expense rows since v2-013)
    return { action: r.invited, result: r.registered };
  }
  return { action: 0, result: 0 };
}

// Was this person in My Fifty at a moment (an order placed in the fifty_months before it)?
function inFiftyAt(p, at, months) {
  const end = new Date(at), start = new Date(at);
  start.setMonth(start.getMonth() - (Number(months) || 3));
  return p.orders.some((o) => B.isOrder(o) && new Date(B.placedAt(o)) <= end && new Date(B.placedAt(o)) > start);
}

module.exports = {
  GOALS, SKILLS, SKILL_CHARACTER, CHARACTERS, PICKS, FIFTY_STATUSES, REASONS, SLIP_KINDS, DEFAULTS, SYRINGE_PRICE, CANNULA_PRICE,
  settings, weekOf, addMonths, monthStart, monthEnd, monthName, plannedMonth, dateLabel, inRange, short, kMoney, money, initials, firstName, plural,
  fcValue, fcState, creditedTo, load, groupOf, fact, suggest, derivePicks, secondLook, noteSkill, focusActuals, inFiftyAt, activity, isVisit, isCall,
};

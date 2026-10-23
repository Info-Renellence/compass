// Compass test helpers, following renellence-edge/test/run/h.js: tests talk to the TEST database only (Supabase v1,
// test/run/env.js), each inside a transaction that is always rolled back, so no row is ever kept. Fixtures are
// fictional and marked: emails demo-test-compass-...@demo.invalid, legacy_id demo-test-compass-...
//   const h = require('./h'); h.test('name', async (sql) => { ... await h.get(admin, 'weekly', { rep: rep.id }) ... }); h.run();
'use strict';
require('./env');
const path = require('path');
const { Readable } = require('stream');
const ROOT = path.join(__dirname, '..', '..');
const dbm = require(path.join(ROOT, 'api/_compass/db'));
const T = require(path.join(ROOT, 'api/_compass/time'));

const MARK = 'demo-test-compass-';
const ROLLBACK = new Error('rollback');
function inTx(tx) {
  return new Proxy(tx, { get(t, p) {
    if (p === 'begin') return (fn) => t.savepoint(fn);
    if (p === 'end') return async () => {};
    return t[p];
  } });
}
let pool = null;
async function withDb(fn) {
  pool = pool || dbm.db();
  let result;
  try {
    await pool.begin(async (tx) => {
      const sql = inTx(tx);
      dbm.setDb(sql);
      try { result = await fn(sql); } finally { dbm.setDb(pool); }
      throw ROLLBACK;
    });
  } catch (e) { if (e !== ROLLBACK) throw e; }
  return result;
}
async function closeDb() { if (pool) { await pool.end({ timeout: 5 }); pool = null; } }

// The API as the browser calls it, signed in as `who` (COMPASS_DEV_EMAIL, local only), or with headers.
let handler = null;
async function call(who, method, op, params, headers) {
  handler = handler || require(path.join(ROOT, 'api/compass.js'));
  if (who) process.env.COMPASS_DEV_EMAIL = who.email || who; else delete process.env.COMPASS_DEV_EMAIL;
  let url = '/api/compass';
  let req;
  if (method === 'GET') {
    url += '?' + new URLSearchParams(Object.assign({ op }, params || {})).toString();
    req = Readable.from([]);
  } else {
    req = Readable.from([Buffer.from(JSON.stringify(Object.assign({ op }, params || {})))]);
  }
  req.method = method; req.url = url; req.headers = headers || {};
  const res = { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b || ''; } };
  try { await handler(req, res); } finally { delete process.env.COMPASS_DEV_EMAIL; }
  let data = null;
  try { data = JSON.parse(res.body); } catch (e) { data = res.body; }
  return { status: res.statusCode, data };
}
const get = (who, op, params) => call(who, 'GET', op, params);
const post = (who, op, body) => call(who, 'POST', op, body);

// ---- fixtures ----------------------------------------------------------------------------------------------
let n = 0;
const uid = () => (++n) + '-' + Math.random().toString(36).slice(2, 8);
const ago = (days, hours) => new Date(Date.now() - (days || 0) * 86400000 - (hours || 0) * 3600000);

async function user(sql, o = {}) {
  const [u] = await sql`insert into users (email, full_name, kind, is_active)
    values (${o.email || MARK + uid() + '@demo.invalid'}, ${o.name || 'Tessa Testrep'}, ${o.kind || 'rep'}, ${o.active === false ? false : true})
    returning id, email, full_name, kind`;
  return u;
}
async function clinic(sql, o = {}) {
  const [c] = await sql`insert into clinics (name, city, province, street, postal_code, legacy_id)
    values (${o.name || 'Testcase Clinic ' + uid()}, 'Toronto', 'ON', '1 Test St', 'M5V 1A1', ${MARK + uid()}) returning id, name`;
  return c;
}
async function contact(sql, owner, o = {}) {
  const [c] = await sql`insert into contacts (clinic_id, owner_id, first_name, last_name, email, designation, lead_source, lead_source_event_id, created_at, legacy_id,
                                              shipping_street, shipping_city, shipping_province, shipping_postal_code)
    values (${o.clinicId || null}, ${owner ? owner.id : null}, ${o.first || 'Kilo'}, ${o.last || 'Sample' + n}, ${MARK + 'c-' + uid() + '@demo.invalid'},
            ${o.designation || null}, ${o.source || 'warm'}, ${o.eventId || null}, ${o.createdAt || ago(200)}, ${MARK + uid()}, '1 Test St', 'Toronto', 'ON', 'M5V 1A1')
    returning id, first_name, last_name`;
  return c;
}
// An order with lines [{sku, qty, price, free}].
async function order(sql, contactId, o = {}) {
  const placed = o.at || new Date();
  const [x] = await sql`insert into orders (contact_id, rep_id, channel, status, submitted_at, payment_method, shipped_at, delivered_at, legacy_id, created_at)
    values (${contactId}, ${o.repId || null}, 'stripe', ${o.status || 'paid'}, ${placed}, 'card_on_file', ${o.shippedAt || null}, ${o.deliveredAt || null}, ${MARK + uid()}, ${placed})
    returning id`;
  for (const l of o.lines || [{ sku: 'SAL400', qty: 6 }]) {
    const [p] = await sql`select id, sku, name, list_price from products where sku = ${l.sku}`;
    const free = !!l.free;
    const price = free ? 0 : (l.price != null ? l.price : Number(p.list_price));
    await sql`insert into order_lines (order_id, product_id, product_sku, product_name, quantity, unit_price, list_price, is_free) values (${x.id}, ${p.id}, ${p.sku}, ${p.name}, ${l.qty || 1}, ${price}, ${p.list_price}, ${free})`;
  }
  return x.id;
}
const samples = (sql, contactId, o = {}) => order(sql, contactId, Object.assign({ status: 'delivered', lines: [{ sku: 'SAL400', qty: 2, free: true }] }, o));
async function touch(sql, contactId, userId, o = {}) {
  const [i] = await sql`insert into interactions (kind, contact_id, user_id, occurred_at, mode, status, outcome, source, direction)
    values (${o.kind || 'call'}, ${contactId}, ${userId}, ${o.at || new Date()}, ${o.mode || null}, ${o.status || 'completed'}, ${o.outcome || null}, 'edge', ${o.direction || null}) returning id`;
  return i.id;
}
async function onboarded(sql, contactId, o = {}) {
  const [a] = await sql`insert into agreements (kind, contact_id, status, sent_at, completed_at) values ('onboarding', ${contactId}, 'completed', ${o.sentAt || ago(10)}, ${o.at || ago(5)}) returning id`;
  await sql`insert into onboardings (injector_contact_id, primary_contact_id, submitted_at, agreement_id, status, completed_at)
    values (${contactId}, ${contactId}, ${o.sentAt || ago(10)}, ${a.id}, 'signed', ${o.at || ago(5)})`;
  return a.id;
}
async function forecast(sql, contactId, repId, o = {}) {
  const [f] = await sql`insert into forecasts (contact_id, rep_id, due_date, syringes, syringe_price, cannula_boxes, cannula_box_price, created_at)
    values (${contactId}, ${repId}, ${o.due}, ${o.syringes || 10}, 225, 0, 185, ${o.createdAt || ago(30)}) returning id`;
  return f.id;
}
// The Toronto weeks the tests use.
function weeks() {
  const today = T.ymd();
  const mon = T.addDays(today, -((T.weekday(today) + 6) % 7));
  return { today, mon, sun: T.addDays(mon, 6), lastMon: T.addDays(mon, -7), lastSun: T.addDays(mon, -1) };
}
// The change_logs rows written for one row, with their source.
const logsFor = (sql, entity, id) => sql`select action, source::text as source, field_name from change_logs where entity_type = ${entity} and entity_id = ${id}`;

// A tiny test runner: each test in its own rolled-back transaction.
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
async function run() {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { await withDb(fn); pass++; console.log('ok   ', name); } catch (e) { fail++; console.log('FAIL ', name, '\n     ', (e && (e.stack || e.message) || String(e)).split('\n').slice(0, 5).join('\n      ')); }
  }
  await closeDb();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}
function eq(a, b, what) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((what || 'eq') + ': got ' + A + ', want ' + B); }
function ok(c, what) { if (!c) throw new Error('not ok: ' + what); }

module.exports = { MARK, withDb, closeDb, call, get, post, user, clinic, contact, order, samples, touch, onboarded, forecast, weeks, logsFor, ago, uid, test, run, eq, ok, inTx, ROOT };

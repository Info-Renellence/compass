// Run 3 (2026-10-23): two commitment changes sent at once (two quick taps on the done screen's chips) added the same
// commitment twice (seen on v1: 4 rounds of 5). weekly_commitments must take the rep's lock (the same row lock as
// weekly_save) before it reads the session's commitments, so the two changes take turns. No database: the SQL is a fake
// that records each statement in order.
//   node --test test/commitments-lock.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const dbm = require(path.join(ROOT, 'api/_compass/db'));
const writes = require(path.join(ROOT, 'api/_compass/writes')).OPS;

const REP = '11111111-1111-4111-8111-111111111111', ME = '22222222-2222-4222-8222-222222222222', SESS = '33333333-3333-4333-8333-333333333333';
function fakeSql(log) {
  const run = (strings) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    log.push(text);
    if (/from users where id = \? and is_active and kind = 'rep'/.test(text)) return Promise.resolve([{ id: REP, email: 'tessa@demo.invalid', full_name: 'Tessa Testrep', kind: 'rep' }]);
    if (/from one_on_ones where rep_id/.test(text)) return Promise.resolve([{ id: SESS }]);
    return Promise.resolve([]);
  };
  const sql = (strings, ...values) => run(strings, values);
  sql.begin = async (fn) => { log.push('BEGIN'); const r = await fn(sql); log.push('COMMIT'); return r; };
  return sql;
}

test('weekly_commitments locks the rep before reading the commitments', async () => {
  const log = [];
  dbm.setDb(fakeSql(log));
  try {
    const r = await writes.weekly_commitments({ id: ME }, { repId: REP, commitments: ['Join Tessa at a visit'] });
    assert.equal(r.ok, true);
  } finally { dbm.setDb(null); }
  const inTx = log.slice(log.indexOf('BEGIN'));
  const lock = inTx.findIndex((t) => /for update/.test(t) && /users|one_on_ones/.test(t));
  const read = inTx.findIndex((t) => /^select id, title from tasks/.test(t));
  assert.ok(read > 0, 'reads the commitments in the transaction: ' + JSON.stringify(inTx));
  assert.ok(lock > 0 && lock < read, 'takes a lock before reading them: ' + JSON.stringify(inTx));
});

// Pure pieces of the Suggestions review (api/_compass/suggestions.js): no database. The other ai_outputs kinds are
// not in the test database yet, so their field mapping and jsonb status update are checked here.
//   npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../api/_compass/suggestions.js');

test('safe fields map to contact columns, in Claude\'s plain words', () => {
  assert.equal(S.columnOf('first name'), 'first_name');
  assert.equal(S.columnOf('Last Name'), 'last_name');
  assert.equal(S.columnOf('role'), 'role');
  assert.equal(S.columnOf('designation'), 'designation');
  for (const f of ['owner', 'status', 'duplicate', 'clinic', 'address', '', null]) assert.equal(S.columnOf(f), null, String(f));
});

test('safeChange: names are trimmed, enums are checked, by-hand fields give null', () => {
  assert.deepEqual(S.safeChange('first name', '  Noor  '), { column: 'first_name', value: 'Noor' });
  assert.deepEqual(S.safeChange('role', 'Injector'), { column: 'role', value: 'injector' });
  assert.deepEqual(S.safeChange('designation', 'M.D.'), { column: 'designation', value: 'md' });
  assert.equal(S.safeChange('owner', 'Someone'), null);
  assert.throws(() => S.safeChange('role', 'wizard'), (e) => e.status === 400);
  assert.throws(() => S.safeChange('designation', 'phd'), (e) => e.status === 400);
  assert.throws(() => S.safeChange('first name', '   '), (e) => e.status === 400);
});

test('autoOf: enrichment uses value, data checks are never automatic, a bad value is by hand', () => {
  assert.equal(S.autoOf('enrichment', { field: 'designation', value: 'rn' }), true);
  assert.equal(S.autoOf('enrichment', { field: 'website', value: 'https://x.ca' }), false);
  assert.equal(S.autoOf('lead_cleanup', { field: 'role', proposed: 'wizard' }), false);
  assert.equal(S.autoOf('data_health', { field: 'role', proposed: 'other' }), false);
});

test('decisionSteps: one status, who and when under the right list and index', () => {
  const steps = S.decisionSteps('enrichment', 2, 'accept', 'u1', '2026-10-28T10:00:00.000Z');
  assert.deepEqual(steps.map((s) => s.path.join('.')), ['fields.2.status', 'fields.2.decided_by', 'fields.2.decided_at']);
  assert.deepEqual(steps.map((s) => s.value), ['accepted', 'u1', '2026-10-28T10:00:00.000Z']);
  const r = S.decisionSteps('data_health', 0, 'reject', 'u1', 't');
  assert.equal(r[0].value, 'rejected');
  assert.equal(r[0].path[0], 'items');
});

test('isOpen: no status or proposed is open', () => {
  assert.equal(S.isOpen({}), true);
  assert.equal(S.isOpen({ status: 'proposed' }), true);
  assert.equal(S.isOpen({ status: 'accepted' }), false);
});

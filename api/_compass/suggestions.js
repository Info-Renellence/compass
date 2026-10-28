// Review of what Claude's timed jobs proposed (owner 2026-10-28). Rows live in ai_outputs; nothing is applied to a real
// record until a person accepts it here. These are the pure pieces (no database), so they can be unit tested:
// which fields are safe to apply for you, the value checks, and the jsonb path that records a decision.
const { fail } = require('./http');

// Claude writes the field in plain words ("first name", "Last Name", "role"). Only these four are applied for you.
const COLUMN = { firstname: 'first_name', lastname: 'last_name', role: 'role', designation: 'designation' };
const ROLES = ['physician', 'injector', 'dentist', 'manager', 'other'];
const DESIGNATIONS = ['md', 'rn', 'rpn', 'np', 'dds', 'other'];

const key = (f) => String(f == null ? '' : f).toLowerCase().replace(/[^a-z]/g, '');
const columnOf = (field) => COLUMN[key(field)] || null;

// -> { column, value } for a safe field with an allowed value, null when the change is done by hand, and a 400
// (bad_value) when the field is safe but the value is outside the enum or empty.
function safeChange(field, proposed) {
  const column = columnOf(field);
  if (!column) return null;
  const raw = String(proposed == null ? '' : proposed).replace(/\s+/g, ' ').trim();
  if (column === 'first_name' || column === 'last_name') {
    if (!raw || raw.length > 100) throw fail(400, 'bad_value');
    return { column, value: raw };
  }
  const v = raw.toLowerCase().replace(/[^a-z]/g, '');   // "M.D." -> md
  if (!(column === 'role' ? ROLES : DESIGNATIONS).includes(v)) throw fail(400, 'bad_value');
  return { column, value: v };
}

// The list inside output_json that holds the reviewable items, per kind.
const LIST = { lead_cleanup: 'suggestions', enrichment: 'fields', data_health: 'items' };
const REVIEW_KINDS = Object.keys(LIST);

// Open = nobody decided it yet.
const isOpen = (item) => !item || !item.status || item.status === 'proposed';
// An item the screen can apply for you: lead_cleanup and enrichment only, a safe field, an allowed value.
function autoOf(kind, item) {
  if (kind === 'data_health' || !item) return false;
  try { return !!safeChange(item.field, kind === 'enrichment' ? item.value : item.proposed); } catch (e) { return false; }
}

// The jsonb_set steps (path + plain text value; the SQL wraps it with to_jsonb) that record a decision for item `index`, in one update.
function decisionSteps(kind, index, decision, userId, at) {
  const base = [LIST[kind], String(index)];
  return [
    { path: base.concat('status'), value: decision === 'accept' ? 'accepted' : 'rejected' },
    { path: base.concat('decided_by'), value: userId },
    { path: base.concat('decided_at'), value: at },
  ];
}

module.exports = { safeChange, columnOf, autoOf, isOpen, decisionSteps, LIST, REVIEW_KINDS, ROLES, DESIGNATIONS };

// Postgres for Compass: Supabase v2 (ojphplepzuwchjtuycpv), the database Edge and Pulse (My Fifty) use.
// Follows renellence-edge/api/_edge/db.js (no-hubspot 6c2e5f6).
//
// COMPASS_V2_DATABASE_URL and nothing else: Compass never falls back to DATABASE_URL, POSTGRES_URL or Edge's variable.
// The server's connection bypasses row-level security, so every read and write checks the rules in code: only admins
// get in (auth.js), and every account a write touches must be the chosen rep's own (contacts.owner_id).
//
// Writes go through asUser(): one transaction that tells the change_logs trigger who acted and that it was Compass
// (app.source = 'compass', the change_logs_source value added by renellence-edge/db/v2-010-compass.sql).
const postgres = require('postgres');

const SOURCE = 'compass';
let sql = null;
function db() {
  if (sql) return sql;
  const url = process.env.COMPASS_V2_DATABASE_URL;
  if (!url) { const e = new Error('database_not_configured'); e.status = 503; throw e; }
  // Supabase's pooler (port 6543, transaction mode) does not keep prepared statements.
  // A calendar date (type date, OID 1082) is read as noon UTC of that day, so in Toronto it is still that day (as Edge).
  sql = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
    types: { date: { to: 1082, from: [1082], serialize: (x) => (x instanceof Date ? x.toISOString().slice(0, 10) : x), parse: (x) => new Date(x + 'T12:00:00Z') } } });
  return sql;
}

async function asUser(userId, fn) {
  return db().begin(async (tx) => {
    await tx`select set_config('app.user_id', ${userId || ''}, true), set_config('app.source', ${SOURCE}, true)`;
    return fn(tx);
  });
}

function setDb(x) { sql = x; }

module.exports = { db, asUser, setDb, SOURCE };

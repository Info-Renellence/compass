// Compass's own sign-in session, copied from renellence-edge/api/_session.js (no-hubspot 6c2e5f6) with its own prefix
// and key, so an Edge session is never a Compass session.
//
// The Google sign-in is checked once (auth.js) and Compass answers with its own token, signed with HMAC-SHA256 and
// valid for 30 days. The token carries only who you are (email, name, picture) and when it expires; whether you may get
// in (an active admin in users) is checked live on every request, so someone switched off is out at once.
//
// The signing key is COMPASS_SESSION_SECRET if set, otherwise derived from the Upstash (KV) token that is already a
// server-only secret, as Edge does. With neither, sign-in still works but hands back the Google token itself (one hour).
// Rotating the key signs everyone out.
const crypto = require('crypto');

const PREFIX = 'compass1.';
const DAY = 86400000;
const TTL_DAYS = 30;

function key() {
  if (process.env.COMPASS_SESSION_SECRET) return crypto.createHash('sha256').update('compass-session-v1:' + process.env.COMPASS_SESSION_SECRET).digest('hex');
  const base = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return base ? crypto.createHash('sha256').update('compass-session-v1:' + base).digest('hex') : '';
}

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const sign = (k, body) => b64(crypto.createHmac('sha256', k).update(PREFIX + body).digest());

// -> { token, exp } or null when no signing key is available.
function mint(who, now) {
  const k = key();
  if (!k || !who || !who.email) return null;
  const exp = (now || Date.now()) + TTL_DAYS * DAY;
  const body = b64(JSON.stringify({ e: who.email, n: who.name || '', p: who.picture || '', x: exp }));
  return { token: PREFIX + body + '.' + sign(k, body), exp };
}

function isSession(token) { return typeof token === 'string' && token.indexOf(PREFIX) === 0; }

// -> { email, name, picture, exp } for a genuine, unexpired session; otherwise null.
function verify(token, now) {
  if (!isSession(token)) return null;
  const k = key();
  if (!k) return null;
  const parts = token.slice(PREFIX.length).split('.');
  if (parts.length !== 2) return null;
  const want = Buffer.from(sign(k, parts[0]));
  const got = Buffer.from(parts[1]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let p;
  try { p = JSON.parse(unb64(parts[0]).toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p.e !== 'string' || !(p.x > (now || Date.now()))) return null;
  return { email: p.e.toLowerCase(), name: p.n || '', picture: p.p || '', exp: p.x };
}

module.exports = { mint, verify, isSession, TTL_DAYS, PREFIX };

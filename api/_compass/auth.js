// Who is signed in to Compass. Follows renellence-edge/api/_edge/auth.js (no-hubspot 6c2e5f6), plus the owner's
// "admins only" rule (2026-10-23): Google sign-in with a verified @renellence.com address, AND an active row in v2's
// users table with kind = 'admin'. A rep, head office, an outsider or someone switched off is refused.
//
// The page signs in with Google (Edge's OAuth client, GOOGLE_CLIENT_ID) and trades the Google ID token for a Compass
// session (session.js). Every request then carries "Authorization: Bearer <session or Google token>".
//
// Local development and tests only (never on Vercel): COMPASS_DEV_EMAIL signs everyone in as that person (the admin
// rule still applies), like Edge's EDGE_DEV_EMAIL.
const { OAuth2Client } = require('google-auth-library');
const session = require('./session');
const { db } = require('./db');

const DOMAIN = /@renellence\.com$/i;
const fail = (status, message) => { const e = new Error(message); e.status = status; return e; };
const google = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// A Google ID token -> { email, name, picture }, or null.
async function fromGoogle(idToken) {
  if (!idToken || !process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const t = await google().verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const p = t.getPayload() || {};
    if (!p.email_verified || !DOMAIN.test(p.email || '')) return null;
    return { email: String(p.email).toLowerCase(), name: p.name || '', picture: p.picture || '' };
  } catch (e) {
    return null;
  }
}

const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// The users row for an address: active and an admin, or refused.
async function adminFor(email) {
  const [row] = await db()`select id, email, full_name, kind, is_active from users where lower(email) = ${email}`;
  if (!row || row.is_active === false) throw fail(403, 'not_set_up');
  if (row.kind !== 'admin') throw fail(403, 'admins_only');
  const name = row.full_name || email.split('@')[0];
  return { id: row.id, email: row.email, name, first: name.split(/\s+/)[0], initials: initials(name), kind: row.kind };
}

async function signedIn(req) {
  if (!process.env.VERCEL && process.env.COMPASS_DEV_EMAIL) return adminFor(process.env.COMPASS_DEV_EMAIL.toLowerCase());
  const token = String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw fail(401, 'signed_out');
  let who = null;
  if (session.isSession(token)) who = session.verify(token);
  else who = await fromGoogle(token);
  if (!who || !DOMAIN.test(who.email)) throw fail(401, 'signed_out');
  return adminFor(who.email);
}

// POST signin: Google credential -> Compass session (or the Google token itself if no session key is set up).
async function signIn(credential) {
  const who = await fromGoogle(credential);
  if (!who) throw fail(401, 'google_failed');
  const me = await adminFor(who.email);
  const s = session.mint(who);
  return { token: s ? s.token : credential, me: { name: me.name, first: me.first, initials: me.initials, email: me.email, kind: me.kind } };
}

module.exports = { signedIn, signIn, initials, adminFor };

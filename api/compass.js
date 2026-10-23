// Compass's one API (the weekly and monthly 1-on-1), following renellence-edge/api/edge.js:
//   GET  /api/compass?op=config                 public: the Google client id for the sign-in button
//   POST /api/compass {op:'signin', credential}  Google credential -> Compass session
//   GET  /api/compass?op=<read>                 api/_compass/reads.js   (session, weekly, monthly)
//   POST /api/compass {op:<write>, ...}          api/_compass/writes.js  (weekly_save, weekly_commitments, monthly_save)
// Every op but config and signin needs an active admin (api/_compass/auth.js). Database: COMPASS_V2_DATABASE_URL only.
const { db } = require('./_compass/db');
const { signedIn, signIn } = require('./_compass/auth');
const { send, body, query, route, fail, own } = require('./_compass/http');
const reads = require('./_compass/reads');
const writes = require('./_compass/writes');

module.exports = route(async (req, res) => {
  if (req.method === 'GET') {
    const q = query(req);
    const op = q.get('op') || '';
    if (op === 'config') return send(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
    const me = await signedIn(req);
    const fn = own(reads.OPS, op);
    if (!fn) throw fail(400, 'unknown_op');
    return send(res, 200, await fn(db(), me, q));
  }
  if (req.method === 'POST') {
    const b = await body(req);
    if (b.op === 'signin') return send(res, 200, await signIn(typeof b.credential === 'string' ? b.credential : ''));
    const me = await signedIn(req);
    const fn = own(writes.OPS, b.op);
    if (!fn) throw fail(400, 'unknown_op');
    return send(res, 200, await fn(me, b));
  }
  throw fail(405, 'method_not_allowed');
});


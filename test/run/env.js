// Copied from renellence-edge/test/run/env.js (no-hubspot 6c2e5f6, 2026-10-23) for Compass.
// Tests talk to the TEST database only: Supabase v1 (tkgcinmmqbtdiqbhsgtk), never v2 (Yousef 2026-10-22: v2 now holds
// the real data; v1 became the test database with v2's exact structure plus the demo and test-run rows).
// The address is TEST_DATABASE_URL in ../my-fifty/.env.test (git-ignored there, shared by both apps' tests), or the
// TEST_DATABASE_URL environment variable. It becomes COMPASS_V2_DATABASE_URL for the API code under test. A missing
// address or a v2 address stops the tests. Never prints the address.
'use strict';
const fs = require('fs');
const path = require('path');
const V2_REF = 'ojphplepzuwchjtuycpv';
let url = process.env.TEST_DATABASE_URL;
const f = path.join(__dirname, '..', '..', '..', 'my-fifty', '.env.test');
if (!url && fs.existsSync(f)) {
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === 'TEST_DATABASE_URL') url = m[2].replace(/^"|"$/g, '');
  }
}
if (!url) throw new Error('TEST_DATABASE_URL is not set: put the test database (Supabase v1) address in ../my-fifty/.env.test');
if (url.includes(V2_REF)) throw new Error('TEST_DATABASE_URL points at Supabase v2 (the real data); tests must use v1');
process.env.TEST_DATABASE_URL = url;
process.env.COMPASS_V2_DATABASE_URL = url;
delete process.env.EDGE_V2_DATABASE_URL;
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.VERCEL;
module.exports = { url };

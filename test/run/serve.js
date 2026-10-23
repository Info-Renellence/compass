// The built Compass (dist/, built with VITE_DATA_SOURCE=api) and its API on one local port, signed in as a test admin
// (COMPASS_DEV_EMAIL, honoured off Vercel only), against the test database (Supabase v1, test/run/env.js).
//   node --require ./test/run/no-network.js test/run/serve.js <port> <email>
'use strict';
require('./env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.argv[2] || 5385);
process.env.COMPASS_DEV_EMAIL = process.argv[3] || 'demo-test-compass-admin@demo.invalid';
const handler = require('../../api/compass.js');
const DIST = path.join(__dirname, '..', '..', 'dist');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/compass')) return handler(req, res);
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('compass test server on http://localhost:' + PORT + ' as ' + process.env.COMPASS_DEV_EMAIL));

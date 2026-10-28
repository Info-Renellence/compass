// Run 4 lane A: Compass shows the same initials as Edge and Pulse (the first letter of each of the first two words).
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'api/_compass/rules'));
const A = require(path.join(__dirname, '..', '..', 'api/_compass/auth'));
let fail = 0;
const eq = (a, b, w) => { if (a !== b) { fail++; console.log('FAIL ' + w + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); } };
for (const [name, want] of [["Jo (Ann's Nurse)", 'JA'], ['Dr. Noor Sample', 'NS'], ['Kai', 'K'], ['', ''], ['  ', ''], ['"Al" Smith', 'AS'], ['Zoë Éclair', 'ZÉ'], ['1st Clinic', 'SC'], ['- -', '']]) {
  eq(R.initials(name), want, 'rules ' + name);
  if (!/^Dr/.test(name)) eq(A.initials(name), want, 'auth ' + name);
}
console.log(fail ? fail + ' failed' : 'all passed');
process.exitCode = fail ? 1 : 0;
// Same answers as Edge's own function when the sibling repo is here.
try {
  const E = require(path.join(__dirname, '..', '..', '..', 'renellence-edge', 'api/_edge/view')).initials;
  for (const n of ["Jo (Ann's Nurse)", 'Zoë Éclair', '1st Clinic', '- -', 'Kai', '"Al" Smith']) if (E(n) !== R.initials(n)) { console.log('FAIL differs from Edge: ' + n); process.exitCode = 1; }
} catch (e) { /* sibling repo not present */ }

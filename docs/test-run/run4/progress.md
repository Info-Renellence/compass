# Run 4 lane A, Compass part (2026-10-27, 18:55 to 23:55 laptop clock)
Database: Supabase v1 only (copy of today's v2); v2 never reached. Offline proof 35/35 (renellence-edge test/run/prove-offline.js).
Baseline: test:db 8/8, fingerprint 2/2, build ok, test:ui 1/1.

- Attack tests `test/run/run4-attacks.test.js` (5/5): rep subject rules, op names, 24 plan shapes, two admins, monthly scope.
- Cross-app tests live in renellence-edge/test/run/run4-crossapp.test.js (money, focus, wins, forecast totals, Quo attach, copy to Pulse).
- Real books: Compass monthly forecast totals equal Edge's Forecast page for all 5 real reps; Fifty count equals Edge and Pulse; stage groups match Edge's tabs (differences only from parked accounts and frozen check-in groups).
- Browser on real books (1440 and 1024): found the top bar overflowing sideways at 1024 px -> fixed 5cf7861; rep list not scrollable -> fixed 38ac887.
- Browser save flow on committed fake rows (demo-test-r4a-*): Save the week and Save November both 200; Pulse Today and Edge Home then show the typed focus and "2 visits"; a double-click on Save sends 2 saves and leaves 1 session and 1 focus.
- Initials bug ("J(" for "Jo (Ann's Nurse)") fixed on local branch run4-fixes a0ef946 (api change, not pushed).

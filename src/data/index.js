// The data layer. Screens only call these functions, never fetch() or a fixture directly, so the sample source can be
// swapped for the real API (phase 3, once the owner approves docs/compass-data-proposal.md) without touching a screen.
//
//   VITE_DATA_SOURCE=sample (default)  fictional data in ./sample.js; nothing is saved
//   VITE_DATA_SOURCE=api               the Compass API (/api/compass, not built yet), over Supabase v2
//
// The contract (every function returns a promise):
//   session()                 -> { me: { first, kind }, reps: [{ id, first, last, ini }] }
//   weekly(repId)             -> the weekly 1-on-1 for the rep's current week (see sample.js for the shape)
//   monthly(repId)            -> the monthly 1-on-1 for the month that starts this week
//   saveWeekly(repId, plan)   -> { ok }   plan: { picks: [{ id, finalPick }], secondLook: [{ id, decision }],
//                                          focus: { goal, actionTarget }, roleplay: { skill, character, done },
//                                          commitments: [text] }
//   saveMonthly(repId, plan)  -> { ok }   plan: { addedForecasts: [id], fiftyStatus: [{ id, status }], skill }
import { sample } from './sample.js';

const api = {
  name: 'api',
  async call(op, body) {
    const r = await fetch('/api/compass' + (body ? '' : '?op=' + op), body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ op }, body)) }
      : { method: 'GET' });
    if (!r.ok) throw new Error('compass_api_' + r.status);
    return r.json();
  },
  session() { return this.call('session'); },
  weekly(repId) { return this.call('weekly&rep=' + encodeURIComponent(repId)); },
  monthly(repId) { return this.call('monthly&rep=' + encodeURIComponent(repId)); },
  saveWeekly(repId, plan) { return this.call('weekly_save', { repId, plan }); },
  saveMonthly(repId, plan) { return this.call('monthly_save', { repId, plan }); },
};

const source = (import.meta.env.VITE_DATA_SOURCE || 'sample') === 'api' ? api : sample;
export const data = source;
export const isSample = source === sample;

// The data layer. Screens only call these functions, never fetch() or a fixture directly, so the sample source and the
// real API are swapped without touching a screen.
//
//   VITE_DATA_SOURCE=sample (default)  fictional data in ./sample.js; nothing is saved
//   VITE_DATA_SOURCE=api               the Compass API (/api/compass, api/compass.js), over Supabase v2
//
// The contract (every function returns a promise):
//   session()                 -> { me: { first, kind }, reps: [{ id, first, last, ini }] }
//   weekly(repId)             -> the weekly 1-on-1 for the rep's current week (see sample.js for the shape)
//   monthly(repId)            -> the monthly 1-on-1 for the month that starts this week
//   saveWeekly(repId, plan)   -> { ok }   plan: { picks: [{ id, finalPick }], secondLook: [{ id, decision }],
//                                          focus: { text, notes }, roleplay: { skill, character, done },
//                                          commitments: [text] }
//   saveCommitments(repId, commitments) -> { ok }   the manager's commitments, changed on the done screen
//   saveMonthly(repId, plan)  -> { ok }   plan: { addedForecasts: [id], fiftyStatus: [{ id, status }], skill }
//   focusDraft(repId, notes)  -> { line } or { line: null, reason }   the manager's focus notes written up (saves nothing)
//   secondLookList(repId)     -> { rep, weeks, rows }   Cat's list: picks that differed from the suggestion, and what happened
// API only: config() -> { googleClientId }, signIn(credential) -> { token, me }, signOut().
import { sample } from './sample.js';

// The session token lives in localStorage (a convenience: if storage is blocked the person just signs in again), as Edge.
const KEY = 'compass.session';
let memo = '';
const token = {
  get() { try { return localStorage.getItem(KEY) || memo; } catch (e) { return memo; } },
  set(t) { memo = t; try { localStorage.setItem(KEY, t); } catch (e) { /* this tab only */ } },
  clear() { memo = ''; try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ } },
};

export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

const api = {
  name: 'api',
  async call(op, body) {
    const t = token.get();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {});
    const r = await fetch('/api/compass' + (body ? '' : '?op=' + op), body
      ? { method: 'POST', headers, body: JSON.stringify(Object.assign({ op }, body)) }
      : { method: 'GET', headers });
    let data = {};
    try { data = await r.json(); } catch (e) { /* empty body */ }
    if (!r.ok) {
      if (r.status === 401) window.dispatchEvent(new Event('compass:signed-out'));
      throw new ApiError(r.status, data.error || 'server_error');
    }
    return data;
  },
  config() { return this.call('config'); },
  async signIn(credential) { const x = await this.call('signin', { credential }); token.set(x.token); return x; },
  signOut() { token.clear(); },
  session() { return this.call('session'); },
  weekly(repId) { return this.call('weekly&rep=' + encodeURIComponent(repId)); },
  monthly(repId) { return this.call('monthly&rep=' + encodeURIComponent(repId)); },
  saveWeekly(repId, plan) { return this.call('weekly_save', { repId, plan }); },
  saveCommitments(repId, commitments) { return this.call('weekly_commitments', { repId, commitments }); },
  saveMonthly(repId, plan) { return this.call('monthly_save', { repId, plan }); },
  focusDraft(repId, notes) { return this.call('focus_draft', { repId, notes }); },
  secondLookList(repId) { return this.call('second_look_list&rep=' + encodeURIComponent(repId)); },
};

// Plain words for the errors the API can answer with.
const WORDS = {
  not_set_up: 'Your account isn’t set up yet. Ask an admin to add you.',
  admins_only: 'Compass is for admins only.',
  google_failed: 'Google sign-in didn’t go through. Try again.',
  bad_focus: 'Type this week’s focus first.',
  save_first: 'Save the week first.',
  database_not_configured: 'Compass can’t reach the database right now.',
};
export const words = (e) => (e && WORDS[e.code]) || (e && e.status >= 500 ? 'Something went wrong on our side. Try again.' : 'Something went wrong.');

const source = (import.meta.env.VITE_DATA_SOURCE || 'sample') === 'api' ? api : sample;
export const data = source;
export const isSample = source === sample;

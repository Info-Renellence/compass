// Fictional sample data for building the UI before the database is approved (owner 2026-10-23: phase 1 is a proposal
// only). Every name here is made up: the reps and the manager are invented, and the accounts are "<Name> Sample".
// No real customer, rep, staff, territory or plan figure appears here (SOP section 7, "Demo or mock data").
// The shapes match what the real API will return (see src/data/index.js), so switching to it changes no screen code.

const REPS = [
  { id: 'rep-1', first: 'Tessa', last: 'Ward' },
  { id: 'rep-2', first: 'Nadia', last: 'Brook' },
  { id: 'rep-3', first: 'Owen', last: 'Pike' },
];
const MANAGER = { id: 'mgr-1', first: 'Bea', last: 'Lane', kind: 'admin' };

// Every account the rep sorted on Friday: group (frozen at the check-in), the fact line, the suggested pick with its
// one-line reason, the rep's pick, and the visit or call purpose (written by the note taker after the meeting).
// pick letters: v visit · c call · w wait · p park
const A = [
  ['noor', 'Dr. Noor Sample', 'candidate', 'Samples shipped Oct 1 · no order', 'v', 'Samples 20 days ago and no order. Ask for the date.', 'Ask how the samples did, then for the order date', 'p'],
  ['leo', 'Leo Sample', 'candidate', 'Sample order waiting on MD sign-off · 3 days', 'c', 'Samples can’t ship until Dr. Leo signs.', 'Get Dr. Leo to sign the sample order', 'c'],
  ['ken', 'Ken Sample', 'candidate', 'Onboarded · said he orders in November', 'c', 'Ready to order. Lock in the date now.', 'Book the first order date', 'c'],
  ['ivy', 'Ivy Sample', 'candidate', 'Sample order waiting on MD sign-off · 1 day', 'w', 'Sign-off went out yesterday. Give it 2 days.', '', 'w'],
  ['ria', 'Dr. Ria Sample', 'onboarded', 'Onboarding signed Oct 14 · no samples yet', 'v', 'Signed a week ago. Drop samples while it’s fresh.', 'Drop lips samples and book a follow-up', 'v'],
  ['mo', 'Mo Sample', 'onboarded', 'Onboarding signed Oct 2 · no samples yet', 'v', '19 days signed with no samples.', 'Drop volume samples', 'v'],
  ['ola', 'Dr. Ola Sample', 'onboarded', 'Onboarding signed yesterday', 'c', 'Book a sample drop for next week.', 'Book the sample drop', 'c'],
  ['kai', 'Kai Sample', 'fifty', 'Late forecast $13.5K · no order since Aug 30', 'v', 'Biggest late forecast and 52 days without an order.', 'Confirm the big order or a new date', 'v'],
  ['omar', 'Omar Sample', 'fifty', 'No order or visit since Sep 13', 'v', 'Going cold · 38 days. Go in person.', 'Check in and bring the lips training invite', 'w'],
  ['ana', 'Ana Sample', 'fifty', 'Late forecast $6.75K · waiting on Q4 budget', 'c', 'Late forecast. Ask if the budget came through.', 'Ask about the Q4 budget', 'c'],
  ['lina', 'Lina Sample', 'fifty', 'Card declined Oct 19', 'c', 'Payment failed 2 days ago. Send a new link.', 'Send a new pay link', 'c'],
  ['ben', 'Dr. Ben Sample', 'fifty', 'Ordered Oct 15 · flyer is ready', 'c', 'Let him know the flyer is ready.', 'Tell him the flyer is ready', 'c'],
  ['maya', 'Dr. Maya Sample', 'fifty', 'Talked today · pricing goes out Monday', 'w', 'You spoke today. Next step is already set.', '', 'w'],
  ['ella', 'Dr. Ella Sample', 'fifty', 'Ordered Oct 19', 'w', 'Ordered 2 days ago.', '', 'w'],
  ['zoe', 'Zoe Sample', 'fifty', 'Ordered Oct 8 · lips post in design', 'w', 'Ordered recently. Nothing due.', 'Drop off the lips post', 'v'],
  ['raj', 'Raj Sample', 'fifty', 'Ordered Oct 13', 'w', 'Ordered last week.', '', 'w'],
  ['priya', 'Dr. Priya Sample', 'lead', 'Event lead · Toronto launch Oct 3 · no follow-up', 'c', 'Came to the launch 18 days ago and nobody called.', 'Call to thank her for coming and book a visit', 'p'],
  ['cal', 'Dr. Cal Sample', 'lead', 'Warm · opening a second clinic', 'v', 'Opening a second clinic. Visit while they’re choosing brands.', 'Visit and send onboarding', 'v'],
  ['sara', 'Dr. Sara Sample', 'lead', 'Onboarding · MD signature 6 days', 'c', 'Dr. Lee hasn’t signed in 6 days.', 'Remind Dr. Lee to sign', 'c'],
  ['nina', 'Nina Sample', 'lead', 'Onboarding form sent Oct 17 · not signed', 'c', 'Form unsigned for 4 days.', 'Resend the form and walk her through it', 'c'],
  ['jon', 'Jon Sample', 'lead', 'Event lead · lips webinar Oct 15', 'c', 'Webinar 6 days ago. Call while it’s fresh.', 'Call about the webinar', 'c'],
  ['ava', 'Ava Sample', 'lead', 'Meta lead · posts a lot of lip work', 'c', 'New Meta lead. Call within the week.', 'First call · intro saypha lips', 'c'],
  ['tom', 'Tom Sample', 'lead', 'Onboarding · MD signature 1 day', 'w', 'Sent to Dr. Kim yesterday. Give it a few days.', '', 'w'],
  ['lia', 'Dr. Lia Sample', 'lead', 'Meta lead · came in 2 days ago', 'c', 'Fresh Meta lead. Call within 48 hours.', 'First call · book a visit', 'c'],
  ['rob', 'Rob Sample', 'lead', 'Event lead · Toronto launch Oct 3 · never called', 'c', 'Came to the launch. Nobody has called yet.', 'Call about the launch', 'c'],
  ['eve', 'Eve Sample', 'lead', 'Warm · worked with you at your last company', 'c', 'Warm contact. Easy first call.', 'Catch up and introduce saypha', 'c'],
  ['una', 'Una Sample', 'lead', 'Cold · 2 calls, no answer in 3 weeks', 'p', 'No answer to 2 calls. Try again next month.', '', 'p'],
  ['gus', 'Gus Sample', 'lead', 'Meta lead · 41 days · never replied', 'p', 'Quiet for 6 weeks. Park and retry later.', '', 'p'],
];
const PICK = { v: 'visit', c: 'call', w: 'wait', p: 'park' };

const initials = (name) => name.replace(/^Dr\.\s+/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function weekly(rep) {
  const accounts = A.map(([id, name, group, fact, sug, reason, purpose, pick]) => ({
    id, name, ini: initials(name), group, fact, suggestedPick: PICK[sug], suggestedReason: reason, repPick: PICK[pick], purpose,
  }));
  return {
    rep: { id: rep.id, first: rep.first, ini: (rep.first[0] + rep.last[0]).toUpperCase() },
    manager: { first: MANAGER.first },
    session: { kind: 'weekly', dateLabel: 'MONDAY OCT 26', minutes: 45, weekStartDate: '2026-10-26' },
    checkin: { submittedLabel: 'Sent Fri 4:12 pm', helpNote: 'Dr. Noor keeps pushing back on price.' },
    // Pulled from Pulse visit logs, orders and agreements for last week (derived, never stored).
    wins: [
      { title: 'Dr. Cal Sample signed onboarding', sub: 'Opening a second clinic' },
      { title: 'Samples placed at 2 clinics', sub: 'Dr. Ria and Mo' },
      { title: 'Raj Sample reordered', sub: '$1,350 · Oct 13' },
    ],
    // Last week's focus (the previous session's focus task + action target), with actuals counted from Pulse and orders.
    lastFocus: { goal: 'close', setLabel: 'Set Oct 19', actionDone: 2, actionTarget: 3, result: 0, resultNote: 'Dr. Noor said next week' },
    tiles: {
      fifty: { count: 22, note: 'No change this week' },
      forecastLanded: { landed: 1, due: 3 },
      visits: { done: 9, planned: 12 },
      calls: { done: 8, planned: 10 },
    },
    missedVisits: [
      { name: 'Ana Sample' },
      { name: 'Omar Sample' },
      { name: 'Dr. Ben Sample' },
    ],
    forecastChanges: [
      { who: 'Kai', what: 'moved to November', reason: 'Budget or cash flow' },
      { who: 'Ana', what: 'dropped', reason: 'Still has stock' },
      { who: 'Dr. Maya', what: 'pushed to January', reason: 'Clinic’s timing' },
    ],
    accounts,
    // Second look: a few picks where the data points elsewhere, chosen over the weekend by simple rules (see
    // docs/compass-data-proposal.md). Only the plain fact line is shown.
    secondLook: [
      { id: 'noor', fact: 'Samples 20 days ago · no order yet' },
      { id: 'omar', fact: 'My Fifty · 38 days since the last order or visit' },
      { id: 'priya', fact: 'Came to the launch Oct 3 · no call since' },
      { id: 'zoe', fact: 'Ordered Oct 8 · nothing due right now' },
    ],
    // The pair that matches the rep's Friday note, and the month's skill (the default skill in roleplays).
    roleplay: { noteSkill: 'price_pushback', noteCharacter: 'skeptic', monthSkill: 'price_pushback' },
    // Suggested commitments for the manager, from the help note and this week's plan.
    commitments: [
      { key: 'a', text: 'Send the price-objection guide', on: true },
      { key: 'b', text: 'Join Tessa at Dr. Noor’s visit', on: false },
      { key: 'c', text: 'Ask marketing for a lips post', on: false },
      { key: 'd', text: 'Check Kai’s budget with the clinic owner', on: false },
    ],
  };
}

function monthly(rep) {
  const ini = (n) => initials(n);
  const row = ([id, name, why, amount]) => ({ id, name, ini: ini(name), why, amount });
  return {
    rep: { id: rep.id, first: rep.first, ini: (rep.first[0] + rep.last[0]).toUpperCase() },
    manager: { first: MANAGER.first },
    session: { kind: 'monthly', dateLabel: 'MONDAY NOV 2', minutes: 60, lastMonth: 'October', nextMonth: 'November', lastMonthShort: 'Oct', prevMonth: 'September' },
    lastMonth: {
      target: 40000, ordered: 34200, prevPercent: 85,
      forecastAccuracy: 77, accuracyNote: 'Oct 1',
      fifty: { count: 23, note: '+1 this month · Dr. Noor joined' },
      slipped: [['Budget or cash flow', 2], ['Clinic’s timing', 1], ['Still has stock', 1]],
      pattern: 'budget came up twice. Worth asking about budget timing earlier in the month.',
      focusWeeks: [
        { week: 'Oct 5', goal: 'fill', done: 4, target: 4 },
        { week: 'Oct 12', goal: 'warm', done: 3, target: 3 },
        { week: 'Oct 19', goal: 'close', done: 2, target: 3 },
        { week: 'Oct 26', goal: 'close', done: 3, target: 3 },
      ],
    },
    nextMonth: {
      target: 40000,
      forecast: [
        ['kai', 'Kai Sample', 'Moved from October', 13500], ['ken', 'Ken Sample', 'First order', 4050],
        ['raj', 'Raj Sample', 'Regular reorder', 1350], ['lina', 'Lina Sample', 'After the new pay link', 1350],
        ['leo', 'Leo Sample', 'First order after samples', 1350], ['tom', 'Tom Sample', 'First order once signed', 1350],
      ].map(row),
      // Accounts with no forecast next month that are likely to order (reorder rhythm, events, stated plans).
      gap: [
        ['ella', 'Dr. Ella Sample', 'Orders about every 6 weeks · last order Oct 19', 13500],
        ['maya', 'Dr. Maya Sample', 'Wants to order before Christmas', 2700],
        ['ben', 'Dr. Ben Sample', 'Reorders every 4–6 weeks · last Oct 15', 2700],
        ['noor', 'Dr. Noor Sample', 'First order just landed · reorder likely', 2700],
        ['zoe', 'Zoe Sample', 'Last order Oct 8', 1350],
      ].map(row),
    },
    // Every My Fifty account, with a status suggested from order rhythm.
    fifty: [
      ['ella', 'Dr. Ella Sample', 'Ordered Oct 19 · Vienna in December', 'on_track'],
      ['ben', 'Dr. Ben Sample', 'Ordered Oct 15', 'on_track'],
      ['maya', 'Dr. Maya Sample', 'Payment pending · ordering before Christmas', 'on_track'],
      ['zoe', 'Zoe Sample', 'Ordered Oct 8', 'on_track'],
      ['raj', 'Raj Sample', 'Ordered Oct 13', 'on_track'],
      ['noor', 'Dr. Noor Sample', 'First order Oct 29 · new to My Fifty', 'on_track'],
      ['kai', 'Kai Sample', '$13.5K moved to November · no order since Aug 30', 'watch'],
      ['ana', 'Ana Sample', 'Forecast dropped · still has stock', 'watch'],
      ['lina', 'Lina Sample', 'Card declined Oct 19', 'watch'],
      ['omar', 'Omar Sample', 'No order or visit since Sep 13', 'at_risk'],
    ].map(([id, name, fact, suggested]) => ({ id, name, ini: ini(name), fact, suggested })),
    monthSkill: 'price_pushback',
  };
}

const wait = (v) => new Promise((r) => setTimeout(() => r(v), 0));
const repOf = (id) => REPS.find((r) => r.id === id) || REPS[0];

// The sample source. Writes only log to the console: nothing is saved anywhere.
export const sample = {
  name: 'sample',
  session: () => wait({ me: { first: MANAGER.first, kind: MANAGER.kind }, reps: REPS.map((r) => ({ id: r.id, first: r.first, last: r.last, ini: (r.first[0] + r.last[0]).toUpperCase() })) }),
  weekly: (repId) => wait(weekly(repOf(repId))),
  monthly: (repId) => wait(monthly(repOf(repId))),
  saveWeekly: (repId, plan) => { console.info('[sample] weekly 1-on-1 not saved (sample data)', repId, plan); return wait({ ok: true, sample: true }); },
  saveMonthly: (repId, plan) => { console.info('[sample] monthly 1-on-1 not saved (sample data)', repId, plan); return wait({ ok: true, sample: true }); },
};

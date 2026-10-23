// Fixed lists Compass shares with Edge and Pulse. These are the enum values proposed in docs/compass-data-proposal.md;
// keep the keys in sync with it (and the goal keys with Edge's api/_edge/view.js GOALS, which they reuse).

// The six weekly goals. The keys are Edge's "This week's focus" keys (close, warm, grow, fill, refer, events), saved as a
// task with tasks.source = one_on_one and title = the key. Compass adds the weekly action (lead) and the result (lag).
// [key, name, short definition, weekly action, result, default action target]
export const GOALS = [
  ['close', 'Close sampled clinics', 'Turn samples into first orders.', 'sampled clinics asked for an order date', 'first orders', 3],
  ['warm', 'Keep My Fifty warm', 'Reach accounts going quiet.', 'quiet My Fifty accounts visited', 'reorders', 3],
  ['grow', 'Grow current accounts', 'Add a second product line.', 'current accounts shown a second line', 'accounts on a new line', 3],
  ['fill', 'Fill the pipeline', 'Move leads to Candidates.', 'warm leads given samples or onboarding', 'new candidates', 4],
  ['refer', 'Get referrals', 'Ask happy customers for one intro.', 'happy customers asked for an intro', 'introductions', 4],
  ['events', 'Fill the next event', 'Bring customers to a training.', 'customers invited in person', 'customers registered', 6],
].map(([key, name, def, action, result, target]) => ({ key, name, def, action, result, target }));
export const goalByKey = (k) => GOALS.find((g) => g.key === k) || null;

// Roleplay skills. Picking a skill also picks its matching character. "plan_week" is a monthly-only skill.
export const SKILLS = [
  { key: 'price_pushback', name: 'Handling price pushback', character: 'skeptic' },
  { key: 'ask_for_order', name: 'Asking for the order', character: 'fence_sitter' },
  { key: 'book_next_step', name: 'Booking the next step', character: 'rusher' },
  { key: 'ask_referral', name: 'Asking for a referral', character: 'fan' },
  { key: 'gatekeeper', name: 'Getting past the gatekeeper', character: 'gatekeeper' },
  { key: 'cold_visit', name: 'Opening a cold visit', character: 'newcomer' },
  { key: 'plan_week', name: 'Planning the week', character: null, monthlyOnly: true },
];
export const skillByKey = (k) => SKILLS.find((s) => s.key === k) || null;

// Roleplay characters: who the rep plays, the persona line, the opening line and one curveball.
export const CHARACTERS = [
  { key: 'skeptic', name: 'The Skeptic', who: 'Physician · loves her current brand', line: '“Honestly, it’s pricier than what I already use. Why switch?”', curve: 'She mentions a competitor just offered her a discount.' },
  { key: 'fence_sitter', name: 'The Fence-Sitter', who: 'Nurse injector · liked the samples', line: '“The samples were great… I just need to think about it.”', curve: 'She says her manager makes all the ordering decisions.' },
  { key: 'rusher', name: 'The Rusher', who: 'Clinic owner · always between patients', line: '“I’ve got two minutes. Send me an email?”', curve: 'A patient walks in halfway through.' },
  { key: 'fan', name: 'The Fan', who: 'Physician · a happy regular', line: '“Patients love the lips results!”', curve: 'She mentions a friend just opened a clinic downtown.' },
  { key: 'gatekeeper', name: 'The Gatekeeper', who: 'Front desk manager · protective', line: '“The doctor is busy. You can leave a brochure.”', curve: 'The doctor walks past the desk.' },
  { key: 'newcomer', name: 'The Newcomer', who: 'Clinic owner · never heard of saypha', line: '“Sorry, who are you with again?”', curve: 'He says he only uses one filler brand for everything.' },
];

// The four picks on Friday, and the four sort groups (derived from orders at the time, frozen on the pick).
export const PICKS = { visit: 'Visit', call: 'Call', wait: 'Wait', park: 'Park' };
export const GROUPS = { candidate: 'Candidate', onboarded: 'Onboarded', fifty: 'My Fifty', lead: 'Lead' };

// My Fifty monthly status.
export const FIFTY_STATUS = [
  { key: 'on_track', label: 'On track', dot: '#2E9E5B', on: 'background:#E6F4EA;color:#1E7B3C' },
  { key: 'watch', label: 'Watch', dot: '#F0A51A', on: 'background:#FFF1D6;color:#8A5A00' },
  { key: 'at_risk', label: 'At risk', dot: '#B42318', on: 'background:#FDE7E7;color:#B42318' },
];

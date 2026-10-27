// This week's focus, written up by Claude (Yousef 2026-10-27): at the end of the weekly 1-on-1 the manager types the focus
// in their own words; Claude turns it into one short focus line for the rep, which is saved as the week's focus task and
// shown on Edge Home and in Pulse. The manager can edit the line before saving.
// Needs ANTHROPIC_API_KEY on the Compass Vercel project. Without it (or if Claude can't be reached or declines), the op
// answers { line: null, reason } and the screen keeps the manager's own words.
const { Anthropic } = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5-5';
const SYSTEM = [
  'You help a sales manager at Renellence, a Canadian aesthetics supplier, write the weekly focus for one sales rep.',
  'The manager typed notes at the end of their weekly one-on-one. Turn them into the rep\'s focus for this week:',
  'one or two short sentences, at most 200 characters, written to the rep ("you"), plain and encouraging, specific to',
  'what the notes say (names, numbers and accounts kept as written). Do not add goals, numbers or names that are not in',
  'the notes. Reply with the focus text only, with no quotes, labels or preamble.',
].join(' ');

let client = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ timeout: 25000, maxRetries: 1 });   // under Vercel's 60 s limit
  return client;
}

// notes: the manager's typed words; rep: the rep's first name. -> { line } or { line: null, reason }
async function focusLine(notes, rep) {
  const c = claude();
  if (!c) return { line: null, reason: 'not_set_up' };
  let r;
  try {
    r = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',   // a declined request is re-run on Anthropic's recommended fallback model
      system: SYSTEM,
      messages: [{ role: 'user', content: 'Rep: ' + rep + '\nManager\'s notes:\n' + notes }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { line: null, reason: 'busy' };
    if (e instanceof Anthropic.APIConnectionError) return { line: null, reason: 'unreachable' };
    if (e instanceof Anthropic.APIError) return { line: null, reason: 'failed' };
    throw e;
  }
  if (r.stop_reason === 'refusal') return { line: null, reason: 'declined' };
  const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim()
    .replace(/^["“]|["”]$/g, '');
  if (!text) return { line: null, reason: 'empty' };
  return { line: text.slice(0, 200) };
}

module.exports = { focusLine, MODEL, _setClient: (c) => { client = c; } };

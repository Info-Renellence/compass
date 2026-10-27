// The weekly 1-on-1 (handoff README section 2, screens 08-13), reworked by Yousef 2026-10-27 after one-on-one best
// practice (recognition first, then the numbers, then the plan, then one agreed focus):
//   wins -> numbers -> visits -> roleplay -> calls -> this week's focus (typed) -> done.
// - Wins open the meeting on their own step, big, so achievements are the focal point.
// - The second look is not a step any more (no micromanaging): the rep's own picks stand, and picks that differ from
//   the suggestion go on Cat's separate list (SecondLook.jsx, the "Second look" tab).
// - No weekly visit cap on screen ("out of 15" removed).
// - "Find a customer" on every step: look anyone up and change this week's plan for them (Visit / Call / Wait / Park).
// - The focus is typed at the end, saved as written (no AI write-up, owner 2026-10-27); it shows on Edge Home and in Pulse.
// No "flagged", no counts of changed suggestions.
import { useEffect, useState } from 'react';
import { data, words } from '../data/index.js';
import { SKILLS, CHARACTERS, skillByKey, PICKS } from '../data/catalog.js';
import { Icon } from '../icons.jsx';
import { Banner, CardHead, Foot, Done, Empty, ErrorCard, SessionLine, Skeleton, titleCase, useToast } from '../ui.jsx';

const STEPS = ['Wins', 'Numbers', 'Visits', 'Roleplay', 'Calls', 'Focus'];
const TITLES = ['Last week’s wins', 'How the numbers look', 'Visits this week', 'Quick roleplay', 'Calls this week', 'This week’s focus'];
const GROUP_ORDER = { candidate: 0, onboarded: 1, fifty: 2, lead: 3 };
const GROUP_LABEL = { candidate: 'Candidate', onboarded: 'Onboarded', fifty: 'My Fifty', lead: 'Lead' };
const GROUP_KEYS = ['candidate', 'onboarded', 'fifty', 'lead'];
// A Friday check-in counts as sent when the API labels it "Sent ..." (else "Draft, not sent" / "No Friday check-in").
const isSent = (label) => /^Sent\b/.test(label || '');
// A card that leaves a list (removed, or moved to the other list) plays a 150ms exit first, unless motion is reduced.
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function useLeaving() {
  const [gone, setGone] = useState({});
  const leave = (a, fn) => {
    if (reduced()) { fn(a); return; }
    setGone((g) => Object.assign({}, g, { [a.id]: true }));
    setTimeout(() => { fn(a); setGone((g) => Object.assign({}, g, { [a.id]: false })); }, 150);
  };
  return [gone, leave];
}

function fresh(d) {
  const month = skillByKey(d.roleplay.monthSkill) || SKILLS[0];
  const sv = d.saved || {};
  // A week already saved opens as it was agreed: every final pick that differs from the rep's own Friday pick.
  const removed = {}, toVisit = {}, toCall = {}, override = {};
  for (const a of d.accounts) {
    if (!a.finalPick || a.finalPick === a.repPick) continue;
    if (a.finalPick === 'visit') toVisit[a.id] = true;
    else if (a.finalPick === 'call') toCall[a.id] = true;
    else override[a.id] = a.finalPick;
  }
  const skill = skillByKey(sv.skill) || month;
  return {
    step: 1, reached: 1, done: false,
    removed, toVisit, toCall, override,
    focusText: sv.focusText || '',
    skill: skill.key, character: sv.character || skill.character || 'skeptic', practiced: !!sv.practiced, curve: false, swapped: false,
    commit: Object.fromEntries(d.commitments.map((c) => [c.key, !!c.on])),
  };
}

export default function Weekly({ repId }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => { setErr(''); data.weekly(repId).then(setD, (e) => setErr(words(e))); };
  useEffect(load, [repId]);
  if (err) return <ErrorCard text={err} onRetry={load} />;
  if (!d) return <Skeleton />;
  return <Session d={d} repId={repId} />;
}

function Session({ d, repId }) {
  const flash = useToast();
  const [s, setS] = useState(() => fresh(d));
  const set = (patch) => setS((x) => Object.assign({}, x, typeof patch === 'function' ? patch(x) : patch));
  const rep = d.rep.first, boss = d.manager.first;
  const [finding, setFinding] = useState(false);
  useEffect(() => { flash(''); }, [s.step]);   // a toast never outlives its step
  // Each step and the done screen open at the top (Next sits at the bottom of a long step; run 3, 2026-10-23).
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) { /* no window */ } }, [s.step, s.done]);

  // Where each account ends up this week: a pick changed in "Find a customer", else a "Make it a call" from Visits or a
  // "Make it a visit" from Calls, else removed (Wait), else the rep's own Friday pick.
  const finalPick = (a) => {
    if (s.override[a.id]) return s.override[a.id];
    if (s.toCall[a.id]) return 'call';
    if (s.toVisit[a.id]) return 'visit';
    if (s.removed[a.id]) return 'wait';
    return a.repPick;
  };
  const setPick = (a, pick) => {
    const off = (m) => Object.assign({}, m, { [a.id]: false });
    set((x) => ({ override: Object.assign({}, x.override, { [a.id]: pick }), removed: off(x.removed), toVisit: off(x.toVisit), toCall: off(x.toCall) }));
    flash(a.name + ' → ' + PICKS[pick]);
  };
  // Moving a card from Visits or Calls (or removing it) wins over an earlier Find-a-customer pick.
  const unpick = (x, id) => Object.assign({}, x.override, { [id]: null });
  const focusText = s.focusText.trim().slice(0, 200);
  const live = d.accounts.filter((a) => !s.removed[a.id]).sort((x, y) => GROUP_ORDER[x.group] - GROUP_ORDER[y.group]);
  const visits = live.filter((a) => finalPick(a) === 'visit');
  const calls = live.filter((a) => finalPick(a) === 'call');
  const okStep = [true, true, true, true, true, !!focusText];

  const goStep = (k) => set((x) => ({ step: k, reached: Math.max(x.reached, k) }));
  const next = () => {
    if (!okStep[s.step - 1]) { flash('Type this week’s focus first', 'warn'); return; }
    if (s.step < 6) { goStep(s.step + 1); return; }
    const plan = {
      picks: d.accounts.map((a) => ({ id: a.id, finalPick: finalPick(a) })),
      // Not discussed in the meeting any more; sent without a decision so the facts are kept for Cat's list.
      secondLook: d.secondLook.map((x) => ({ id: x.id, decision: null })),
      focus: { text: focusText },
      roleplay: { skill: s.skill, character: s.character, done: s.practiced },
      commitments: d.commitments.filter((c) => s.commit[c.key]).map((c) => c.text),
    };
    data.saveWeekly(repId, plan).then(() => { set({ done: true }); flash('Sent to ' + rep + '’s Pulse'); }, (e) => flash(words(e), 'error'));
  };
  const back = () => set((x) => ({ step: Math.max(1, x.step - 1) }));

  const sessionText = '1-on-1 · ' + titleCase(d.session.dateLabel) + ' · ' + d.session.minutes + ' min';
  if (s.done) {
    return (
      <>
      <SessionLine text={sessionText} />
      <Done title={rep + '’s week is set'} line={visits.length + ' visits · ' + calls.length + ' calls · focus: ' + focusText}>
        <div className="where c2">
          <section><span className="k">PULSE · TODAY</span><span className="t">{rep} confirms the week with one tap. Visits, calls and the focus appear there.</span></section>
          <section><span className="k">EDGE · HOME</span><span className="t">This week’s focus card</span></section>
        </div>
        <section className="will" aria-label={boss + ' will'}>
          <span className="h"><b>{boss} will…</b><span>Added to {boss}’s to-dos for the week</span></span>
          <div className="chips">
            {d.commitments.map((c) => {
              const on = !!s.commit[c.key];
              return (
                <button key={c.key} type="button" className={'wchip' + (on ? ' on' : '')} aria-pressed={on}
                  onClick={() => {
                    const commit = Object.assign({}, s.commit, { [c.key]: !s.commit[c.key] });
                    set({ commit });
                    data.saveCommitments(repId, d.commitments.filter((k) => commit[k.key]).map((k) => k.text)).catch((e) => flash(words(e), 'error'));
                  }}>
                  {on ? <Icon name="check" size={13} /> : null}{c.text}
                </button>
              );
            })}
          </div>
          <span className="foot-note">Anything else {boss} agrees to is picked up from the meeting notes.</span>
        </section>
      </Done>
      </>
    );
  }

  return (
    <>
      {/* Owner 2026-10-23: the session line lives in the top bar, the step subtitles are gone, and the banner carries a
          live count of this week's visits and calls. */}
      <SessionLine text={sessionText} />
      <Banner title={TITLES[s.step - 1]} center={<LiveCount visits={visits.length} calls={calls.length} />}
        steps={STEPS} step={s.step} reached={6} onStep={goStep} />
      <div className="find-row">
        <button type="button" className="sbtn find-btn" onClick={() => setFinding(true)}><Icon name="search" size={14} />Find a customer</button>
      </div>
      {finding ? <FindCustomer accounts={d.accounts} pickOf={finalPick} onPick={setPick} onClose={() => setFinding(false)} /> : null}
      {s.step === 1 ? <Wins d={d} rep={rep} /> : null}
      {s.step === 2 ? <Numbers d={d} rep={rep} /> : null}
      {s.step === 3 ? <Visits visits={visits} onRemove={(a) => { set((x) => ({ removed: Object.assign({}, x.removed, { [a.id]: true }), override: unpick(x, a.id) })); flash('Removed ' + a.name); }}
        onCall={(a) => {
          set((x) => ({ toCall: Object.assign({}, x.toCall, { [a.id]: true }), toVisit: Object.assign({}, x.toVisit, { [a.id]: false }), override: unpick(x, a.id) }));
          flash(a.name + ' moved to calls');
        }} /> : null}
      {s.step === 4 ? <Roleplay s={s} set={set} rep={rep} boss={boss} d={d} flash={flash} /> : null}
      {s.step === 5 ? <Calls calls={calls}
        onRemove={(a) => { set((x) => ({ removed: Object.assign({}, x.removed, { [a.id]: true }), override: unpick(x, a.id) })); flash('Removed ' + a.name); }}
        onVisit={(a) => {
          set((x) => ({ toVisit: Object.assign({}, x.toVisit, { [a.id]: true }), toCall: Object.assign({}, x.toCall, { [a.id]: false }), override: unpick(x, a.id) })); flash(a.name + ' moved to visits');
        }} /> : null}
      {s.step === 6 ? <Focus s={s} set={set} rep={rep} /> : null}
      <Foot onBack={s.step > 1 ? back : null} onNext={next} nextLabel={s.step === 6 ? 'Save the week' : 'Next'} blocked={!okStep[s.step - 1]}
        hint={s.step === 6 ? 'Type a focus to save' : null} />
    </>
  );
}

// Step 1: last week's wins, on their own and big (Yousef 2026-10-27: achievements are the focal point of the start).
function Wins({ d, rep }) {
  return (
    <section className="wins-hero">
      <span className="wh-k">{rep.toUpperCase()}’S WINS LAST WEEK</span>
      {d.wins.length ? (
        <div className="wh-grid">
          {d.wins.map((w) => (
            <div key={w.title} className="wh-card">
              <span className="wh-star"><Icon name="star5" size={22} /></span>
              <span className="wh-t">{w.title}</span>
              <span className="wh-s">{w.sub}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="wh-none">
          <span className="wh-t">No signed onboardings, samples or orders landed last week.</span>
          <span className="wh-s">Start with what went well anyway: a good visit, a new contact, a step forward.</span>
        </div>
      )}
    </section>
  );
}

// Step 2: the numbers. What the rep wants to talk about first, then the KPIs, missed visits and forecast changes.
function Numbers({ d, rep }) {
  const t = d.tiles;
  const of = (x) => (x.planned == null ? String(x.done) : x.done + ' of ' + x.planned);
  return (
    <>
      {d.checkin.helpNote ? <section className="talk">
        <span className="ic"><Icon name="chat" size={20} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="k">{rep.toUpperCase()} WANTS TO TALK ABOUT</span>
          <span className="q">“{d.checkin.helpNote}”</span>
        </span>
      </section> : null}
      <div className="kpi-grid">
        <section className="stat"><span className="k">MY FIFTY</span><span className="v">{t.fifty.count}</span><span className="s">{t.fifty.note}</span></section>
        <section className="stat"><span className="k">FORECAST LANDED</span><span className="v">{t.forecastLanded.landed} of {t.forecastLanded.due}</span><span className="s">Due last week</span></section>
        <section className="stat"><span className="k">VISITS DONE</span><span className="v">{of(t.visits)}</span><span className="s">{t.visits.planned == null ? 'No plan last week' : 'Planned last Monday'}</span></section>
        <section className="stat"><span className="k">CALLS DONE</span><span className="v">{of(t.calls)}</span><span className="s">{t.calls.planned == null ? 'No plan last week' : 'Planned last Monday'}</span></section>
      </div>
      <div className="two">
        <section className="cc">
          <CardHead icon="pin" title="Missed visits" right={<span className="cnt">{d.missedVisits.length}</span>} />
          {d.missedVisits.length ? d.missedVisits.map((m, i) => <div key={m.name + i} className="mrow"><span className="n">{m.name}</span></div>)
            : <Empty icon="check" text="None" />}
        </section>
        <section className="cc">
          <CardHead icon="doc" title="Forecast changes" right={isSent(d.checkin.submittedLabel)
            ? <span className="cnt green"><Icon name="check" size={13} />{d.checkin.submittedLabel}</span>
            : <span className="cnt neutral"><Icon name="clock" size={13} />{d.checkin.submittedLabel}</span>} />
          {d.forecastChanges.length ? (
            <div className="fc-lines">
              {d.forecastChanges.map((c, i) => <span key={c.who + i}><b>{c.who}</b> {c.what} · {c.reason}</span>)}
            </div>
          ) : <Empty icon="doc" text="No forecast changes" />}
        </section>
      </div>
    </>
  );
}

// "Find a customer" (Yousef 2026-10-27): look anyone on this week's list up and change their plan for the week.
// Parked accounts are not on the list until their date (the Friday check-in's Park rule).
function FindCustomer({ accounts, pickOf, onPick, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const n = q.trim().toLowerCase();
  const hits = n ? accounts.filter((a) => a.name.toLowerCase().includes(n)).slice(0, 8) : [];
  return (
    <div className="find-wrap" role="dialog" aria-modal="true" aria-label="Find a customer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="cc find-card">
        <CardHead lite icon="search" title="Find a customer" right={<button type="button" className="xbtn" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button>} />
        <input className="find-input" autoFocus placeholder="Type a name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Customer name" />
        {n && !hits.length ? <Empty icon="search" text="Nobody on this week’s list matches. Parked accounts come back on their date." /> : null}
        {hits.map((a) => {
          const cur = pickOf(a);
          return (
            <div key={a.id} className="find-item">
              <span className="ava">{a.ini}</span>
              <span className="tx"><b>{a.name}</b><span>{a.fact}</span></span>
              <span className={'gpill ' + a.group}>{GROUP_LABEL[a.group]}</span>
              <div className="find-seg" role="radiogroup" aria-label={'This week for ' + a.name}>
                {Object.keys(PICKS).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={cur === k} className={cur === k ? 'on ' + k : ''} onClick={() => onPick(a, k)}>{PICKS[k]}</button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// Live count of the week: visits and calls (no cap shown since 2026-10-27). Bumps when a number changes.
function LiveCount({ visits, calls }) {
  return (
    <div className="livecount" role="status" aria-live="polite" aria-label={visits + ' visits, ' + calls + ' calls'}>
      <span className="lc">
        <span className="ic"><Icon name="pin" size={16} /></span>
        <span className="nums"><b key={'v' + visits} className="bump">{visits}</b></span>
        <span className="lbl">VISITS</span>
      </span>
      <span className="div" aria-hidden="true" />
      <span className="lc">
        <span className="ic call"><Icon name="call" size={16} /></span>
        <span className="nums"><b key={'c' + calls} className="bump">{calls}</b></span>
        <span className="lbl">CALLS</span>
      </span>
    </div>
  );
}

function Visits({ visits, onRemove, onCall }) {
  const [gone, leave] = useLeaving();
  return (
    <section className="cc">
      <CardHead lite icon="pin" title="Visits this week" right={<span className="right-strong">{visits.length} {visits.length === 1 ? 'visit' : 'visits'}</span>} />
      {/* Owner 2026-10-23: no purpose notes on this step; a mix by group and a card grid (no capacity bar since 2026-10-27). */}
      <div className="vsum">
        <div className="vmix">
          {GROUP_KEYS.map((g) => {
            const n = visits.filter((a) => a.group === g).length;
            return n ? <span key={g} className={'gpill ' + g}>{n} {GROUP_LABEL[g]}</span> : null;
          })}
        </div>
      </div>
      <div className="vgrid">
        {visits.map((a) => (
          <div key={a.id} className={'vcard' + (gone[a.id] ? ' leaving' : '')}>
            <span className="ava">{a.ini}</span>
            <span className="tx"><b>{a.name}</b><span>{a.fact}</span>
              <span className="vfoot"><span className={'gpill ' + a.group}>{GROUP_LABEL[a.group]}</span>
                <button type="button" className="minibtn tocall" onClick={() => leave(a, onCall)}><Icon name="call" size={14} />Make it a call</button></span></span>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => leave(a, onRemove)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      {!visits.length ? <Empty icon="pin" text="No visits this week" /> : null}
    </section>
  );
}

function Roleplay({ s, set, rep, boss, d, flash }) {
  const skill = skillByKey(s.skill), ch = CHARACTERS.find((c) => c.key === s.character);
  const clinicPlayer = s.swapped ? boss : rep, repPlayer = s.swapped ? rep : boss;
  return (
    <>
      <section className="rp-pick">
        <div className="rp-row" role="radiogroup" aria-label="Skill">
          <span className="lab">SKILL</span>
          {SKILLS.filter((k) => !k.monthlyOnly).map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={s.skill === k.key} className={'rchip skill' + (s.skill === k.key ? ' on' : '')}
              onClick={() => set({ skill: k.key, character: k.character, practiced: false, curve: false })}>
              {k.name}{k.key === d.roleplay.noteSkill ? <span className="ndot" role="img" aria-label="from the Friday note"><Icon name="note" size={14} /></span> : null}
            </button>
          ))}
        </div>
        <div className="rp-row" role="radiogroup" aria-label="Character">
          <span className="lab">CHARACTER</span>
          {CHARACTERS.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={s.character === c.key} className={'rchip char' + (s.character === c.key ? ' on' : '')}
              onClick={() => set({ character: c.key, curve: false })}>
              {c.name}{c.key === d.roleplay.noteCharacter ? <span className="ndot" role="img" aria-label="from the Friday note"><Icon name="note" size={14} /></span> : null}
            </button>
          ))}
        </div>
        <span className="rp-legend"><span className="ndot" aria-hidden="true"><Icon name="note" size={14} /></span>From {rep}’s Friday note</span>
      </section>
      <section className="scene">
        <div className="lcol">
          <span className="prac">PRACTISING · {skill.name.toUpperCase()}</span>
          <span className="role">
            <span className="rav">{ch.name.replace('The ', '').slice(0, 2).toUpperCase()}</span>
            <span className="tx"><span className="k">{clinicPlayer.toUpperCase()} PLAYS</span><span className="nm">{ch.name}</span><span className="wh">{ch.who}</span></span>
          </span>
          <span className="role">
            <span className="rav rep"><Icon name="person" size={16} /></span>
            <span className="tx"><span className="k">{repPlayer.toUpperCase()} PLAYS</span><span className="nm">The rep</span></span>
          </span>
        </div>
        <div className="rcol">
          <span className="bubble">{ch.line}</span>
          {s.curve ? <span className="curve"><Icon name="alert" size={16} /><span className="k">CURVEBALL</span><span className="t">{ch.curve}</span></span> : null}
          <div className="btns">
            {!s.curve ? <button type="button" className="sbtn curveb" onClick={() => set({ curve: true })}>Throw a curveball</button> : null}
            <button type="button" className="sbtn" onClick={() => { set((x) => ({ swapped: !x.swapped })); flash(s.swapped ? rep + ' plays the clinic again' : 'Roles swapped. ' + boss + ' plays the clinic'); }}>
              <Icon name="swap" size={13} />Swap roles
            </button>
            <button type="button" className={'sbtn done' + (s.practiced ? ' ok' : '')} aria-pressed={s.practiced} onClick={() => set((x) => ({ practiced: !x.practiced }))}>
              <Icon name="check" size={13} />{s.practiced ? 'Done' : 'Done, back to it'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function Calls({ calls, onRemove, onVisit }) {
  const [gone, leave] = useLeaving();
  return (
    <section className="cc">
      <CardHead lite icon="call" title="Calls this week" right={<span className="right-strong">{calls.length} calls</span>} />
      <span className="cc-note">A quick look. Turn any call into a visit if it deserves one.</span>
      <div className="calls">
        {calls.map((a) => (
          <div key={a.id} className={'callc' + (gone[a.id] ? ' leaving' : '')}>
            <span className="ava">{a.ini}</span>
            <span className="tx"><b>{a.name}</b><span>{a.purpose || a.suggestedReason}</span></span>
            <button type="button" className="minibtn tovisit" onClick={() => leave(a, onVisit)}><Icon name="pin" size={14} />Make it a visit</button>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => leave(a, onRemove)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      {!calls.length ? <Empty icon="call" text="No calls this week" /> : null}
    </section>
  );
}

// Step 6: this week's focus, typed at the end of the meeting and saved as written (Yousef 2026-10-27: no goal list, no AI
// write-up). It is what Edge Home and Pulse show for the week.
function Focus({ s, set, rep }) {
  return (
    <section className="cc focus-type">
      <CardHead lite icon="note" title={'What will ' + rep + ' focus on this week?'} />
      <textarea className="focus-final" value={s.focusText} maxLength={200} aria-label="This week’s focus"
        placeholder={'e.g. Get Dr. Noor and Ken to a first order, and book two visits with clinics going quiet.'}
        onChange={(e) => set({ focusText: e.target.value })} />
      <span className="foot-note">Shown on Edge and in Pulse exactly as typed · {200 - s.focusText.length} characters left</span>
    </section>
  );
}

// The weekly 1-on-1 (handoff README section 2, screens 08-13): how last week went -> second look -> visits ->
// roleplay -> calls -> one focus -> done. No typing during the meeting: purposes and next steps come from the
// meeting notes afterwards. No "AI" wording, no "flagged", no counts of changed suggestions.
import { useEffect, useMemo, useState } from 'react';
import { data, words } from '../data/index.js';
import { GOALS, goalByKey, SKILLS, CHARACTERS, skillByKey, PICKS } from '../data/catalog.js';
import { Icon } from '../icons.jsx';
import { Banner, CardHead, Foot, Done, Empty, ErrorCard, SessionLine, Skeleton, titleCase, useToast } from '../ui.jsx';

const STEPS = ['Last week', 'Second look', 'Visits', 'Roleplay', 'Calls', 'Focus'];
const TITLES = ['How last week went', 'Second look', 'Visits this week', 'Quick roleplay', 'Calls this week', 'One focus'];
// The weekly visit cap: settings.compass.max_visits from the API (session.maxVisits); 15 on sample data.
let MAX_VISITS = 15;
const GROUP_ORDER = { candidate: 0, onboarded: 1, fifty: 2, lead: 3 };
const GROUP_LABEL = { candidate: 'Candidate', onboarded: 'Onboarded', fifty: 'My Fifty', lead: 'Lead' };
const GROUP_KEYS = ['candidate', 'onboarded', 'fifty', 'lead'];
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// A Friday check-in counts as sent when the API labels it "Sent ..." (else "Draft, not sent" / "No Friday check-in").
const isSent = (label) => /^Sent\b/.test(label || '');

function fresh(d) {
  const month = skillByKey(d.roleplay.monthSkill) || SKILLS[0];
  const sv = d.saved || {};
  // A week already saved opens as it was agreed: the second-look decisions and the final picks.
  const decision = {}, removed = {}, toVisit = {}, toCall = {};
  for (const x of d.secondLook) if (x.decision) decision[x.id] = x.decision;
  for (const a of d.accounts) {
    if (!a.finalPick) continue;
    const planned = decision[a.id] === 'change' ? a.suggestedPick : a.repPick;
    if (a.finalPick === planned) continue;
    if (a.finalPick === 'visit') toVisit[a.id] = true;
    else if (a.finalPick === 'call') toCall[a.id] = true;
    else if (planned === 'visit' || planned === 'call') removed[a.id] = true;
  }
  const skill = skillByKey(sv.skill) || month;
  return {
    step: 1, reached: 1, done: false,
    decision, removed, toVisit, toCall,
    goal: sv.goal || null, target: sv.target || 3,
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
  MAX_VISITS = (d.session && d.session.maxVisits) || 15;
  return <Session d={d} repId={repId} />;
}

function Session({ d, repId }) {
  const flash = useToast();
  const [s, setS] = useState(() => fresh(d));
  const set = (patch) => setS((x) => Object.assign({}, x, typeof patch === 'function' ? patch(x) : patch));
  const rep = d.rep.first, boss = d.manager.first;
  const byId = useMemo(() => Object.fromEntries(d.accounts.map((a) => [a.id, a])), [d]);
  useEffect(() => { flash(''); }, [s.step]);   // a toast never outlives its step

  // Where each account ends up this week: a "Make it a call" from Visits or a "Make it a visit" from Calls, else the
  // second-look decision, else the rep's own Friday pick.
  const finalPick = (a) => {
    if (s.toCall[a.id]) return 'call';
    if (s.toVisit[a.id]) return 'visit';
    return s.decision[a.id] === 'change' ? a.suggestedPick : a.repPick;
  };
  const live = d.accounts.filter((a) => !s.removed[a.id]).sort((x, y) => GROUP_ORDER[x.group] - GROUP_ORDER[y.group]);
  const visits = live.filter((a) => finalPick(a) === 'visit');
  const calls = live.filter((a) => finalPick(a) === 'call');
  const goal = goalByKey(s.goal);
  const okStep = [true, true, visits.length <= MAX_VISITS, true, true, !!goal];

  const goStep = (k) => set((x) => ({ step: k, reached: Math.max(x.reached, k) }));
  const next = () => {
    if (!okStep[s.step - 1]) { flash(s.step === 3 ? 'Cut visits to ' + MAX_VISITS + ' or fewer' : 'Pick a focus first', 'warn'); return; }
    if (s.step < 6) { goStep(s.step + 1); return; }
    const plan = {
      picks: d.accounts.map((a) => ({ id: a.id, finalPick: s.removed[a.id] ? 'wait' : finalPick(a) })),
      secondLook: d.secondLook.map((x) => ({ id: x.id, decision: s.decision[x.id] || null })),
      focus: { goal: goal.key, actionTarget: s.target },
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
      <Done title={rep + '’s week is set'} line={visits.length + ' visits · ' + calls.length + ' calls · focus: ' + goal.name + ' · ' + s.target + ' ' + goal.action}>
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
      {s.step === 1 ? <LastWeek d={d} rep={rep} /> : null}
      {s.step === 2 ? <SecondLook d={d} byId={byId} rep={rep} decision={s.decision}
        onDecide={(id, v) => {
          set((x) => ({ decision: Object.assign({}, x.decision, { [id]: v }) }));
          if (v === 'change') flash(byId[id].name + ' → ' + PICKS[byId[id].suggestedPick]);
        }} /> : null}
      {s.step === 3 ? <Visits visits={visits} onRemove={(a) => { set((x) => ({ removed: Object.assign({}, x.removed, { [a.id]: true }) })); flash('Removed ' + a.name); }}
        onCall={(a) => {
          set((x) => ({ toCall: Object.assign({}, x.toCall, { [a.id]: true }), toVisit: Object.assign({}, x.toVisit, { [a.id]: false }) }));
          flash(a.name + ' moved to calls');
        }} /> : null}
      {s.step === 4 ? <Roleplay s={s} set={set} rep={rep} boss={boss} d={d} flash={flash} /> : null}
      {s.step === 5 ? <Calls calls={calls}
        onRemove={(a) => { set((x) => ({ removed: Object.assign({}, x.removed, { [a.id]: true }) })); flash('Removed ' + a.name); }}
        onVisit={(a) => {
          if (visits.length >= MAX_VISITS) { flash('Visits are full: ' + MAX_VISITS + ' a week', 'warn'); return; }
          set((x) => ({ toVisit: Object.assign({}, x.toVisit, { [a.id]: true }), toCall: Object.assign({}, x.toCall, { [a.id]: false }) })); flash(a.name + ' moved to visits');
        }} /> : null}
      {s.step === 6 ? <Focus s={s} set={set} rep={rep} /> : null}
      <Foot onBack={s.step > 1 ? back : null} onNext={next} nextLabel={s.step === 6 ? 'Save the week' : 'Next'} blocked={!okStep[s.step - 1]}
        hint={s.step === 6 ? 'Pick a focus to save' : null} />
    </>
  );
}

function LastWeek({ d, rep }) {
  const f = d.lastFocus, g = f && goalByKey(f.goal), t = d.tiles;
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
      <div className="wins">
        {d.wins.map((w) => (
          <span key={w.title} className="win">
            <span className="st"><Icon name="star5" size={15} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="t">{w.title}</span><span className="s">{w.sub}</span></span>
          </span>
        ))}
      </div>
      <div className="lw-grid">
        {g ? (
          <section className="focus-hero">
            <span className="top"><span className="k">LAST WEEK’S FOCUS</span><span className="when">{f.setLabel} · counted from Pulse and orders</span></span>
            <span className="g">{g.name}</span>
            <div className="subs">
              <span className="sub"><span className="a">WEEKLY ACTION</span><span className="b">{f.actionTarget ? f.actionDone + ' of ' + f.actionTarget : f.actionDone}</span><span className="c">{g.action}</span></span>
              <span className="sub"><span className="a">RESULT</span><span className="b">{f.result}</span><span className="c">{g.result}{f.resultNote ? ' · ' + f.resultNote : ''}</span></span>
            </div>
          </section>
        ) : (
          <section className="focus-hero none">
            <span className="top"><span className="k">LAST WEEK’S FOCUS</span></span>
            <span className="g">No focus was set last week</span>
          </section>
        )}
        <div className="lw-col">
          <section className="stat"><span className="k">MY FIFTY</span><span className="v">{t.fifty.count}</span><span className="s">{t.fifty.note}</span></section>
          <section className="stat"><span className="k">FORECAST LANDED</span><span className="v">{t.forecastLanded.landed} of {t.forecastLanded.due}</span><span className="s">Due last week</span></section>
        </div>
        <div className="lw-col">
          <section className="stat"><span className="k">VISITS DONE</span><span className="v">{of(t.visits)}</span><span className="s">{t.visits.planned == null ? 'No plan last week' : 'Planned last Monday'}</span></section>
          <section className="stat"><span className="k">CALLS DONE</span><span className="v">{of(t.calls)}</span><span className="s">{t.calls.planned == null ? 'No plan last week' : 'Planned last Monday'}</span></section>
        </div>
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

function SecondLook({ d, byId, rep, decision, onDecide }) {
  return (
    <div className="sl-list">
      {!d.secondLook.length ? <section className="cc"><Empty icon="check" text="Nothing for a second look this week." /></section> : null}
      {d.secondLook.map((x) => {
        const a = byId[x.id], dec = decision[x.id];
        return (
          <section key={x.id} className={'sl' + (dec ? ' decided' : '')}>
            <span className="av46">{a.ini}</span>
            <span className="mid">
              <span className="nm"><b>{a.name}</b><span className={'reppill ' + a.repPick}>{rep}: {PICKS[a.repPick]}</span></span>
              <span className="fact">{x.fact}</span>
            </span>
            <span className="acts">
              <button type="button" className={'slbtn keep' + (dec === 'keep' ? ' on' : '')} aria-pressed={dec === 'keep'} onClick={() => onDecide(x.id, 'keep')}>Keep {PICKS[a.repPick]}</button>
              <button type="button" className={'slbtn alt' + (dec === 'change' ? ' on' : '')} aria-pressed={dec === 'change'} onClick={() => onDecide(x.id, 'change')}>Make it a {PICKS[a.suggestedPick]}</button>
            </span>
          </section>
        );
      })}
    </div>
  );
}

// Live count of the week: visits against the 15 cap, and calls. Bumps when a number changes.
function LiveCount({ visits, calls }) {
  const over = visits > MAX_VISITS;
  return (
    <div className="livecount" role="status" aria-live="polite" aria-label={visits + ' of ' + MAX_VISITS + ' visits, ' + calls + ' calls'}>
      <span className={'lc' + (over ? ' over' : '')}>
        <span className="ic"><Icon name="pin" size={16} /></span>
        <span className="nums"><b key={'v' + visits} className="bump">{visits}</b><i>/ {MAX_VISITS}</i></span>
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
  const over = visits.length > MAX_VISITS;
  return (
    <section className="cc">
      <CardHead lite icon="pin" title="Visits this week" right={<span className={'right-strong' + (over ? ' over' : '')}>{over ? <Icon name="alert" size={14} /> : null}{visits.length} of {MAX_VISITS}</span>} />
      {/* Owner 2026-10-23: no purpose notes on this step; the space goes to a capacity bar, a mix by group and a card grid. */}
      <div className="vsum">
        <div className="vcap" aria-label={visits.length + ' of ' + MAX_VISITS + ' visits'}>
          {Array.from({ length: MAX_VISITS }, (_, i) => <span key={i} className={'seg' + (i < visits.length ? (over ? ' on over' : ' on') : '')} />)}
        </div>
        <div className="vmix">
          {GROUP_KEYS.map((g) => {
            const n = visits.filter((a) => a.group === g).length;
            return n ? <span key={g} className={'gpill ' + g}>{n} {GROUP_LABEL[g]}</span> : null;
          })}
        </div>
      </div>
      <div className="vgrid">
        {visits.map((a) => (
          <div key={a.id} className="vcard">
            <span className="ava">{a.ini}</span>
            <span className="tx"><b>{a.name}</b><span>{a.fact}</span>
              <span className="vfoot"><span className={'gpill ' + a.group}>{GROUP_LABEL[a.group]}</span>
                <button type="button" className="minibtn tocall" onClick={() => onCall(a)}><Icon name="call" size={14} />Make it a call</button></span></span>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => onRemove(a)}><Icon name="x" size={14} /></button>
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
  return (
    <section className="cc">
      <CardHead lite icon="call" title="Calls this week" right={<span className="right-strong">{calls.length} calls</span>} />
      <span className="cc-note">A quick look. Turn any call into a visit if it deserves one.</span>
      <div className="calls">
        {calls.map((a) => (
          <div key={a.id} className="callc">
            <span className="ava">{a.ini}</span>
            <span className="tx"><b>{a.name}</b><span>{a.purpose || a.suggestedReason}</span></span>
            <button type="button" className="minibtn tovisit" onClick={() => onVisit(a)}><Icon name="pin" size={14} />Make it a visit</button>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => onRemove(a)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      {!calls.length ? <Empty icon="call" text="No calls this week" /> : null}
    </section>
  );
}

function Focus({ s, set, rep }) {
  const g = goalByKey(s.goal);
  return (
    <>
      <div className="goals" role="radiogroup" aria-label="This week’s focus">
        {GOALS.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={s.goal === x.key} className={'goal' + (s.goal === x.key ? ' on' : '')}
            onClick={() => set({ goal: x.key, target: x.target })}>
            <span className="top"><span className="nm">{x.name}</span>{s.goal === x.key ? <span className="tick"><Icon name="check" size={12} /></span> : null}</span>
            <span className="df">{x.def}</span>
            <span className="rs">Result: {x.result}</span>
          </button>
        ))}
      </div>
      {g ? (
        <div className="lead-lag">
          <span className="l">
            <span className="k">WEEKLY ACTION · WHAT {rep.toUpperCase()} CONTROLS</span>
            <span className="stepr">
              <button type="button" className="circ" aria-label="Less" onClick={() => set((x) => ({ target: Math.max(1, x.target - 1) }))}><Icon name="minus" size={16} /></button>
              <span className="num" aria-live="polite">{s.target}</span>
              <button type="button" className="circ plus" aria-label="More" onClick={() => set((x) => ({ target: Math.min(15, x.target + 1) }))}><Icon name="plus" size={16} /></button>
              <span className="act">{g.action}</span>
            </span>
          </span>
          <span className="r"><span className="k">RESULT WE TRACK</span><span className="v">{cap(g.result)}</span><span className="s">Counted from Pulse and orders</span></span>
        </div>
      ) : null}
    </>
  );
}

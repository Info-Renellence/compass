// The weekly 1-on-1 (handoff README section 2, screens 08-13): how last week went -> second look -> visits ->
// roleplay -> calls -> one focus -> done. No typing during the meeting: purposes and next steps come from the
// meeting notes afterwards. No "AI" wording, no "flagged", no counts of changed suggestions.
import { useEffect, useMemo, useState } from 'react';
import { data } from '../data/index.js';
import { GOALS, goalByKey, SKILLS, CHARACTERS, skillByKey, PICKS } from '../data/catalog.js';
import { Icon } from '../icons.jsx';
import { Banner, CardHead, Foot, Done, useToast } from '../ui.jsx';

const STEPS = ['Last week', 'Second look', 'Visits', 'Roleplay', 'Calls', 'Focus'];
const TITLES = ['How last week went', 'Second look', 'Visits this week', 'Quick roleplay', 'Calls this week', 'One focus'];
const MAX_VISITS = 15;
const GROUP_ORDER = { candidate: 0, onboarded: 1, fifty: 2, lead: 3 };
const GROUP_LABEL = { candidate: 'Candidate', onboarded: 'Onboarded', fifty: 'My Fifty', lead: 'Lead' };
const GROUP_KEYS = ['candidate', 'onboarded', 'fifty', 'lead'];
const AVATAR_TONES = ['background:#FDE7E7;color:#B42318', 'background:#FFF1D6;color:#8A5A00', 'background:#EAF3FC;color:#1170C0', 'background:#E6F4EA;color:#1E7B3C', 'background:#F1E8FB;color:#6B3FA0', 'background:#E8F4F7;color:#1D6F82'];
const css = (s) => Object.fromEntries(s.split(';').filter(Boolean).map((p) => { const [k, v] = p.split(':'); return [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]; }));

function fresh(d) {
  const month = skillByKey(d.roleplay.monthSkill) || SKILLS[0];
  return {
    step: 1, reached: 1, done: false,
    decision: {}, removed: {}, toVisit: {}, toCall: {},
    goal: null, target: 3,
    skill: month.key, character: month.character || 'skeptic', practiced: false, curve: false, swapped: false,
    commit: Object.fromEntries(d.commitments.map((c) => [c.key, !!c.on])),
  };
}

export default function Weekly({ repId }) {
  const [d, setD] = useState(null);
  useEffect(() => { data.weekly(repId).then(setD); }, [repId]);
  if (!d) return <div className="loading">Loading…</div>;
  return <Session d={d} repId={repId} />;
}

function Session({ d, repId }) {
  const flash = useToast();
  const [s, setS] = useState(() => fresh(d));
  const set = (patch) => setS((x) => Object.assign({}, x, typeof patch === 'function' ? patch(x) : patch));
  const rep = d.rep.first, boss = d.manager.first;
  const byId = useMemo(() => Object.fromEntries(d.accounts.map((a) => [a.id, a])), [d]);

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
    if (!okStep[s.step - 1]) { flash(s.step === 3 ? 'Cut visits to 15 or fewer' : 'Pick a focus first'); return; }
    if (s.step < 6) { goStep(s.step + 1); return; }
    const plan = {
      picks: d.accounts.map((a) => ({ id: a.id, finalPick: s.removed[a.id] ? 'wait' : finalPick(a) })),
      secondLook: d.secondLook.map((x) => ({ id: x.id, decision: s.decision[x.id] || null })),
      focus: { goal: goal.key, actionTarget: s.target },
      roleplay: { skill: s.skill, character: s.character, done: s.practiced },
    };
    data.saveWeekly(repId, plan).then(() => { set({ done: true }); flash('Sent to ' + rep + '’s Pulse'); });
  };
  const back = () => set((x) => ({ step: Math.max(1, x.step - 1) }));

  if (s.done) {
    return (
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
                  onClick={() => set((x) => ({ commit: Object.assign({}, x.commit, { [c.key]: !x.commit[c.key] }) }))}>
                  {on ? <Icon name="check" size={13} stroke={3} /> : null}{c.text}
                </button>
              );
            })}
          </div>
          <span className="foot-note">Anything else {boss} agrees to is picked up from the meeting notes.</span>
        </section>
      </Done>
    );
  }

  const subs = ['', 'A few picks worth talking through together.', 'Agree on each visit and why it matters.',
    'A five-minute break. Pick a skill and a character, then play it out.', 'A quick look. Turn any call into a visit.',
    'One goal, and the weekly action ' + rep + ' controls.'];

  return (
    <>
      <Banner kicker={'1-ON-1 · ' + d.session.dateLabel + ' · ' + d.session.minutes + ' MIN'} title={TITLES[s.step - 1]} sub={subs[s.step - 1]}
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
          if (visits.length >= MAX_VISITS) { flash('Visits are full: 15 a week'); return; }
          set((x) => ({ toVisit: Object.assign({}, x.toVisit, { [a.id]: true }), toCall: Object.assign({}, x.toCall, { [a.id]: false }) })); flash(a.name + ' moved to visits');
        }} /> : null}
      {s.step === 6 ? <Focus s={s} set={set} rep={rep} /> : null}
      <Foot onBack={s.step > 1 ? back : null} onNext={next} nextLabel={s.step === 6 ? 'Save the week' : 'Next'} blocked={!okStep[s.step - 1]} />
    </>
  );
}

function LastWeek({ d, rep }) {
  const f = d.lastFocus, g = goalByKey(f.goal), t = d.tiles;
  return (
    <>
      <section className="talk">
        <span className="ic"><Icon name="chat" size={20} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="k">{rep.toUpperCase()} WANTS TO TALK ABOUT</span>
          <span className="q">“{d.checkin.helpNote}”</span>
        </span>
      </section>
      <div className="wins">
        {d.wins.map((w) => (
          <span key={w.title} className="win">
            <span className="st"><Icon name="star5" size={15} stroke={2.2} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="t">{w.title}</span><span className="s">{w.sub}</span></span>
          </span>
        ))}
      </div>
      <div className="lw-grid">
        <section className="focus-hero">
          <span className="top"><span className="k">LAST WEEK’S FOCUS</span><span className="when">{f.setLabel} · counted from Pulse and orders</span></span>
          <span className="g">{g.name}</span>
          <div className="subs">
            <span className="sub"><span className="a">WEEKLY ACTION</span><span className="b">{f.actionDone} of {f.actionTarget}</span><span className="c">{g.action}</span></span>
            <span className="sub"><span className="a">RESULT</span><span className="b">{f.result}</span><span className="c">{g.result}{f.resultNote ? ' · ' + f.resultNote : ''}</span></span>
          </div>
        </section>
        <div className="lw-col">
          <section className="stat white"><span className="k">MY FIFTY</span><span className="v">{t.fifty.count}</span><span className="s">{t.fifty.note}</span></section>
          <section className="stat soft"><span className="k">FORECAST LANDED</span><span className="v">{t.forecastLanded.landed} of {t.forecastLanded.due}</span><span className="s">Due last week</span></section>
        </div>
        <div className="lw-col">
          <section className="stat soft"><span className="k">VISITS DONE</span><span className="v">{t.visits.done} of {t.visits.planned}</span><span className="s">Planned last Monday</span></section>
          <section className="stat white"><span className="k">CALLS DONE</span><span className="v">{t.calls.done} of {t.calls.planned}</span><span className="s">Planned last Monday</span></section>
        </div>
      </div>
      <div className="two">
        <section className="cc">
          <CardHead icon="pin" title="Missed visits" right={<span className="cnt">{d.missedVisits.length}</span>} />
          {d.missedVisits.map((m) => <div key={m.name} className="mrow"><span className="n">{m.name}</span></div>)}
        </section>
        <section className="cc">
          <CardHead icon="doc" title="Forecast changes" right={<span className="cnt green"><Icon name="check" size={13} stroke={2.6} />{d.checkin.submittedLabel}</span>} />
          <div className="fc-lines">
            {d.forecastChanges.map((c) => <span key={c.who}><b>{c.who}</b> {c.what} · {c.reason}</span>)}
          </div>
        </section>
      </div>
    </>
  );
}

function SecondLook({ d, byId, rep, decision, onDecide }) {
  return (
    <div className="sl-list">
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

function Visits({ visits, onRemove, onCall }) {
  const over = visits.length > MAX_VISITS;
  return (
    <section className="cc">
      <CardHead icon="pin" title="Visits this week" right={<span className={'right-strong' + (over ? ' over' : '')}>{visits.length} of {MAX_VISITS}</span>} />
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
                <button type="button" className="tocall" onClick={() => onCall(a)}><Icon name="call" size={12} stroke={2.4} />Make it a call</button></span></span>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => onRemove(a)}><Icon name="x" size={12} stroke={2.4} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Roleplay({ s, set, rep, boss, d, flash }) {
  const skill = skillByKey(s.skill), ch = CHARACTERS.find((c) => c.key === s.character);
  const tone = AVATAR_TONES[CHARACTERS.indexOf(ch) % AVATAR_TONES.length];
  const clinicPlayer = s.swapped ? boss : rep, repPlayer = s.swapped ? rep : boss;
  return (
    <>
      <section className="rp-pick">
        <div className="rp-row" role="radiogroup" aria-label="Skill">
          <span className="lab">SKILL</span>
          {SKILLS.filter((k) => !k.monthlyOnly).map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={s.skill === k.key} className={'rchip skill' + (s.skill === k.key ? ' on' : '')}
              onClick={() => set({ skill: k.key, character: k.character, practiced: false, curve: false })}>
              {k.name}{k.key === d.roleplay.noteSkill ? <span className="gdot" aria-label="from the Friday note" /> : null}
            </button>
          ))}
        </div>
        <div className="rp-row" role="radiogroup" aria-label="Character">
          <span className="lab">CHARACTER</span>
          {CHARACTERS.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={s.character === c.key} className={'rchip char' + (s.character === c.key ? ' on' : '')}
              onClick={() => set({ character: c.key, curve: false })}>
              {c.name}{c.key === d.roleplay.noteCharacter ? <span className="gdot" aria-label="from the Friday note" /> : null}
            </button>
          ))}
        </div>
        <span className="rp-legend"><span className="gdot" />From {rep}’s Friday note</span>
      </section>
      <section className="scene">
        <div className="lcol">
          <span className="prac">PRACTISING · {skill.name.toUpperCase()}</span>
          <span className="role">
            <span className="rav" style={css(tone)}>{ch.name.replace('The ', '').slice(0, 2).toUpperCase()}</span>
            <span className="tx"><span className="k">{clinicPlayer.toUpperCase()} PLAYS</span><span className="nm">{ch.name}</span><span className="wh">{ch.who}</span></span>
          </span>
          <span className="role">
            <span className="rav rep"><Icon name="person" size={16} stroke={2.2} /></span>
            <span className="tx"><span className="k">{repPlayer.toUpperCase()} PLAYS</span><span className="nm">The rep</span></span>
          </span>
        </div>
        <div className="rcol">
          <span className="bubble">{ch.line}</span>
          {s.curve ? <span className="curve"><span className="k">CURVEBALL</span><span className="t">{ch.curve}</span></span> : null}
          <div className="btns">
            {!s.curve ? <button type="button" className="sbtn curveb" onClick={() => set({ curve: true })}>Throw a curveball</button> : null}
            <button type="button" className="sbtn" onClick={() => { set((x) => ({ swapped: !x.swapped })); flash(s.swapped ? rep + ' plays the clinic again' : 'Roles swapped. ' + boss + ' plays the clinic'); }}>
              <Icon name="swap" size={13} stroke={2.2} />Swap roles
            </button>
            <button type="button" className={'sbtn done' + (s.practiced ? ' ok' : '')} aria-pressed={s.practiced} onClick={() => set((x) => ({ practiced: !x.practiced }))}>
              <Icon name="check" size={13} stroke={3} />{s.practiced ? 'Done' : 'Done, back to it'}
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
      <CardHead icon="call" title="Calls this week" right={<span className="right-strong">{calls.length} calls</span>} />
      <span className="cc-note" style={{ marginBottom: 0 }}>A quick look. Turn any call into a visit if it deserves one.</span>
      <div className="calls">
        {calls.map((a) => (
          <div key={a.id} className="callc">
            <span className="ava">{a.ini}</span>
            <span className="tx"><b>{a.name}</b><span>{a.purpose || a.suggestedReason}</span></span>
            <button type="button" className="tovisit" onClick={() => onVisit(a)}><Icon name="pin" size={12} stroke={2.4} />Make it a visit</button>
            <button type="button" className="xbtn" aria-label={'Remove ' + a.name} onClick={() => onRemove(a)}><Icon name="x" size={12} stroke={2.4} /></button>
          </div>
        ))}
      </div>
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
            <span className="top"><span className="nm">{x.name}</span>{s.goal === x.key ? <span className="tick"><Icon name="check" size={12} stroke={3} /></span> : null}</span>
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
              <button type="button" className="circ" aria-label="Less" onClick={() => set((x) => ({ target: Math.max(1, x.target - 1) }))}><Icon name="minus" size={16} stroke={2.6} /></button>
              <span className="num" aria-live="polite">{s.target}</span>
              <button type="button" className="circ plus" aria-label="More" onClick={() => set((x) => ({ target: Math.min(15, x.target + 1) }))}><Icon name="plus" size={16} stroke={2.6} /></button>
              <span className="act">{g.action}</span>
            </span>
          </span>
          <span className="r"><span className="k">RESULT WE TRACK</span><span className="v">{g.result}</span><span className="s">Counted from Pulse and orders</span></span>
        </div>
      ) : null}
    </>
  );
}

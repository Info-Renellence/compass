// The monthly 1-on-1 (handoff README section 3, screens 14-18): the first weekly 1-on-1 of each month becomes a
// 60-minute session. Last month against target -> next month's target and forecast -> a status for every My Fifty
// account -> growth and feedback -> done. Start from the target, build the forecast, close the gap together.
import { useEffect, useState } from 'react';
import { data, words } from '../data/index.js';
import { goalByKey, SKILLS, skillByKey, FIFTY_STATUS } from '../data/catalog.js';
import { Icon } from '../icons.jsx';
import { Banner, CardHead, Foot, Done, money, useToast } from '../ui.jsx';

const STEPS = ['Last month', 'Next month', 'My Fifty', 'Growth'];
const css = (s) => Object.fromEntries(s.split(';').filter(Boolean).map((p) => { const [k, v] = p.split(':'); return [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]; }));

const fresh = (d) => ({ step: 1, done: false, added: {}, status: Object.fromEntries(d.fifty.map((f) => [f.id, f.suggested])), skill: d.monthSkill });

export default function Monthly({ repId }) {
  const [d, setD] = useState(null);
  useEffect(() => { data.monthly(repId).then(setD); }, [repId]);
  if (!d) return <div className="loading">Loading…</div>;
  return <Session d={d} repId={repId} />;
}

function Session({ d, repId }) {
  const flash = useToast();
  const [s, setS] = useState(() => fresh(d));
  const set = (patch) => setS((x) => Object.assign({}, x, typeof patch === 'function' ? patch(x) : patch));
  const rep = d.rep.first, boss = d.manager.first, m = d.session;
  const nm = d.nextMonth;
  const base = nm.forecast.reduce((t, f) => t + f.amount, 0);
  const total = base + nm.gap.reduce((t, g) => t + (s.added[g.id] ? g.amount : 0), 0);
  const skill = skillByKey(s.skill);

  const next = () => {
    if (s.step < 4) { set({ step: s.step + 1 }); return; }
    const plan = { addedForecasts: nm.gap.filter((g) => s.added[g.id]).map((g) => g.id), fiftyStatus: d.fifty.map((f) => ({ id: f.id, status: s.status[f.id] })), skill: s.skill };
    data.saveMonthly(repId, plan).then(() => { set({ done: true }); flash(m.nextMonth + ' saved'); }, (e) => flash(words(e)));
  };

  if (s.done) {
    return (
      <Done wide title={m.nextMonth + ' is set'} line={(nm.target ? 'Target ' + money(nm.target) : 'No target set') + ' · ' + rep + ' forecasts ' + money(total) + ' · skill: ' + skill.name}>
        <div className="where c3">
          <section><span className="k">EDGE · FORECAST</span><span className="t">New {m.nextMonth} forecasts added</span></section>
          <section><span className="k">EDGE · CUSTOMERS</span><span className="t">My Fifty statuses saved</span></section>
          <section><span className="k">WEEKLY 1-ON-1s</span><span className="t">Skill of the month in roleplays</span></section>
        </div>
      </Done>
    );
  }

  const titles = ['How ' + m.lastMonth + ' went', m.nextMonth + ': target and forecast', 'My Fifty check', 'Growth and feedback'];
  const subs = ['Results against target, and why forecasts moved.', 'Start from the target, build the forecast, close the gap together.',
    'A quick status on every account in My Fifty.', 'One skill for the month, and a real conversation.'];

  return (
    <>
      <Banner kicker={'MONTHLY 1-ON-1 · ' + m.dateLabel + ' · ' + m.minutes + ' MIN'} title={titles[s.step - 1]} sub={subs[s.step - 1]}
        steps={STEPS} step={s.step} reached={4} onStep={(k) => set({ step: k })} />
      {s.step === 1 ? <LastMonth d={d} rep={rep} /> : null}
      {s.step === 2 ? <NextMonth d={d} rep={rep} base={base} total={total} added={s.added}
        onToggle={(g) => { const on = !s.added[g.id]; set((x) => ({ added: Object.assign({}, x.added, { [g.id]: on }) })); if (on) flash('Added to ' + m.nextMonth + ' · ' + g.name); }} /> : null}
      {s.step === 3 ? <FiftyCheck d={d} status={s.status} onPick={(id, v) => set((x) => ({ status: Object.assign({}, x.status, { [id]: v }) }))} /> : null}
      {s.step === 4 ? <Growth month={m.nextMonth} boss={boss} skill={s.skill} onSkill={(k) => set({ skill: k })} /> : null}
      <Foot onBack={s.step > 1 ? () => set({ step: s.step - 1 }) : null} onNext={next} nextLabel={s.step === 4 ? 'Save ' + m.nextMonth : 'Next'} />
    </>
  );
}

function LastMonth({ d, rep }) {
  const l = d.lastMonth, m = d.session;
  const pct = l.target ? Math.round(l.ordered / l.target * 100) : null;
  const short = (l.target || 0) - l.ordered;
  const max = Math.max(1, ...l.slipped.map((x) => x[1]));
  const hits = l.focusWeeks.filter((w) => w.done >= w.target).length;
  return (
    <>
      <div className="lw-grid">
        <section className="target-hero">
          <span className="k">{m.lastMonth.toUpperCase()} TARGET</span>
          {pct == null ? <span className="pct">{money(l.ordered)}<small> ordered · no target set</small></span>
            : <span className="pct">{pct}%<small> · {money(l.ordered)} of {money(l.target)}</small></span>}
          <span className="bar"><span style={{ width: Math.min(100, pct || 0) + '%' }} /></span>
          <span className="s">{pct == null ? '' : (short > 0 ? money(short) + ' short' : money(-short) + ' over')}{l.prevPercent != null ? ' · ' + m.prevMonth + ' was ' + l.prevPercent + '%' : ''}</span>
        </section>
        <section className="stat white"><span className="k">FORECAST ACCURACY</span><span className="v lg">{l.forecastAccuracy == null ? '—' : l.forecastAccuracy + '%'}</span><span className="s">{l.forecastAccuracy == null ? 'No forecast snapshot on ' + l.accuracyNote : 'Of what ' + rep + ' forecast on ' + l.accuracyNote + ', this much ordered'}</span></section>
        <section className="stat soft"><span className="k">MY FIFTY</span><span className="v lg">{l.fifty.count}</span><span className="s">{l.fifty.note}</span></section>
      </div>
      <div className="two">
        <section className="cc">
          <CardHead icon="forecast" title="Why forecasts slipped" right={<span className="right-note">From Friday check-ins</span>} />
          {l.slipped.map(([why, n]) => (
            <div key={why} className="slip"><span className="n">{why}</span><span className="hbar"><span style={{ width: (n / max * 100) + '%' }} /></span><span className="c">{n}</span></div>
          ))}
          {!l.slipped.length ? <span className="cc-note">No forecast changes from Friday check-ins</span> : null}
          {l.pattern ? <span className="pattern"><b>Pattern:</b> {l.pattern}</span> : null}
        </section>
        <section className="cc">
          <CardHead icon="star5" title="Weekly focus this month" right={<span className="right-note">Action hit {hits} of {l.focusWeeks.length} weeks</span>} />
          {!l.focusWeeks.length ? <span className="cc-note">No weekly focus was set</span> : null}
          {l.focusWeeks.map((w) => (
            <div key={w.week} className="wk"><span className="d">{w.week}</span><span className="g">{goalByKey(w.goal).name}</span>
              <span className={'hit' + (w.done >= w.target ? ' yes' : '')}>{w.done} of {w.target}</span></div>
          ))}
        </section>
      </div>
    </>
  );
}

function NextMonth({ d, rep, base, total, added, onToggle }) {
  const nm = d.nextMonth, m = d.session;
  const tgt = nm.target || 0;
  const gap = tgt - total;
  const pctOf = (v) => (tgt ? Math.round(v / tgt * 100) : 0);
  return (
    <>
      <section className="sum">
        <div className="nums">
          <span><span className="k">{m.nextMonth.toUpperCase()} TARGET</span><span className="v">{nm.target ? money(nm.target) : '—'}</span><span className="s">{nm.target ? 'Set by Renellence' : 'No target set yet'}</span></span>
          <span><span className="k blue">{rep.toUpperCase()}’S FORECAST</span><span className="v blue">{money(total)}</span><span className="s">{tgt ? pctOf(total) + '% of target' : ''}</span></span>
          <span className="gap"><span className="k">GAP</span><span className={'v' + (gap > 0 ? '' : ' green')}>{gap > 0 ? money(gap) : 'Covered'}</span><span className="s">{gap > 0 ? 'still to find' : money(-gap) + ' over target'}</span></span>
        </div>
        <span className="gbar" role="img" aria-label={pctOf(total) + '% of target'}><span style={{ width: (tgt ? Math.min(100, total / tgt * 100) : 0).toFixed(1) + '%' }} /></span>
      </section>
      <div className="nm-grid">
        <section className="cc">
          <CardHead icon="forecast" title="Already forecast" right={<span className="right-strong">{money(base)}</span>} />
          {nm.forecast.map((f) => (
            <div key={f.id} className="frow"><span className="ava">{f.ini}</span><span className="tx"><b>{f.name}</b><span>{f.why}</span></span><span className="amt">{money(f.amount)}</span></div>
          ))}
        </section>
        <section className="cc">
          <CardHead icon="sparkle" title="Could close the gap" right={<span className="right-note">Accounts with no {m.nextMonth} forecast yet</span>} />
          {nm.gap.map((g) => {
            const on = !!added[g.id];
            return (
              <div key={g.id} className={'grow-row' + (on ? ' on' : '')}>
                <span className="ava">{g.ini}</span><span className="tx"><b>{g.name}</b><span>{g.why}</span></span><span className="amt">{money(g.amount)}</span>
                <button type="button" className={'addb' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onToggle(g)}>
                  {on ? <><Icon name="check" size={12} stroke={3} />Added</> : '+ Add'}
                </button>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}

function FiftyCheck({ d, status, onPick }) {
  const n = (k) => d.fifty.filter((f) => status[f.id] === k).length;
  return (
    <>
      <div className="three">
        <section className="stat ring-g"><span className="k">ON TRACK</span><span className="v lg">{n('on_track')}</span><span className="s">Ordering on rhythm</span></section>
        <section className="stat ring-y"><span className="k">WATCH</span><span className="v lg">{n('watch')}</span><span className="s">Something to sort out</span></section>
        <section className="stat ring-r"><span className="k">AT RISK</span><span className="v lg">{n('at_risk')}</span><span className="s">Going cold</span></section>
      </div>
      <section className="cc">
        <CardHead icon="person" title="Every My Fifty account" right={<span className="right-note">Once a month, every account gets a status</span>} />
        {d.fifty.map((f) => (
          <div key={f.id} className="sw">
            <span className="who"><span className="ava">{f.ini}</span><span className="tx"><b>{f.name}</b></span></span>
            <span className="fact">{f.fact}</span>
            <span className="opts" role="radiogroup" aria-label={'Status for ' + f.name}>
              {FIFTY_STATUS.map((o) => {
                const on = status[f.id] === o.key;
                return (
                  <button key={o.key} type="button" role="radio" aria-checked={on} className="sopt"
                    style={on ? Object.assign(css(o.on), { border: 0, boxShadow: 'inset 0 0 0 1.5px ' + o.dot }) : undefined} onClick={() => onPick(f.id, o.key)}>
                    <span className="dot" style={{ background: o.dot }} />{o.label}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function Growth({ month, boss, skill, onSkill }) {
  return (
    <div className="gr-grid">
      <section className="cc">
        <CardHead icon="star5" title={'Skill for ' + month} right={<span className="right-note">Comes up first in weekly roleplays</span>} />
        <div className="mskills" role="radiogroup" aria-label={'Skill for ' + month}>
          {SKILLS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={skill === k.key} className={'mskill' + (skill === k.key ? ' on' : '')} onClick={() => onSkill(k.key)}>
              {k.name}{skill === k.key ? <span className="tick"><Icon name="check" size={12} stroke={3} /></span> : null}
            </button>
          ))}
        </div>
      </section>
      <div className="convo">
        <section className="qcard dark"><span className="k">GROWTH</span><span className="q">Where do you want to be in six months?</span></section>
        <section className="qcard"><span className="k">BLOCKERS</span><span className="q">What’s getting in your way right now?</span></section>
        <section className="qcard"><span className="k">FEEDBACK FOR {boss.toUpperCase()}</span><span className="q">What’s one thing {boss} could do better for you?</span></section>
        <span className="hint">Talk it through. The meeting notes capture the answers.</span>
      </div>
    </div>
  );
}

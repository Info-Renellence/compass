// The Suggestions tab (owner 2026-10-28): what Claude's timed jobs proposed, for the manager to accept or reject.
// Three short sections: New leads (tidy-ups), Details found (web enrichment) and Data check (weekly). Nothing changes
// on a real record until Accept. Only first name, last name, role and designation are applied for you; anything
// else is "do this by hand" (accepting only records that it is done; duplicates are merged in Edge's existing merge).
import { useEffect, useState } from 'react';
import { data, words } from '../data/index.js';
import { CardHead, Empty, ErrorCard, Skeleton, useToast } from '../ui.jsx';

const isDuplicate = (field) => /duplicate|merge/i.test(field || '');
const link = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

export default function Suggestions() {
  const flash = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  // key "<row id>:<index>" -> what happened to it on this screen: { decision, applied, byHand, field }.
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState('');
  const load = () => { setErr(''); setD(null); data.suggestions().then(setD, (e) => setErr(words(e))); };
  useEffect(load, []);
  if (err) return <ErrorCard text={err} onRetry={load} />;
  if (!d) return <Skeleton />;

  const decide = (id, index, decision, field) => {
    const k = id + ':' + index;
    if (busy) return;
    setBusy(k);
    data.decideSuggestion(id, index, decision).then((r) => {
      setDone((x) => Object.assign({}, x, { [k]: { decision, applied: r.applied, byHand: r.byHand, field } }));
      flash(decision === 'reject' ? 'Rejected' : r.applied ? 'Accepted and saved' : 'Accepted. Do this by hand', decision === 'reject' || r.applied ? 'ok' : 'warn');
    }, (e) => flash(words(e), 'error')).then(() => setBusy(''));
  };
  const state = (id, index, field) => {
    const r = done[id + ':' + index];
    if (!r) return null;
    return (
      <span className={'sg-state' + (r.byHand ? ' hand' : '')}>
        {r.decision === 'reject' ? 'Rejected' : r.applied ? 'Accepted and saved' : isDuplicate(field) ? 'Accepted. Do this by hand: use the merge in Edge' : 'Accepted. Do this by hand'}
      </span>
    );
  };
  const buttons = (id, index, field, auto) => (done[id + ':' + index] ? state(id, index, field) : (
    <span className="sg-btns">
      {!auto ? <span className="sg-hint">Accept = done by hand</span> : null}
      <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => decide(id, index, 'accept', field)}>Accept</button>
      <button type="button" className="btn sm" disabled={!!busy} onClick={() => decide(id, index, 'reject', field)}>Reject</button>
    </span>
  ));
  const conf = (c) => (c ? <span className={'sg-conf ' + c}>{c}</span> : null);

  const section = (kind, title, icon, note) => {
    const cards = d.cards.filter((c) => c.kind === kind);
    return (
      <section className="cc sg" key={kind}>
        <CardHead icon={icon} title={title} right={<span className="right-note">{note}</span>} />
        {!cards.length ? <Empty icon="check" text="Nothing to review" /> : null}
        {cards.map((c) => (
          <div key={c.id} className="sg-card">
            <div className="sg-who"><span className="ava">{c.ini}</span><span className="tx"><b>{c.name}</b><span>{[c.clinic, c.owner && 'Owner ' + c.owner].filter(Boolean).join(' · ')}</span></span></div>
            {c.items.map((it) => (
              <div key={it.index} className="sg-item">
                <span className="tx">
                  <span><b>{it.field}</b>{kind === 'lead_cleanup' ? <>: {it.current ? <s>{String(it.current)}</s> : <i>empty</i>} to <b>{String(it.proposed)}</b></> : <>: <b>{String(it.proposed)}</b></>} {conf(it.confidence)}</span>
                  {it.reason ? <span className="why">{it.reason}</span> : null}
                  {link(it.source) ? <a className="why" href={link(it.source)} target="_blank" rel="noopener noreferrer">Source</a> : null}
                </span>
                {buttons(c.id, it.index, it.field, it.auto)}
              </div>
            ))}
          </div>
        ))}
      </section>
    );
  };

  const h = d.health;
  return (
    <>
      {section('lead_cleanup', 'New leads', 'sparkle', 'Tidy-ups Claude suggests for new ad leads')}
      {section('enrichment', 'Details found', 'search', 'Found on the web, with the source')}
      <section className="cc sg">
        <CardHead icon="alert" title="Data check" right={<span className="right-note">{h && h.summary ? h.summary : 'Weekly check'}</span>} />
        {!h || !h.items.length ? <Empty icon="check" text="Nothing to review" /> : null}
        {h ? h.items.map((it) => (
          <div key={it.index} className="sg-card">
            <div className="sg-item">
              <span className="tx">
                <span><b>{it.fix || it.code}</b> {conf(it.confidence)}{it.problem === 'unsure' ? <span className="sg-conf low">not sure</span> : null}</span>
                {it.reason ? <span className="why">{it.reason}</span> : null}
                {it.who.length ? <span className="why">{it.who.join(', ')}</span> : null}
              </span>
              {buttons(h.id, it.index, it.code, false)}
            </div>
          </div>
        )) : null}
      </section>
    </>
  );
}

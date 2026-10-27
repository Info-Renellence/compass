// Cat's second-look list (Yousef 2026-10-27). The second look is no longer part of the weekly 1-on-1 (the rep's own
// picks stand; no micromanaging), but every account where the rep's Friday pick differed from the suggestion is kept
// here for the manager: the last 8 weeks, newest first, with what happened since (ordered or not). Read only.
import { useEffect, useState } from 'react';
import { data, words } from '../data/index.js';
import { PICKS } from '../data/catalog.js';
import { CardHead, Empty, ErrorCard, Skeleton } from '../ui.jsx';

const GROUP_LABEL = { candidate: 'Candidate', onboarded: 'Onboarded', fifty: 'My Fifty', lead: 'Lead' };

export default function SecondLook({ repId }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => { setErr(''); setD(null); data.secondLookList(repId).then(setD, (e) => setErr(words(e))); };
  useEffect(load, [repId]);
  if (err) return <ErrorCard text={err} onRetry={load} />;
  if (!d) return <Skeleton />;
  const ordered = d.rows.filter((r) => r.outcome.ordered).length;
  return (
    <section className="cc sl2">
      <CardHead icon="sparkle" title={d.rep.first + '’s picks that differed from the suggestion'}
        right={d.rows.length ? <span className="right-note">{ordered} of {d.rows.length} ordered since</span> : null} />
      <span className="cc-note">For you only, not part of the 1-on-1. The last {d.weeks} weeks of Friday check-ins.</span>
      {!d.rows.length ? <Empty icon="check" text="Every pick matched the suggestion." /> : null}
      {d.rows.map((r) => (
        <div key={r.id} className="sl2-row">
          <span className="ava">{r.ini}</span>
          <span className="tx"><b>{r.name}</b><span>{r.fact}</span></span>
          <span className={'gpill ' + r.group}>{GROUP_LABEL[r.group] || r.group}</span>
          <span className="sl2-picks"><span className="k">WEEK OF {r.week.toUpperCase()}</span>
            <span>{d.rep.first}: <b>{PICKS[r.repPick]}</b> · suggested {PICKS[r.suggestedPick]}</span></span>
          <span className={'sl2-out' + (r.outcome.ordered ? ' yes' : '')}>{r.outcome.text}</span>
        </div>
      ))}
    </section>
  );
}

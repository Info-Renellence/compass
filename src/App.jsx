// The Compass shell: the app bar (logo, Compass, Weekly · Monthly, and the rep this 1-on-1 is with) and the two
// sessions. Compass is run by the manager (an admin) with one rep at a time, so the person menu picks the rep.
// The rep's Friday check-in is summarised inside the weekly step 1, not as its own tab (handoff README section 2).
import { useEffect, useState } from 'react';
import { data, isSample } from './data/index.js';
import { Icon } from './icons.jsx';
import { ToastHost } from './ui.jsx';
import Weekly from './weekly/Weekly.jsx';
import Monthly from './monthly/Monthly.jsx';

const viewFromHash = () => (/monthly/.test(window.location.hash) ? 'monthly' : 'weekly');

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [sess, setSess] = useState(null);
  const [repId, setRepId] = useState(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => { data.session().then((s) => { setSess(s); setRepId(s.reps[0] && s.reps[0].id); }); }, []);
  useEffect(() => {
    const on = () => setView(viewFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!e.target.closest('.cx-who')) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const go = (v) => { window.location.hash = '#/' + v; setView(v); };
  const rep = sess && sess.reps.find((r) => r.id === repId);

  return (
    <ToastHost>
      <div className="cx">
        <header className="cx-bar">
          <img className="logo" src="/logo.png" alt="Renellence" />
          <span className="sep" aria-hidden="true" />
          <span className="cx-brand"><span className="mark"><Icon name="compass" size={16} stroke={2.2} /></span>Compass</span>
          <span id="cx-session" className="cx-session-slot" />
          <span style={{ flex: 1 }} />
          <nav style={{ display: 'flex', gap: 18 }} aria-label="Sessions">
            <button type="button" className={'cx-tab' + (view === 'weekly' ? ' on' : '')} aria-current={view === 'weekly' ? 'page' : undefined} onClick={() => go('weekly')}>Weekly</button>
            <button type="button" className={'cx-tab' + (view === 'monthly' ? ' on' : '')} aria-current={view === 'monthly' ? 'page' : undefined} onClick={() => go('monthly')}>Monthly</button>
          </nav>
          {rep ? (
            <div className="cx-who">
              <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <span className="ava">{rep.ini}</span>{rep.first}
              </button>
              {menu ? (
                <div className="cx-menu" role="menu">
                  <div className="lbl">1-ON-1 WITH</div>
                  {sess.reps.map((r) => (
                    <button key={r.id} type="button" role="menuitemradio" aria-checked={r.id === repId} className={r.id === repId ? 'on' : ''}
                      onClick={() => { setRepId(r.id); setMenu(false); }}>
                      <span className="ava" style={{ width: 26, height: 26, fontSize: 10 }}>{r.ini}</span>{r.first} {r.last}
                    </button>
                  ))}
                  {isSample ? <div className="lbl" style={{ paddingTop: 10 }}><span className="cx-sample">Sample data · nothing is saved</span></div> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </header>
        <main className="cx-main">
          {!repId ? <div className="loading">Loading…</div>
            : view === 'monthly' ? <Monthly key={'m' + repId} repId={repId} /> : <Weekly key={'w' + repId} repId={repId} />}
        </main>
      </div>
    </ToastHost>
  );
}

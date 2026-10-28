// The Compass shell: the app bar (logo, Compass, Weekly · Monthly, and the rep this 1-on-1 is with) and the two
// sessions. Compass is run by the manager (an admin) with one rep at a time, so the person menu picks the rep.
// The rep's Friday check-in is summarised inside the weekly step 1, not as its own tab (handoff README section 2).
import { useEffect, useRef, useState } from 'react';
import { data, isSample, words } from './data/index.js';
import { Icon } from './icons.jsx';
import { Skeleton, ToastHost } from './ui.jsx';
import Weekly from './weekly/Weekly.jsx';
import Monthly from './monthly/Monthly.jsx';
import SecondLook from './weekly/SecondLook.jsx';
import Suggestions from './suggestions/Suggestions.jsx';

// Weekly, Monthly, (2026-10-27) Second look: the manager's own list of picks that differed from the suggestion, and
// (owner 2026-10-28) Suggestions: what Claude's timed jobs proposed, to accept or reject.
const viewFromHash = () => (/monthly/.test(window.location.hash) ? 'monthly' : /second-look/.test(window.location.hash) ? 'second-look' : /suggestions/.test(window.location.hash) ? 'suggestions' : 'weekly');

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [sess, setSess] = useState(null);
  const [repId, setRepId] = useState(null);
  const [menu, setMenu] = useState(false);

  // 'checking' -> 'in', or 'signed_out' (the Google button), or 'refused' (signed in but not an admin).
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const load = () => data.session().then((s) => { setSess(s); setRepId((r) => r || (s.reps[0] && s.reps[0].id)); setStatus('in'); },
    (e) => { if (e && e.status === 401) setStatus('signed_out'); else { setError(words(e)); setStatus('refused'); } });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const out = () => setStatus('signed_out');
    window.addEventListener('compass:signed-out', out);
    return () => window.removeEventListener('compass:signed-out', out);
  }, []);
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

  if (status === 'signed_out' || status === 'refused') {
    return <SignIn error={error} refused={status === 'refused'} onIn={() => { setError(''); setStatus('checking'); load(); }} onError={setError} />;
  }

  const go = (v) => { window.location.hash = '#/' + v; setView(v); };
  const rep = sess && sess.reps.find((r) => r.id === repId);

  return (
    <ToastHost>
      <div className="cx">
        <header className="cx-bar">
          <img className="logo" src="/logo.png" alt="Renellence" />
          <span className="sep" aria-hidden="true" />
          <span className="cx-brand"><span className="mark"><Icon name="compass" size={16} /></span>Compass</span>
          <span id="cx-session" className="cx-session-slot" />
          <span style={{ flex: 1 }} />
          <nav style={{ display: 'flex', gap: 18 }} aria-label="Sessions">
            <button type="button" className={'cx-tab' + (view === 'weekly' ? ' on' : '')} aria-current={view === 'weekly' ? 'page' : undefined} onClick={() => go('weekly')}>Weekly</button>
            <button type="button" className={'cx-tab' + (view === 'monthly' ? ' on' : '')} aria-current={view === 'monthly' ? 'page' : undefined} onClick={() => go('monthly')}>Monthly</button>
            <button type="button" className={'cx-tab' + (view === 'second-look' ? ' on' : '')} aria-current={view === 'second-look' ? 'page' : undefined} onClick={() => go('second-look')}>Second look</button>
            <button type="button" className={'cx-tab' + (view === 'suggestions' ? ' on' : '')} aria-current={view === 'suggestions' ? 'page' : undefined} onClick={() => go('suggestions')}>Suggestions</button>
          </nav>
          {rep ? (
            <div className="cx-who">
              <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <span className="ava">{rep.ini}</span>{rep.first}<Icon name="chevronDown" size={14} className="chev" />
              </button>
              {/* Always mounted so it can fade out; hidden (and out of the tab order) while closed. */}
              <div className={'cx-menu' + (menu ? ' open' : '')} role="menu" aria-hidden={!menu || undefined}>
                <div className="lbl">1-ON-1 WITH</div>
                {sess.reps.map((r) => (
                  <button key={r.id} type="button" role="menuitemradio" aria-checked={r.id === repId} className={r.id === repId ? 'on' : ''}
                    onClick={() => { setRepId(r.id); setMenu(false); }}>
                    <span className="ava">{r.ini}</span>{r.first} {r.last}
                  </button>
                ))}
                {!isSample ? <button type="button" role="menuitem" onClick={() => { data.signOut(); if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); window.location.href = '/'; }}>Sign out</button> : null}
                {isSample ? <div className="lbl sample-row"><span className="cx-sample">Sample data · nothing is saved</span></div> : null}
              </div>
            </div>
          ) : <span className="cx-who-skel" aria-hidden="true"><span className="skel c" /><span className="skel b" /></span>}
        </header>
        <main className="cx-main">
          {!repId ? <Skeleton />
            : view === 'monthly' ? <Monthly key={'m' + repId} repId={repId} /> : view === 'second-look' ? <SecondLook key={'s' + repId} repId={repId} /> : view === 'suggestions' ? <Suggestions /> : <Weekly key={'w' + repId} repId={repId} />}
        </main>
      </div>
    </ToastHost>
  );
}

// Google sign-in (Edge's client and button, web/src/App.jsx SignIn): the credential is traded for a Compass session.
function SignIn({ error, refused, onIn, onError }) {
  const btn = useRef(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let tries = 0;
    const start = (clientId) => {
      if (!window.google || !window.google.accounts) { if (tries++ < 50) setTimeout(() => start(clientId), 150); return; }
      window.google.accounts.id.initialize({ client_id: clientId, hd: 'renellence.com', auto_select: !refused,
        callback: (r) => data.signIn(r.credential).then(onIn, (e) => { onError(words(e)); setMsg(words(e)); }) });
      if (btn.current) window.google.accounts.id.renderButton(btn.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
    };
    if (!document.getElementById('gsi')) {
      const sc = document.createElement('script');
      sc.id = 'gsi'; sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
      document.head.appendChild(sc);
    }
    data.config().then((c) => (c.googleClientId ? start(c.googleClientId) : setMsg('Sign-in isn’t set up on this deployment.')), () => setMsg('Compass can’t be reached right now.'));
  }, []);
  const shown = error || msg;
  return (
    <div className="cx signin-page">
      <main className="signin-card">
        <img className="logo" src="/logo.png" alt="Renellence" />
        <span className="signin-brand"><span className="mark"><Icon name="compass" size={20} /></span><h1>Compass</h1></span>
        <span className="signin-sub">Sign in with your Renellence Google account.</span>
        <div ref={btn} />
        {shown ? <span role="alert" className="signin-err"><Icon name="alert" size={16} />{shown}</span> : null}
      </main>
    </div>
  );
}

// Shared pieces: the banner with its stepper, card headers, footer buttons, the toast, the session line, and the
// empty, error and loading (skeleton) states.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';

export const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');

// The light-blue banner: the step title (an optional kicker and subtitle), an optional centre piece, and the stepper
// in a white pill. A step is reachable once the session has got that far (`reached`), like the handoff's prototype.
export function Banner({ kicker, title, sub, center, steps, step, reached, onStep }) {
  return (
    <div className={'banner' + (center ? ' has-center' : '')}>
      <span className="glow" aria-hidden="true" />
      <div className="txt">
        {kicker ? <span className="kicker">{kicker}</span> : null}
        <h1 className="title">{title}</h1>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      {center ? <div className="bcenter">{center}</div> : null}
      <nav className="stepper" aria-label="Steps">
        {steps.map((label, i) => {
          const k = i + 1, on = k === step, done = k < step;
          return (
            <button key={label} type="button" className={on ? 'on' : done ? 'done' : ''} aria-current={on ? 'step' : undefined}
              disabled={k > reached} onClick={() => onStep(k)}>
              <span className="n">{done ? <Icon name="check" size={14} /> : k}</span>{label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Card header: a 36px icon tile and the h2. `lite` drops the tile and steps the title down (used where the banner
// already says the same thing).
export function CardHead({ icon, title, right, lite }) {
  return (
    <div className={'cc-head' + (lite ? ' lite' : '')}>
      <span className="l">{lite ? null : <span className="itile"><Icon name={icon} size={18} /></span>}<h2>{title}</h2></span>
      {right}
    </div>
  );
}

export function Foot({ onBack, onNext, nextLabel = 'Next', blocked, hint }) {
  return (
    <div className="foot">
      {onBack ? <button type="button" className="btn" onClick={onBack}>Back</button> : <span />}
      <span className="foot-r">
        {blocked && hint ? <span className="foot-hint">{hint}</span> : null}
        <button type="button" className={'btn next' + (blocked ? ' blocked' : '')} onClick={onNext} aria-disabled={blocked || undefined}>
          {nextLabel}<Icon name="chevronRight" size={16} />
        </button>
      </span>
    </div>
  );
}

export function Done({ wide, title, line, children }) {
  return (
    <div className={'done-page' + (wide ? ' wide' : '')}>
      <span className="halo"><span><Icon name="check" size={28} /></span></span>
      <h1>{title}</h1>
      <span className="line">{line}</span>
      {children}
    </div>
  );
}

// One empty state for every "None" / "No …" line: a small tint icon tile and a muted line, aligned with row content.
export function Empty({ icon = 'check', text, children }) {
  return (
    <div className="empty">
      <span className="eic" aria-hidden="true"><Icon name={icon} size={14} /></span>
      <span className="et">{text}</span>
      {children}
    </div>
  );
}

// A read that failed: the plain-words message and a Try again button, in a normal card.
export function ErrorCard({ text, onRetry }) {
  return (
    <section className="cc err-card" role="alert">
      <Empty icon="alert" text={text}>
        <button type="button" className="btn sm" onClick={onRetry}>Try again</button>
      </Empty>
    </section>
  );
}

// Loading: the shape of a session (banner with the stepper, three stat tiles, a list card), not a blank page.
export function Skeleton() {
  return (
    <div className="skel-page" aria-busy="true" aria-label="Loading">
      <div className="skel-banner"><span className="skel b-title" /><span className="skel b-step" /></div>
      <div className="skel-three">{[0, 1, 2].map((i) => <span key={i} className="skel skel-tile" />)}</div>
      <section className="cc skel-list">
        <span className="skel l-head" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="skel-row"><span className="skel l-ava" /><span className="l-lines"><span className="skel l-1" /><span className="skel l-2" /></span></span>
        ))}
      </section>
    </div>
  );
}

// The session line, shown in the app bar's slot next to "Compass" (weekly and monthly, also on the done screens).
export function SessionLine({ text }) {
  const [slot, setSlot] = useState(null);
  useEffect(() => { setSlot(document.getElementById('cx-session')); }, []);
  return slot ? createPortal(<span className="cx-session"><Icon name="events" size={14} />{text}</span>, slot) : null;
}
export const titleCase = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

// The toast: flash(message, tone). Tones: 'ok' (green check), 'warn' (amber alert), 'error' (red alert).
// flash('') clears it (the screens clear it when the step changes).
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [toast, setToast] = useState({ msg: '', tone: 'ok', id: 0, leaving: false });
  const t = useRef(null);
  // Each message gets its own id (so a new one replays the enter motion); after 2.6 s it plays its 150ms exit, then goes.
  const flash = useCallback((m, tone = 'ok') => {
    setToast((x) => ({ msg: m, tone, id: x.id + 1, leaving: false }));
    clearTimeout(t.current);
    if (m) {
      t.current = setTimeout(() => {
        setToast((x) => Object.assign({}, x, { leaving: true }));
        t.current = setTimeout(() => setToast((x) => Object.assign({}, x, { msg: '', leaving: false })), 150);
      }, 2600);
    }
  }, []);
  const { msg, tone, id, leaving } = toast;
  return (
    <ToastCtx.Provider value={flash}>
      {children}
      {msg ? (
        <div key={id} className={'cx-toast ' + tone + (leaving ? ' leaving' : '')} role={tone === 'ok' ? 'status' : 'alert'}>
          <span className="tic"><Icon name={tone === 'ok' ? 'check' : 'alert'} size={14} /></span>{msg}
        </div>
      ) : null}
    </ToastCtx.Provider>
  );
}

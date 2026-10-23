// Shared pieces: the banner with its stepper, card headers, footer buttons and the toast.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

export const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');

// The light-blue banner: small caps kicker, the step title, a one-line subtitle, and the stepper in a white pill.
// A step is reachable once the session has got that far (`reached`), like the handoff's prototype.
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
              <span className="n">{done ? <Icon name="check" size={14} stroke={3} /> : k}</span>{label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function CardHead({ icon, title, right }) {
  return (
    <div className="cc-head">
      <span className="l"><span className="itile"><Icon name={icon} size={18} /></span><h2>{title}</h2></span>
      {right}
    </div>
  );
}

export function Foot({ onBack, onNext, nextLabel = 'Next', blocked }) {
  return (
    <div className="foot">
      {onBack ? <button type="button" className="btn" onClick={onBack}>Back</button> : <span />}
      <button type="button" className={'btn next' + (blocked ? ' blocked' : '')} onClick={onNext} aria-disabled={blocked || undefined}>
        {nextLabel}<Icon name="chevronRight" size={16} stroke={2.6} />
      </button>
    </div>
  );
}

export function Done({ wide, title, line, children }) {
  return (
    <div className={'done-page' + (wide ? ' wide' : '')}>
      <span className="halo"><span><Icon name="check" size={28} stroke={3} /></span></span>
      <h1>{title}</h1>
      <span className="line">{line}</span>
      {children}
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [msg, setMsg] = useState('');
  const t = useRef(null);
  const flash = useCallback((m) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={flash}>
      {children}
      {msg ? <div className="cx-toast" role="status"><span className="ok"><Icon name="check" size={14} stroke={3} /></span>{msg}</div> : null}
    </ToastCtx.Provider>
  );
}

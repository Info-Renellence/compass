// Line icons in the demo's style (24px grid, 2px round strokes). Paths for the menu are the demo's own.
const P = {
  home: ['M3 11l9-7 9 7v9h-6v-6H9v6H3z'],
  forecast: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  customers: ['circle:12,8,4', 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
  events: ['rect:3,5,18,16,2', 'M3 10h18M8 3v4M16 3v4'],
  requests: ['M3 13l3-8h12l3 8v6H3z', 'M3 13h5l1 3h6l1-3h5'],
  expenses: ['rect:3,6,18,13,2', 'M3 10h18M7 15h4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  alert: ['circle:12,12,9', 'M12 8v5M12 16.5v.5'],
  clock: ['circle:12,12,9', 'M12 7v5l3 2'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  x: ['M6 6l12 12M18 6L6 18'],
  search: ['circle:11,11,7', 'M20 20l-3.5-3.5'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2'],
  message: ['M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z'],
  mail: ['rect:3,5,18,14,2', 'M3 7l9 6 9-6'],
  cart: ['circle:9,20,1.5', 'circle:18,20,1.5', 'M3 4h2l2.4 11.2a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6'],
  visit: ['M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z', 'circle:12,9.5,2.5'],
  note: ['M5 4h11l3 3v13H5z', 'M9 10h6M9 14h6'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  upload: ['M12 16V4M7 9l5-5 5 5', 'M4 16v4h16v-4'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  truck: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'circle:7,18,2', 'circle:17,18,2'],
  building: ['rect:4,3,16,18,1', 'M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4'],
  external: ['M14 4h6v6M20 4l-9 9', 'M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  syringe: ['M18 2l4 4M17 7l-9 9-4 1 1-4 9-9z', 'M14 4l6 6M7 13l4 4'],
  needle: ['M4 20l8-8M14 4l6 6-8 8-6-6z'],
  drop: ['M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z'],
  arrowLeft: ['M19 12H5M11 6l-6 6 6 6'],
  download: ['M12 4v12M7 11l5 5 5-5', 'M5 20h14'],
  image: ['rect:3,5,18,14,2', 'circle:9,10,1.5', 'M21 16l-5-5-8 8'],
  fileSign: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 16c1.5-2 2.5-2 3 0s1.5 1.5 3-.5'],
  fileMd: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M12 11v6M9 14h6'],
  pen: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  globe: ['circle:12,12,9', 'M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18'],
  flame: ['M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-.5-4 1-7z'],
  box: ['M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z', 'M3 7.5l9 4.5 9-4.5M12 12v9'],
  target: ['circle:12,12,9', 'circle:12,12,5', 'circle:12,12,1'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  funnel: ['M3 5h18l-7 8v6l-4 2v-8z'],
  users: ['circle:9,8,3.5', 'M2 20c0-3.6 3-6 7-6s7 2.4 7 6', 'M16 4.5a3.5 3.5 0 010 7M18 14c2.4.6 4 2.6 4 6'],
  // Compass additions (from the weekly-loop handoff's screens).
  compass: ['circle:12,12,9', 'M15.5 8.5l-2 5-5 2 2-5z'],
  chat: ['M4 5h16v11H8l-4 4z'],
  doc: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 13h6M9 17h4'],
  pin: ['M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z', 'circle:12,9,2.5'],
  call: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'],
  star5: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'],
  person: ['circle:12,8,4', 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
  sparkle: ['M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z', 'M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  swap: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'],
};

// One stroke width for the whole set: 2, and 2.5 only for small check/chevron glyphs (14px and below), which sit inside
// filled circles and buttons (UI polish 2026-10-23).
export function Icon({ name, size = 17, className, style, title }) {
  const parts = P[name] || [];
  const stroke = size <= 14 && /^(check|chevron)/.test(name) ? 2.5 : 2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} className={className} style={style}>
      {title ? <title>{title}</title> : null}
      {parts.map((d, i) => {
        if (d.startsWith('circle:')) { const [cx, cy, r] = d.slice(7).split(','); return <circle key={i} cx={cx} cy={cy} r={r} />; }
        if (d.startsWith('rect:')) { const [x, y, w, h, rx] = d.slice(5).split(','); return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />; }
        return <path key={i} d={d} />;
      })}
    </svg>
  );
}

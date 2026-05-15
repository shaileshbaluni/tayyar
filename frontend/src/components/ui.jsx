import React from 'react';

export const Icon = ({ name, size = 18, stroke = 1.6, style }) => {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></>,
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></>,
    micOff: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M1 1l22 22"/></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v16"/></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16z"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M9.5 14.5c.5 1 1.5 1.5 2.5 1.5s2.5-.5 2.5-2-1.5-2-2.5-2-2.5-.5-2.5-2 1.5-2 2.5-2 2 .5 2.5 1.5"/><path d="M12 6v2M12 16v2"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20a4.5 4.5 0 0 1 6 0"/></>,
    link: <><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    play: <><path d="M6 4l14 8-14 8z"/></>,
    pause: <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
    stop: <><rect x="5" y="5" width="14" height="14" rx="2"/></>,
    arrow: <><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></>,
    arrowL: <><path d="M19 12H5"/><path d="M11 5l-7 7 7 7"/></>,
    check: <><path d="M5 13l4 4L19 7"/></>,
    x: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    flame: <><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></>,
    video: <><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/></>,
    videoOff: <><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/><path d="M1 1l22 22"/></>,
    move: <><path d="M12 5v3M12 16v3M5 12h3M16 12h3"/><path d="M8 8l4-4 4 4M8 16l4 4 4-4"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.8 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    award: <><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chevR: <><path d="M9 6l6 6-6 6"/></>,
    chevD: <><path d="M6 9l6 6 6-6"/></>,
    upload: <><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    lang: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    arrowR: <><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></>,
    eyeOff: <><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19C5.5 19 2 12 2 12a18.4 18.4 0 0 1 5.1-5.9M9.9 4.2A8 8 0 0 1 12 4c6.5 0 10 7 10 7a18.4 18.4 0 0 1-2 3.1"/><path d="M1 1l22 22"/><circle cx="12" cy="12" r="3"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></>,
    work: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></>,
    code: <><path d="M8 18l-6-6 6-6"/><path d="M16 6l6 6-6 6"/></>,
    badge: <><path d="M12 2L3 7v5c0 5.3 3.8 10.3 9 11.5 5.2-1.2 9-6.2 9-11.5V7l-9-5z"/><path d="M9 12l2 2 4-4"/></>,
    star: <><path d="M12 2l3 6.2 6.8 1-4.9 4.8 1.1 6.8L12 17.8 5.9 20.8 7 14 2.2 9.2 9 8.2z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths[name] || null}
    </svg>
  );
};

export const Logo = ({ size = 22, withWord = true }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--ink)"/>
      <path d="M11 22 L11 13 M16 22 L16 9 M21 22 L21 16" stroke="#F4EFE6" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="21" cy="11" r="2" fill="var(--accent-2)"/>
    </svg>
    {withWord && (
      <span className="display" style={{ fontSize:18, fontWeight:600, letterSpacing:"-0.02em" }}>
        tayyar<span style={{ color:"var(--accent)" }}>.</span>
      </span>
    )}
  </span>
);

export const Donut = ({ value = 72, size = 96, stroke = 9, color = "var(--ink)", track = "var(--line)", label, sub }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value/100);
  return (
    <div style={{ position:"relative", width:size, height:size }}>
      <svg width={size} height={size} className="ring">
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"/>
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center"
      }}>
        <div className="display" style={{ fontSize: size*0.32, fontWeight:600 }}>{label ?? value}</div>
        {sub && <div style={{ fontSize:10, color:"var(--ink-3)", marginTop:-2 }}>{sub}</div>}
      </div>
    </div>
  );
};

export const Bar = ({ value, max = 100, color = "var(--ink)", height = 6 }) => (
  <div className="pbar" style={{ height }}>
    <i style={{ width: `${Math.max(0,Math.min(100,(value/max)*100))}%`, background: color }}/>
  </div>
);

export const Avatar = ({ name = "Rahul", color = "var(--accent)", size = 32 }) => {
  const initials = name.split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
  return (
    <span style={{
      width:size, height:size, borderRadius:999, background: color, color:"#FFF6E9",
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      fontSize: size*0.4, fontWeight:600, fontFamily:"var(--f-display)"
    }}>{initials}</span>
  );
};

export const Spark = ({ data, w = 120, h = 30, color = "var(--ink)", fill = false }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => [(i/(data.length-1))*w, h - ((v-min)/range)*h]);
  const d = pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dFill = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display:"block" }}>
      {fill && <path d={dFill} fill={color} opacity="0.10"/>}
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

export const CompanyMark = ({ name, color, size = 36 }) => {
  const init = name[0];
  return (
    <span style={{
      width:size, height:size, borderRadius:8, background: color || "var(--ink)",
      color:"#FFF6E9", display:"inline-flex", alignItems:"center", justifyContent:"center",
      fontFamily:"var(--f-display)", fontWeight:600, fontSize: size*0.45, flexShrink:0
    }}>{init}</span>
  );
};

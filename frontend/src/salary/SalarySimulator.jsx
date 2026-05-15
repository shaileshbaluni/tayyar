import React, { useState, useEffect, useRef } from 'react';
import { Icon, Donut, Bar, Spark, CompanyMark, Avatar } from '../components/ui';

import { apiUrl } from '../lib/api';

// --- SHARED UI COMPONENTS ---

const Card = ({ children, style, className = "", padding = 16, onClick }) => (
  <div className={`card ${className}`} style={{ padding, cursor: onClick ? "pointer" : "default", ...style }} onClick={onClick}>{children}</div>
);

const Badge = ({ children, type = "default", style }) => {
  const types = {
    default: "chip",
    accent: "chip chip-accent",
    good: "chip chip-good",
    warn: "chip chip-warn",
    bad: "chip chip-bad",
    hard: "chip chip-bad",
    medium: "chip chip-warn",
    easy: "chip chip-good"
  };
  return <span className={types[type] || types.default} style={{ fontSize: 11, ...style }}>{children}</span>;
};

// --- MAIN MODULE ---

export const SalarySimulator = ({ go, back }) => {
  const [view, setView] = useState("scenarios"); // scenarios, config, brief, simulation, scorecard, toolkit
  const [scenario, setScenario] = useState(null);
  const [config, setConfig] = useState({
    current_ctc: 0,
    offered_ctc: 0,
    target_ctc: 0,
    company: "TCS",
    role: "Software Engineer",
    city: "Mumbai",
    difficulty: "Medium",
    experience: 0
  });
  const [marketData, setMarketData] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [transcript, setTranscript] = useState([]);

  const handleStartSimulation = (finalConfig) => {
    setConfig(finalConfig);
    setView("brief");
  };

  const finishSimulation = (finalTranscript, finalResult) => {
    setTranscript(finalTranscript);
    setSimulationResult(finalResult);
    setView("scorecard");
  };

  switch (view) {
    case "scenarios": return <ScenarioSelection onSelect={(s) => { setScenario(s); setView("config"); }} onBack={() => (back ? back() : go("dashboard"))} />;
    case "config": return <ConfigPanel scenario={scenario} onBack={() => setView("scenarios")} onStart={handleStartSimulation} />;
    case "brief": return <MarketBrief config={config} onBack={() => setView("config")} onStart={() => setView("simulation")} />;
    case "simulation": return <LiveSimulation config={config} scenario={scenario} onFinish={finishSimulation} onBack={() => setView("brief")} />;
    case "scorecard": return <NegotiationScorecard config={config} transcript={transcript} result={simulationResult} onBack={() => setView("scenarios")} />;
    case "toolkit": return <NegotiationToolkit onBack={() => setView("scenarios")} />;
    default: return <ScenarioSelection onSelect={(s) => { setScenario(s); setView("config"); }} />;
  }
};

// --- SCREEN 1: SCENARIO SELECTION ---

const ScenarioSelection = ({ onSelect, onBack }) => {
  const scenarios = [
    { id: 'lending_negotiation', title: 'Lending Negotiation', desc: 'Negotiate an offer from HDFC Bank. Focus on fixed vs variable components in BFSI.', diff: 'Medium', time: '10–12 min', icon: 'money' },
    { id: 'first_job', title: 'First Job Offer', desc: 'Fresher receiving their very first job offer. Practice asking for more when you have no leverage.', diff: 'Easy', time: '10–12 min', icon: 'award' },
    { id: 'job_switch', title: 'Job Switch', desc: 'You have a current job and a new offer. Negotiate using your current CTC as a base.', diff: 'Medium', time: '12–15 min', icon: 'refresh' },
    { id: 'counter_offer', title: 'Counter-Offer', desc: 'Your current company offers a retention package. Navigate whether to stay or go.', diff: 'Hard', time: '15–18 min', icon: 'shield' },
    { id: 'benefits', title: 'Benefits Negotiation', desc: 'Salary is fixed. Negotiate joining bonus, remote work, stock options, etc.', diff: 'Medium', time: '10–12 min', icon: 'gift' },
    { id: 'notice_period', title: 'Notice Period', desc: 'The new company wants you in 15 days, but your current notice is 90 days. Negotiate the gap.', diff: 'Medium', time: '8–10 min', icon: 'clock' },
  ];

  return (
    <div className="stack" style={{ maxWidth: 900, margin: "0 auto", gap: 32 }}>
      <div className="stack" style={{ gap: 8 }}>
        <button className="btn btn-quiet btn-sm" onClick={onBack} style={{ width: "fit-content", marginLeft: -8 }}><Icon name="arrowL" size={14} /> Back</button>
        <div className="display" style={{ fontSize: 32 }}>Negotiate Like a Pro</div>
        <div className="muted" style={{ fontSize: 16 }}>Select a scenario to practice your salary negotiation with an AI HR representative.</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {scenarios.map(s => (
          <Card key={s.id} padding={20} onClick={() => onSelect(s)} style={{ transition: "transform .2s" }} className="hover-lift">
            <div className="between" style={{ marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={20} />
              </div>
              <Badge type={s.diff.toLowerCase()}>{s.diff}</Badge>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{s.title}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{s.desc}</div>
            <div className="hr" style={{ margin: "16px 0" }} />
            <div className="center" style={{ gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
              <Icon name="clock" size={14} /> {s.time}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- SCREEN 2: CONFIGURATION PANEL ---

const ConfigPanel = ({ scenario, onBack, onStart }) => {
  const [form, setForm] = useState({
    current_ctc: 8.0,
    offered_ctc: 12.0,
    target_ctc: 15.0,
    company: "Razorpay",
    role: "SDE-2",
    city: "Bangalore",
    difficulty: "Medium",
    experience: 3
  });
  const [realityCheck, setRealityCheck] = useState({ label: "Checking...", color: "var(--ink-3)" });

  useEffect(() => {
    // Reality check logic
    const diff = ((form.target_ctc - form.offered_ctc) / form.offered_ctc) * 100;
    if (diff <= 15) setRealityCheck({ label: "Within market range", color: "var(--good)" });
    else if (diff <= 35) setRealityCheck({ label: "Above market median — prepare strong justification", color: "var(--warn)" });
    else setRealityCheck({ label: "Unrealistic for this role — consider adjusting", color: "var(--bad)" });
  }, [form.target_ctc, form.offered_ctc]);

  return (
    <div className="stack" style={{ maxWidth: 700, margin: "0 auto", gap: 32 }}>
      <div className="stack" style={{ gap: 8 }}>
        <button className="btn btn-quiet btn-sm" onClick={onBack} style={{ width: "fit-content", marginLeft: -8 }}><Icon name="arrowL" size={14} /> Back</button>
        <div className="display" style={{ fontSize: 28 }}>Configure Simulation</div>
        <div className="muted" style={{ fontSize: 14 }}>Set your current and target figures to make the simulation realistic.</div>
      </div>

      <Card padding={32}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label">Current CTC (LPA)</div>
            <div className="center" style={{ gap: 12 }}>
              <input type="number" className="input" value={form.current_ctc} onChange={e => setForm({...form, current_ctc: parseFloat(e.target.value)})} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" id="na" checked={form.current_ctc === 0} onChange={e => setForm({...form, current_ctc: e.target.checked ? 0 : 8.0})} />
                <label htmlFor="na" style={{ fontSize: 12 }}>N/A</label>
              </div>
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label">Offered CTC (LPA)</div>
            <input type="number" className="input" value={form.offered_ctc} onChange={e => setForm({...form, offered_ctc: parseFloat(e.target.value)})} />
            <div className="muted" style={{ fontSize: 11 }}>Typical for {form.company}: 10–13 LPA</div>
          </div>
          <div className="stack" style={{ gap: 8, gridColumn: "1 / -1" }}>
            <div className="between">
              <div className="label">Target CTC (LPA)</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: realityCheck.color }}>{realityCheck.label}</div>
            </div>
            <input type="number" className="input" value={form.target_ctc} onChange={e => setForm({...form, target_ctc: parseFloat(e.target.value)})} />
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label">Company</div>
            <select className="input" value={form.company} onChange={e => setForm({...form, company: e.target.value})}>
              {["TCS", "Razorpay", "CRED", "Infosys", "Google", "Zomato"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label">City</div>
            <select className="input" value={form.city} onChange={e => setForm({...form, city: e.target.value})}>
              {["Bangalore", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="stack" style={{ gap: 8, gridColumn: "1 / -1" }}>
            <div className="label">Difficulty Level</div>
            <div className="seg">
              {["Easy", "Medium", "Hard"].map(d => (
                <button key={d} className={form.difficulty === d ? "on" : ""} onClick={() => setForm({...form, difficulty: d})}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn btn-accent" style={{ width: "100%", marginTop: 32, height: 48, fontSize: 16 }} onClick={() => onStart(form)}>Start Negotiation →</button>
      </Card>
    </div>
  );
};

// --- SCREEN 3: MARKET INTELLIGENCE BRIEF ---

const MarketBrief = ({ config, onBack, onStart }) => {
  const [data, setData] = useState(null);
  const [calcCtc, setCalcCtc] = useState(config.offered_ctc);
  const [breakup, setBreakup] = useState(null);

  useEffect(() => {
    // Fetch mock market data
    const fetchMarket = async () => {
      const res = await fetch(apiUrl(`/api/v1/salary/market-data?company=${encodeURIComponent(config.company)}&role=${encodeURIComponent(config.role)}&exp=${config.experience}&city=${encodeURIComponent(config.city)}`));
      setData(await res.json());
    };
    fetchMarket();
  }, [config]);

  useEffect(() => {
    const fetchBreakup = async () => {
      const res = await fetch(apiUrl('/api/v1/salary/calculate-breakup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctc: calcCtc, city: config.city })
      });
      setBreakup(await res.json());
    };
    fetchBreakup();
  }, [calcCtc, config.city]);

  if (!data || !breakup) return <div className="center" style={{ height: 400 }}>Loading intelligence...</div>;

  return (
    <div className="stack" style={{ maxWidth: 1000, margin: "0 auto", gap: 32 }}>
      <div className="stack" style={{ gap: 8 }}>
        <button className="btn btn-quiet btn-sm" onClick={onBack} style={{ width: "fit-content", marginLeft: -8 }}><Icon name="arrowL" size={14} /> Back</button>
        <div className="display" style={{ fontSize: 28 }}>Market Intelligence Brief</div>
        <div className="muted" style={{ fontSize: 14 }}>Know your value before you speak. Here's the data for {config.role} at {config.company}.</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
        <div className="stack" style={{ gap: 20 }}>
          <Card padding={24}>
            <div className="label" style={{ marginBottom: 16 }}>Salary Benchmarks ({config.city})</div>
            <div className="between" style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 8 }}>
              <div className="stack" style={{ alignItems: "center" }}>
                <div className="muted" style={{ fontSize: 10 }}>MIN</div>
                <div style={{ fontWeight: 600 }}>{data.min}L</div>
              </div>
              <div className="stack" style={{ alignItems: "center" }}>
                <div className="muted" style={{ fontSize: 10 }}>25th%</div>
                <div style={{ fontWeight: 600 }}>{data.p25}L</div>
              </div>
              <div className="stack" style={{ alignItems: "center", color: "var(--accent)" }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>MEDIAN</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{data.median}L</div>
              </div>
              <div className="stack" style={{ alignItems: "center" }}>
                <div className="muted" style={{ fontSize: 10 }}>75th%</div>
                <div style={{ fontWeight: 600 }}>{data.p75}L</div>
              </div>
              <div className="stack" style={{ alignItems: "center" }}>
                <div className="muted" style={{ fontSize: 10 }}>MAX</div>
                <div style={{ fontWeight: 600 }}>{data.max}L</div>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>Source: {data.source}</div>
          </Card>

          <Card padding={24}>
            <div className="between" style={{ marginBottom: 16 }}>
              <div className="label">CTC Breakup Calculator</div>
              <div className="seg seg-sm">
                <button className={calcCtc === config.offered_ctc ? "on" : ""} onClick={() => setCalcCtc(config.offered_ctc)}>Offered</button>
                <button className={calcCtc === config.target_ctc ? "on" : ""} onClick={() => setCalcCtc(config.target_ctc)}>Target</button>
              </div>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <div className="between" style={{ fontSize: 14 }}>
                <span>Monthly Gross</span>
                <span style={{ fontWeight: 600 }}>₹{Math.round(breakup.monthly.gross).toLocaleString()}</span>
              </div>
              <div className="between" style={{ fontSize: 14 }}>
                <span>In-hand (Est.)</span>
                <span style={{ fontWeight: 600, color: "var(--good)", fontSize: 18 }}>₹{Math.round(breakup.monthly.in_hand).toLocaleString()}</span>
              </div>
              <div className="hr" />
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                <div className="between"><span className="muted">Basic</span><span>₹{Math.round(breakup.annual.basic/12).toLocaleString()}</span></div>
                <div className="between"><span className="muted">HRA</span><span>₹{Math.round(breakup.annual.hra/12).toLocaleString()}</span></div>
                <div className="between"><span className="muted">EPF (Emp)</span><span>₹{Math.round(breakup.monthly.pf_employee).toLocaleString()}</span></div>
                <div className="between"><span className="muted">Special Allw.</span><span>₹{Math.round(breakup.annual.special_allowance/12).toLocaleString()}</span></div>
              </div>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Negotiation Golden Rules</div>
          {[
            { n: 1, r: "Never reveal your salary first", d: "Whoever speaks first anchors the negotiation." },
            { n: 2, r: "Never accept immediately", d: "Always ask for 24–48 hours to review." },
            { n: 3, r: "Use data, not emotions", d: "Cite benchmarks, not feelings." },
            { n: 4, r: "Negotiate the total package", d: "Bonus, stocks, and benefits matter too." },
            { n: 5, r: "Have a BATNA", d: "Leverage comes from having alternatives." },
          ].map(rule => (
            <Card key={rule.n} padding={12} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 24, borderRadius: 99, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{rule.n}</div>
              <div className="stack" style={{ gap: 2 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{rule.r}</div>
                <div className="muted" style={{ fontSize: 11 }}>{rule.d}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <button className="btn btn-accent" style={{ height: 54, fontSize: 18 }} onClick={onStart}>Begin Simulation →</button>
    </div>
  );
};

// --- SCREEN 4: LIVE SIMULATION ---

const LiveSimulation = ({ config, scenario, onFinish, onBack }) => {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hrEmotion, setHrEmotion] = useState("neutral");
  const [time, setTime] = useState(0);
  const transcriptRef = useRef(null);

  useEffect(() => {
    let interval;
    if (active) interval = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const start = () => {
    setActive(true);
    // Kick off the conversation
    sendMessage("Hi, I'm here to discuss the offer details.");
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const newUserMsg = { who: "Candidate", t: text, time: formatTime(time) };
    setTranscript(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/v1/salary/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenario.title,
          difficulty: config.difficulty,
          config: config,
          history: [...transcript, newUserMsg]
        })
      });
      const data = await res.json();
      
      setTranscript(prev => [...prev, { who: "AI HR", t: data.response, time: formatTime(time) }]);
      setHrEmotion(data.emotion);
      if (data.coach_tip) {
        setCoachTips(prev => [data.coach_tip, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleEnd = async () => {
    setLoading(true);
    const res = await fetch(apiUrl('/api/v1/salary/scorecard'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, transcript })
    });
    const result = await res.json();
    onFinish(transcript, result);
  };

  if (!active) {
    return (
      <div className="stack" style={{ alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 32 }}>Ready to negotiate?</div>
          <div className="muted" style={{ marginTop: 8 }}>The AI HR is waiting to discuss your offer.</div>
        </div>
        <div style={{ position: "relative" }}>
          <div className="pulse" style={{ width: 120, height: 120, borderRadius: 99, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="mic" size={48} style={{ color: "var(--accent)" }} />
          </div>
        </div>
        <button className="btn btn-accent btn-lg" onClick={start}>Start Voice Simulation</button>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 24, height: "calc(100vh - 180px)" }}>
      <div className="stack" style={{ gap: 16 }}>
        <Card padding={0} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="between" style={{ padding: "12px 20px", background: "var(--ink)", color: "white" }}>
            <div className="center" style={{ gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: "#10B981" }} />
              <div style={{ fontWeight: 600 }}>{scenario.title}</div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="mono">{formatTime(time)}</div>
              <Badge type={config.difficulty.toLowerCase()}>{config.difficulty}</Badge>
            </div>
          </div>

          <div style={{ flex: 1, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div className="stack" style={{ alignItems: "center", gap: 16 }}>
              <Avatar name="HR Priya" size={120} style={{ border: "4px solid var(--accent)", boxShadow: "0 0 20px rgba(194, 65, 12, 0.2)" }} />
              <div className="display" style={{ fontSize: 20 }}>HR Representative</div>
              <div className="muted" style={{ textTransform: "capitalize" }}>Current Mood: {hrEmotion}</div>
            </div>
            {loading && <div className="pulse" style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, background: "var(--accent-soft)", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="sparkles" size={20} style={{ color: "var(--accent)" }} /></div>}
          </div>

          <div ref={transcriptRef} style={{ height: 200, overflowY: "auto", padding: 20, background: "white", borderTop: "1px solid var(--line)" }}>
            {transcript.map((m, i) => (
              <div key={i} className={`stack ${m.who === "Candidate" ? "align-end" : "align-start"}`} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2 }}>{m.who} · {m.time}</div>
                <div style={{ padding: "8px 14px", borderRadius: 12, fontSize: 13, maxWidth: "80%", background: m.who === "Candidate" ? "var(--accent)" : "var(--surface-2)", color: m.who === "Candidate" ? "white" : "var(--ink)" }}>{m.t}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: 20, borderTop: "1px solid var(--line)" }}>
            <div className="center" style={{ gap: 12 }}>
              <div className="center" style={{ flex: 1, background: "var(--surface-2)", padding: "10px 16px", borderRadius: 10, gap: 12 }}>
                <Icon name="mic" size={18} className="muted" />
                <input className="input" style={{ border: 0, padding: 0, background: "transparent" }} placeholder="Speak or type your response..." onKeyDown={e => e.key === 'Enter' && sendMessage(e.target.value)} />
              </div>
              <button className="btn btn-bad" onClick={handleEnd}>End Simulation</button>
            </div>
          </div>
        </Card>
      </div>

      <aside className="stack" style={{ gap: 16 }}>
        <div className="label">Live Side Coach</div>
        {coachTips.length === 0 ? (
          <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 40 }}>Start speaking to see real-time tips.</div>
        ) : (
          coachTips.map((tip, i) => (
            <Card key={i} padding={16} style={{ background: `var(--${tip.type}-soft)`, border: `1px solid var(--${tip.type})`, color: `var(--${tip.type})` }}>
              <div className="center" style={{ gap: 8, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                <Icon name="sparkles" size={14} /> {tip.type.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>{tip.text}</div>
            </Card>
          ))
        )}
        <div style={{ flex: 1 }} />
        <Card padding={12} style={{ background: "var(--surface-2)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>NEGOTIATION CHEAT SHEET</div>
          <div className="stack" style={{ gap: 8 }}>
            {["I'd prefer to discuss based on market value.", "Can we look at the joining bonus?", "I need 24 hours to review this."].map(phrase => (
              <div key={phrase} className="chip" style={{ fontSize: 10, cursor: "pointer", background: "white" }} onClick={() => sendMessage(phrase)}>{phrase}</div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
};

// --- SCREEN 5: POST-SIMULATION SCORECARD ---

const NegotiationScorecard = ({ config, transcript, result, onBack }) => {
  if (!result) return <div className="center" style={{ height: 400 }}>Analyzing results...</div>;

  return (
    <div className="stack" style={{ maxWidth: 1100, margin: "0 auto", gap: 24 }}>
      <SectionHeader title="Simulation Scorecard" subtitle="Here's how you performed in your negotiation." onBack={onBack} />

      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        <Card padding={32} style={{ background: "var(--ink)", color: "white", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Donut value={result.overall_score} size={160} stroke={14} color="var(--accent-2)" track="rgba(255,255,255,0.1)" label={<span style={{ color: "white" }}>{result.overall_score}</span>} />
          <div className="display" style={{ fontSize: 24, marginTop: 20 }}>{result.overall_score > 80 ? "Master Negotiator" : "Improving"}</div>
          <div className="muted" style={{ fontSize: 14, textAlign: "center", marginTop: 8 }}>You negotiated ₹{result.gain_lpa} LPA above the initial offer.</div>
          <div className="hr" style={{ width: "100%", margin: "20px 0", opacity: 0.2 }} />
          <div className="stack" style={{ width: "100%", gap: 12 }}>
            <div className="between"><span className="muted">Initial Offer</span><span>{config.offered_ctc}L</span></div>
            <div className="between"><span className="muted">Final Agreed</span><span style={{ color: "var(--good)", fontWeight: 700 }}>{config.offered_ctc + result.gain_lpa}L</span></div>
            <div className="between"><span className="muted">Your Target</span><span>{config.target_ctc}L</span></div>
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Performance Parameters</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {result.parameters.map(p => (
              <Card key={p.name} padding={16}>
                <div className="between">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 14 }}>{p.score}/10</div>
                </div>
                <div style={{ marginTop: 8 }}><Bar value={p.score * 10} color="var(--accent)" height={6} /></div>
                <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p.feedback}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="label">Mistake Replay</div>
      <div className="stack" style={{ gap: 12 }}>
        {result.mistakes.map((m, i) => (
          <Card key={i} padding={20} style={{ borderLeft: "4px solid var(--bad)" }}>
            <div className="between">
              <Badge type="bad">Tactical Error · {m.timestamp}</Badge>
              <button className="btn btn-ghost btn-sm">Practice This Moment Again</button>
            </div>
            <div style={{ marginTop: 12, fontSize: 14, fontStyle: "italic", background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>"{m.excerpt}"</div>
            <div className="stack" style={{ gap: 4, marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>What went wrong?</div>
              <div className="muted" style={{ fontSize: 12 }}>{m.reason}</div>
            </div>
            <div className="stack" style={{ gap: 4, marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--good)" }}>What to say instead</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>"{m.correction}"</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- NAVIGATION WRAPPER FOR SECTION HEADERS ---

const SectionHeader = ({ title, subtitle, onBack }) => (
  <div className="stack" style={{ gap: 4, marginBottom: 20 }}>
    {onBack && (
      <button className="btn btn-quiet btn-sm" onClick={onBack} style={{ width: "fit-content", marginLeft: -8 }}>
        <Icon name="arrowL" size={14} /> Back
      </button>
    )}
    <div className="display" style={{ fontSize: 24, marginTop: onBack ? 8 : 0 }}>{title}</div>
    {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
  </div>
);

const NegotiationToolkit = ({ onBack }) => (
  <div className="stack" style={{ maxWidth: 900, margin: "0 auto", gap: 32 }}>
    <SectionHeader title="Negotiation Toolkit" subtitle="Reference library for your salary discussions." onBack={onBack} />
    {/* Implementation similar to phrase bank and calculators */}
    <Card padding={40} style={{ textAlign: "center" }}>
      <Icon name="lock" size={48} className="muted" />
      <div className="display" style={{ fontSize: 20, marginTop: 16 }}>Toolkit content coming soon</div>
    </Card>
  </div>
);

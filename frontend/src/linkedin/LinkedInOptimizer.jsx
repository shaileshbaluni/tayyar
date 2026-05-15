import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Donut, Bar, CompanyMark, Avatar, Spark } from '../components/ui';

// --- COMPONENTS ---

const Card = ({ children, style, className = "", padding = 16 }) => (
  <div className={`card ${className}`} style={{ padding, ...style }}>{children}</div>
);

const Badge = ({ children, type = "default", style }) => {
  const types = {
    default: "chip",
    accent: "chip chip-accent",
    teal: "chip chip-teal",
    good: "chip chip-good",
    warn: "chip chip-warn",
    bad: "chip chip-bad",
    ai: "chip chip-accent"
  };
  return (
    <span className={types[type] || types.default} style={{ fontSize: 11, ...style }}>
      {type === "ai" && <Icon name="sparkles" size={10} style={{ marginRight: 4 }} />}
      {children}
    </span>
  );
};

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

// --- MAIN MODULE ---

export const LinkedInOptimizer = ({ go }) => {
  const [view, setView] = useState("import"); // import, dashboard, headline, about, experience, skills, education, recommendations, activity, calendar, wizard
  const [profile, setProfile] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const startAudit = async (data) => {
    setLoading(true);
    setLoadingText("Analyzing your profile...");
    
    try {
      // 1. If URL, fetch profile first
      let profileData = data;
      if (data.type === 'url') {
        const fetchRes = await fetch('/api/v1/linkedin/import-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: data.url })
        });
        profileData = await fetchRes.json();
      }

      // 2. Run Audit
      const auditRes = await fetch('/api/v1/linkedin/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      const auditResult = await auditRes.json();
      
      setProfile(profileData);
      setAudit(auditResult);
    } catch (err) {
      console.error("Audit failed", err);
      // Fallback to mock for demo if API fails
      setAudit({
        overall_score: 64,
        percentile: 34,
        components: [
          { name: "Headline", score: 42, status: "Needs Work", issues: ["Too generic"], quick_fix: "SDE-1 | Python, AWS" },
          { name: "About Section", score: 35, status: "Needs Work", issues: ["Too short"], quick_fix: "Passionate Engineer" },
          { name: "Experience", score: 70, status: "Strong", issues: ["Missing metrics"] },
          { name: "Skills", score: 55, status: "Needs Work", issues: ["Only 8 skills"] },
          { name: "Education", score: 90, status: "Strong", issues: [] },
          { name: "Recommendations", score: 0, status: "Empty", issues: ["0 found"] },
          { name: "Activity & Posts", score: 30, status: "Needs Work", issues: ["No posts"] },
          { name: "Profile Photo", score: 80, status: "Strong", issues: [] },
          { name: "Banner Image", score: 20, status: "Empty", issues: ["Default"] }
        ]
      });
    }
    
    setLoading(false);
    setView("dashboard");
  };

  if (loading) {
    return (
      <div className="stack" style={{ alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20 }}>
        <div className="pulse" style={{ width: 80, height: 80, borderRadius: 999, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="sparkles" size={40} style={{ color: "var(--accent)" }} />
        </div>
        <div className="stack" style={{ alignItems: "center", gap: 4 }}>
          <div className="display" style={{ fontSize: 18 }}>{loadingText}</div>
          <div className="muted" style={{ fontSize: 13 }}>Gemini 2.5 Pro is working its magic...</div>
        </div>
      </div>
    );
  }

  switch (view) {
    case "import": return <ImportScreen onImport={startAudit} />;
    case "dashboard": return <AuditDashboard audit={audit} profile={profile} setView={setView} />;
    case "headline": return <HeadlineOptimizer profile={profile} onBack={() => setView("dashboard")} />;
    case "about": return <AboutOptimizer profile={profile} onBack={() => setView("dashboard")} />;
    case "experience": return <ExperienceOptimizer profile={profile} onBack={() => setView("dashboard")} />;
    case "calendar": return <ContentCalendar profile={profile} onBack={() => setView("dashboard")} />;
    case "wizard": return <FixAllWizard audit={audit} onBack={() => setView("dashboard")} />;
    case "headline section": return <HeadlineOptimizer profile={profile} onBack={() => setView("dashboard")} />;
    case "about section": return <AboutOptimizer profile={profile} onBack={() => setView("dashboard")} />;
    default: 
      const comp = audit?.components.find(c => c.name.toLowerCase().startsWith(view));
      if (comp) return <SectionDetail component={comp} profile={profile} onBack={() => setView("dashboard")} />;
      return <AuditDashboard audit={audit} profile={profile} setView={setView} />;
  }
};

// --- SCREEN: IMPORT ---

const ImportScreen = ({ onImport }) => {
  const [activeTab, setActiveTab] = useState(null);
  const [url, setUrl] = useState("");

  const options = [
    { id: 'url', icon: 'link', title: 'Paste LinkedIn URL', sub: 'We\'ll read your public profile automatically.', color: 'var(--accent)' },
    { id: 'manual', icon: 'edit', title: 'Enter Manually', sub: 'Type or paste your current LinkedIn content section by section.', color: 'var(--teal)' },
    { id: 'resume', icon: 'file', title: 'Import from Resume', sub: 'We\'ll use your resume to pre-fill LinkedIn content.', color: 'var(--gold)' },
    { id: 'ai', icon: 'sparkles', title: 'Generate from Scratch', sub: 'No resume, no LinkedIn? Gemini builds your entire profile.', color: 'var(--ink)', ai: true },
  ];

  return (
    <div className="stack" style={{ maxWidth: 800, margin: "0 auto", gap: 32 }}>
      <div className="stack" style={{ textAlign: "center", gap: 8 }}>
        <div className="display" style={{ fontSize: 32 }}>Let's Audit Your LinkedIn</div>
        <div className="muted" style={{ fontSize: 16 }}>Import your profile to get a personalised score and AI-powered fixes for every section.</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {options.map(opt => (
          <Card key={opt.id} padding={0} style={{ cursor: "pointer", border: activeTab === opt.id ? `2px solid ${opt.color}` : "1px solid var(--line)" }} >
            <div style={{ padding: 20 }} onClick={() => setActiveTab(activeTab === opt.id ? null : opt.id)}>
              <div className="between">
                <div className="center" style={{ gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${opt.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: opt.color }}>
                    <Icon name={opt.icon} size={20} />
                  </div>
                  <div className="stack" style={{ gap: 2 }}>
                    <div style={{ fontWeight: 600 }}>{opt.title} {opt.ai && <Badge type="ai" style={{ marginLeft: 6 }}>AI</Badge>}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{opt.sub}</div>
                  </div>
                </div>
                <Icon name={activeTab === opt.id ? "chevD" : "chevR"} size={16} className="muted" />
              </div>
            </div>

            {activeTab === opt.id && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--line-2)", paddingTop: 20 }}>
                {opt.id === 'url' && (
                  <div className="stack" style={{ gap: 12 }}>
                    <input className="input" placeholder="linkedin.com/in/yourname" value={url} onChange={e => setUrl(e.target.value)} />
                    <div className="muted" style={{ fontSize: 11 }}>Make sure your profile is set to public before fetching. <a href="https://www.linkedin.com/help/linkedin/answer/a522735" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 500 }}>How to make public</a></div>
                    <button className="btn btn-accent" style={{ width: "100%" }} onClick={() => onImport({ type: 'url', url })}>Fetch Profile</button>
                  </div>
                )}
                {opt.id === 'manual' && (
                  <div className="stack" style={{ gap: 12 }}>
                    <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onImport({ type: 'manual' })}>Open Form</button>
                  </div>
                )}
                {opt.id === 'resume' && (
                  <div className="stack" style={{ gap: 12 }}>
                    <Card style={{ background: "var(--surface-2)", border: "1px dashed var(--line-2)" }}>
                      <div className="between">
                        <div className="center">
                          <Icon name="file" size={16} className="muted" />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>Resume_Rahul_SDE.pdf</span>
                        </div>
                        <Badge type="good">Detected</Badge>
                      </div>
                    </Card>
                    <button className="btn btn-accent" style={{ width: "100%" }} onClick={() => onImport({ type: 'resume' })}>Use This Resume</button>
                  </div>
                )}
                {opt.id === 'ai' && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Gemini 2.5 Pro will ask 8 questions to build your profile.</div>
                    <button className="btn btn-primary" style={{ width: "100%", background: "var(--ink)" }} onClick={() => onImport({ type: 'ai' })}>Start AI Intake</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div style={{ textAlign: "center" }} className="muted">
        <div style={{ fontSize: 12 }}><Icon name="badge" size={12} style={{ verticalAlign: "middle", marginRight: 4 }} /> Your data stays private. We never post to LinkedIn on your behalf.</div>
      </div>
    </div>
  );
};

// --- SCREEN: AUDIT DASHBOARD ---

const AuditDashboard = ({ audit, profile, setView }) => {
  const generateSection = async (sectionName) => {
    try {
      const res = await fetch(`/api/v1/linkedin/generate/${sectionName.toLowerCase().replace(' ', '-')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
    } catch (err) {
      console.error('Generation failed', err);
    }
  };

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* ZONE 1: SCORE OVERVIEW */}
      <Card padding={24} style={{ background: "var(--ink)", color: "var(--surface)" }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", alignItems: "center", gap: 40 }}>
          <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
            <Donut value={audit.overall_score} size={160} stroke={14} color="var(--accent-2)" track="rgba(255,255,255,0.1)" label={<span style={{ color: "white" }}>{audit.overall_score}</span>} />
            <div className="display" style={{ fontSize: 18, marginTop: 16 }}>{audit.overall_score > 80 ? "Recruiter-Ready" : audit.overall_score > 60 ? "Getting There" : "Needs Work"}</div>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="display" style={{ fontSize: 28 }}>Your profile is stronger than {audit.percentile}% of professionals.</div>
            <div className="muted" style={{ fontSize: 14, color: "var(--ink-4)" }}>Target 85+ to maximize your visibility in recruiter search results. You're currently missing key technical keywords in your headline and experience.</div>
            <div className="row" style={{ gap: 12 }}>
              <button className="btn btn-accent" onClick={() => setView("wizard")}>Fix All Issues</button>
              <button className="btn btn-ghost" style={{ borderColor: "rgba(255,255,255,0.2)", color: "white" }} onClick={() => setView("calendar")}>Content Calendar</button>
            </div>
          </div>
        </div>
      </Card>

      {/* ZONE 2: NINE-COMPONENT BREAKDOWN */}
      <div className="stack" style={{ gap: 12 }}>
        <div className="between">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Profile Audit Breakdown</div>
          <button className="btn btn-quiet btn-sm" style={{ color: "var(--accent)" }}><Icon name="sparkles" size={14} /> Generate All Empty Sections</button>
        </div>
        
        {audit.components.map((comp, idx) => (
          <Card key={comp.name} padding={16} className="between" style={{ cursor: "pointer" }} onClick={() => setView(comp.name.toLowerCase().split(" ")[0])}>
            <div className="center" style={{ flex: 1, gap: 20 }}>
              <div className="mono muted" style={{ fontSize: 12, width: 20 }}>0{idx + 1}</div>
              <div className="stack" style={{ width: 140, gap: 2 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{comp.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{comp.score}/100</div>
              </div>
              <div style={{ flex: 1, maxWidth: 300 }}>
                <Bar value={comp.score} color={comp.score > 80 ? "var(--good)" : comp.score > 40 ? "var(--warn)" : "var(--bad)"} />
              </div>
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <div className="muted" style={{ fontSize: 11 }}>{comp.issues.length > 0 ? comp.issues[0] : "Looking good!"}</div>
                {comp.quick_fix && <div style={{ fontSize: 10, color: "var(--accent)" }}>Quick Fix: "{comp.quick_fix}"</div>}
              </div>
            </div>
            <div className="center" style={{ gap: 12 }}>
              <Badge type={comp.status === "Strong" ? "good" : comp.status === "Empty" ? "bad" : "warn"}>{comp.status}</Badge>
              <button className="btn btn-ghost btn-sm" style={{ padding: "6px 8px" }}>
                {comp.status === "Empty" ? "Generate" : "Fix"} <Icon name="chevR" size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- SCREEN: HEADLINE OPTIMIZER ---

const HeadlineOptimizer = ({ profile, onBack }) => {
  const [activeStrategy, setActiveStrategy] = useState(0);
  const [strategies, setStrategies] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeadlines = async () => {
      try {
        const res = await fetch('/api/v1/linkedin/generate/headlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            current_role: profile?.headline || "Software Engineer", 
            target_role: "SDE-2" 
          })
        });
        const data = await res.json();
        setStrategies(data.versions || []);
        setKeywords(data.keywords || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHeadlines();
  }, [profile]);

  if (loading) return <div className="center" style={{ height: 300 }}>Generating optimized headlines...</div>;

  return (
    <div className="stack" style={{ maxWidth: 900, margin: "0 auto", gap: 24 }}>
      <SectionHeader title="Headline Optimizer" subtitle="Make the first thing recruiters see count." onBack={onBack} />

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Current Headline</div>
          <Card style={{ background: "var(--surface-2)", border: "1px dashed var(--line-2)" }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{profile?.headline || "Not set"}</div>
            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              <Badge type="bad">Too generic</Badge>
              <Badge type="bad">No keywords</Badge>
              <Badge type="good">Has role title</Badge>
            </div>
          </Card>

          <div className="label" style={{ marginTop: 8 }}>AI-Generated Alternatives</div>
          {strategies.map((st, i) => (
            <Card key={i} padding={20} style={{ border: activeStrategy === i ? "2px solid var(--accent)" : "1px solid var(--line)" }}>
              <div className="between" style={{ marginBottom: 12 }}>
                <Badge type="ai">{st.strategy}</Badge>
                <div className="muted" style={{ fontSize: 11 }}>{st.tag}</div>
              </div>
              <div className="display" style={{ fontSize: 18, lineHeight: 1.3 }}>{st.text}</div>
              <div className="between" style={{ marginTop: 16 }}>
                <div className="muted" style={{ fontSize: 11 }}>{st.char_count}/220 characters · {st.keywords_covered?.length || 0} target keywords</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(st.text)}><Icon name="copy" size={14} /> Copy</button>
                  <button className="btn btn-primary btn-sm">Edit</button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Keyword Intelligence</div>
          <Card padding={20}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>High-Priority Keywords</div>
            <div className="stack" style={{ gap: 10 }}>
              {keywords.slice(0, 7).map(kw => (
                <div key={kw.text} className="between">
                  <div className="center" style={{ gap: 8 }}>
                    <Icon name={kw.status === "Included" ? "check" : "x"} size={14} style={{ color: kw.status === "Included" ? "var(--good)" : "var(--bad)" }} />
                    <span style={{ fontSize: 13 }}>{kw.text}</span>
                  </div>
                  <Badge type={kw.volume === "High" ? "bad" : "warn"}>{kw.volume}</Badge>
                </div>
              ))}
            </div>
            <div className="hr" style={{ margin: "16px 0" }} />
            <div className="muted" style={{ fontSize: 12 }}>Tip: Front-load your 3 most important keywords. LinkedIn's algorithm gives more weight to terms at the beginning.</div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- SCREEN: ABOUT OPTIMIZER ---

const AboutOptimizer = ({ profile, onBack }) => {
  const [tab, setTab] = useState("A");
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAbout = async () => {
      try {
        const res = await fetch('/api/v1/linkedin/generate/about', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            about_me: profile?.about || "",
            achievements: "Built high-scale microservices",
            looking_for: "SDE-2 roles"
          })
        });
        const data = await res.json();
        setVersions(data.versions || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchAbout();
  }, [profile]);

  if (loading) return <div className="center" style={{ height: 300 }}>Generating optimized About sections...</div>;
  
  const currentVersion = versions.find(v => v.id === tab) || versions[0];

  return (
    <div className="stack" style={{ maxWidth: 900, margin: "0 auto", gap: 24 }}>
      <SectionHeader title="About Section Rewriter" subtitle="Tell your story, don't just list your tasks." onBack={onBack} />

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="seg">
            <button className={tab === "A" ? "on" : ""} onClick={() => setTab("A")}>Storyteller</button>
            <button className={tab === "B" ? "on" : ""} onClick={() => setTab("B")}>Data-Driven</button>
            <button className={tab === "C" ? "on" : ""} onClick={() => setTab("C")}>Career Narrative</button>
          </div>

          <Card padding={24} style={{ position: "relative" }}>
            <Badge type="ai" style={{ position: "absolute", top: 16, right: 16 }}>AI Generated</Badge>
            <div className="stack" style={{ gap: 16 }}>
              <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{currentVersion?.text}</div>
            </div>
            <div className="between" style={{ marginTop: 24 }}>
              <div className="row" style={{ gap: 12 }}>
                <div className="stack" style={{ gap: 2 }}>
                  <div className="muted" style={{ fontSize: 10 }}>WORDS</div>
                  <div style={{ fontWeight: 600 }}>{currentVersion?.word_count}</div>
                </div>
                <div className="stack" style={{ gap: 2 }}>
                  <div className="muted" style={{ fontSize: 10 }}>KEYWORDS</div>
                  <div style={{ fontWeight: 600 }}>{currentVersion?.keywords?.length || 0}/15</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost">Edit</button>
                <button className="btn btn-primary">Use as About Section</button>
              </div>
            </div>
          </Card>

          <Card padding={16} style={{ background: "var(--surface-2)" }}>
            <div className="label">Refinement Chat</div>
            <div className="center" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["Make it shorter", "More formal", "Add open source", "Startup tone", "Translate to Hinglish"].map(chip => (
                <button key={chip} className="chip" style={{ cursor: "pointer", background: "white" }}>{chip}</button>
              ))}
            </div>
            <div className="center" style={{ gap: 8, background: "white", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)" }}>
              <input style={{ border: 0, outline: 0, flex: 1, fontSize: 13 }} placeholder="Tell me how to change it..." />
              <button className="btn btn-primary btn-sm" style={{ padding: 6 }}><Icon name="arrowR" size={14} /></button>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Analysis of current About</div>
          <Card padding={16}>
            <div className="muted" style={{ fontSize: 12 }}>"I build things. Experienced in Python and web development."</div>
            <div className="hr" style={{ margin: "12px 0" }} />
            <div className="stack" style={{ gap: 8 }}>
              <div className="center" style={{ gap: 8, fontSize: 13, color: "var(--bad)" }}>
                <Icon name="x" size={14} /> Too short (11 words)
              </div>
              <div className="center" style={{ gap: 8, fontSize: 13, color: "var(--bad)" }}>
                <Icon name="x" size={14} /> No achievements mentioned
              </div>
              <div className="center" style={{ gap: 8, fontSize: 13, color: "var(--bad)" }}>
                <Icon name="x" size={14} /> Missing 12 target keywords
              </div>
              <div className="center" style={{ gap: 8, fontSize: 13, color: "var(--warn)" }}>
                <Icon name="x" size={14} /> No contact/call-to-action
              </div>
            </div>
          </Card>

          <Card padding={16} style={{ background: "var(--accent-soft)", border: "none" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--accent)" }}>Why the About section matters</div>
            <div style={{ fontSize: 12, marginTop: 8, color: "var(--accent)", lineHeight: 1.4 }}>
              Recruiters spend an average of 30 seconds on your About section before deciding whether to read your experience. A strong hook is essential.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- SCREEN: EXPERIENCE OPTIMIZER ---

const ExperienceOptimizer = ({ profile, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const improveAll = async () => {
      const exp = profile?.experience || [];
      const improved = await Promise.all(exp.map(async e => {
        try {
          const res = await fetch('/api/v1/linkedin/improve/experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(e)
          });
          return await res.json();
        } catch (err) {
          return { original: e, current_score: 0, bullets: [] };
        }
      }));
      setEntries(improved);
      setLoading(false);
    };
    improveAll();
  }, [profile]);

  if (loading) return <div className="center" style={{ height: 300 }}>Improving your experience bullets...</div>;

  return (
    <div className="stack" style={{ maxWidth: 900, margin: "0 auto", gap: 24 }}>
      <SectionHeader title="Experience Enhancer" subtitle="Turn duties into achievements." onBack={onBack} />
      
      <div className="stack" style={{ gap: 16 }}>
        {entries.map((entry, idx) => (
          <Card key={idx} padding={24}>
            <div className="between" style={{ marginBottom: 20 }}>
              <div className="center" style={{ gap: 16 }}>
                <CompanyMark name={profile.experience[idx].company} color="#15110D" />
                <div className="stack" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{profile.experience[idx].position}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{profile.experience[idx].company} · {profile.experience[idx].date}</div>
                </div>
              </div>
              <Badge type={entry.current_score > 7 ? "good" : "warn"}>Score: {entry.current_score}/10</Badge>
            </div>

            <div className="stack" style={{ gap: 12 }}>
              {entry.bullets.map((b, bIdx) => (
                <div key={bIdx} className="stack" style={{ gap: 8 }}>
                  <div className="between">
                    <div style={{ fontSize: 14 }}>• {b.original}</div>
                    <Badge type={b.score > 7 ? "good" : "bad"}>{b.score > 7 ? "Strong" : "Weak"}</Badge>
                  </div>
                  <Card padding={12} style={{ background: "var(--surface-2)", border: "1px dashed var(--line-2)" }}>
                    <div className="between">
                      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        <Badge type="ai" style={{ marginBottom: 4 }}>Improved Version</Badge>
                        <div>{b.improved}</div>
                      </div>
                      <button className="btn btn-accent btn-sm">Accept</button>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- SCREEN: CONTENT CALENDAR ---

const ContentCalendar = ({ profile, onBack }) => {
  const [view, setView] = useState("grid"); // grid, list

  const posts = [
    { day: 1, type: "Tutorial", topic: "Building REST APIs with Python", time: "8:30 AM", status: "Ready" },
    { day: 3, type: "Career Insight", topic: "Transitioning from Service to Product", time: "9:00 AM", status: "Ready" },
    { day: 5, type: "Personal Story", topic: "The bug that taught me the most", time: "12:15 PM", status: "Draft" },
    { day: 8, type: "Industry Opinion", topic: "Why AI won't replace engineers", time: "8:30 AM", status: "Draft" },
  ];

  return (
    <div className="stack" style={{ maxWidth: 1000, margin: "0 auto", gap: 24 }}>
      <SectionHeader title="30-Day Content Calendar" subtitle="Build your personal brand with consistent posting." onBack={onBack} />

      <div className="between">
        <div className="seg">
          <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}>Grid View</button>
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List View</button>
        </div>
        <button className="btn btn-accent"><Icon name="sparkles" size={14} /> Generate All 30 Posts</button>
      </div>

      {view === "grid" ? (
        <Card padding={24}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {Array.from({ length: 30 }).map((_, i) => {
              const post = posts.find(p => p.day === i + 1);
              return (
                <div key={i} style={{
                  aspectRatio: "1", borderRadius: 12, border: "1px solid var(--line)",
                  background: post ? "var(--accent-soft)" : "var(--surface)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", gap: 4
                }}>
                  <span className="mono" style={{ fontSize: 10, position: "absolute", top: 8, left: 8, opacity: 0.5 }}>{i + 1}</span>
                  {post && (
                    <>
                      <Icon name={post.type === "Tutorial" ? "code" : post.type === "Career Insight" ? "work" : "edit"} size={20} style={{ color: "var(--accent)" }} />
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", textAlign: "center", padding: "0 4px" }}>{post.type}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {posts.map(post => (
            <Card key={post.day} padding={16} className="between">
              <div className="center" style={{ gap: 16 }}>
                <div className="mono" style={{ width: 24, fontSize: 12 }}>D{post.day}</div>
                <div className="stack" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 600 }}>{post.topic}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{post.type} · {post.time}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost btn-sm">Edit Draft</button>
                <button className="btn btn-primary btn-sm">Copy Post</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// --- SCREEN: FIX ALL WIZARD ---

const FixAllWizard = ({ audit, onBack }) => {
  const [step, setStep] = useState(0);
  const issues = audit.components.filter(c => c.status !== "Strong").flatMap(c => c.issues.map(issue => ({ component: c.name, issue, fix: c.quick_fix })));

  if (step >= issues.length) {
    return (
      <div className="stack" style={{ maxWidth: 600, margin: "60px auto", textAlign: "center", gap: 24 }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="display" style={{ fontSize: 28 }}>Optimization Guide Ready!</div>
          <div className="muted">You've addressed 12 critical issues. Your profile score is projected to jump from 64 to 88.</div>
        </div>
        <Card padding={24} style={{ background: "var(--surface-2)" }}>
          <div className="stack" style={{ gap: 12 }}>
            <button className="btn btn-accent" style={{ width: "100%" }}><Icon name="download" size={16} /> Download PDF Guide</button>
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onBack}>Return to Dashboard</button>
          </div>
        </Card>
      </div>
    );
  }

  const current = issues[step];

  return (
    <div className="stack" style={{ maxWidth: 700, margin: "0 auto", gap: 32 }}>
      <div className="between">
        <div className="mono muted" style={{ fontSize: 12 }}>Issue {step + 1} of {issues.length}</div>
        <div style={{ width: 200 }}><Bar value={((step + 1) / issues.length) * 100} /></div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <Badge type="bad" style={{ width: "fit-content" }}>{current.component}</Badge>
        <div className="display" style={{ fontSize: 28 }}>{current.issue}</div>
      </div>

      <Card padding={32} style={{ background: "var(--accent-soft)", border: "none" }}>
        <div className="label" style={{ color: "var(--accent)" }}>AI RECOMMENDED FIX</div>
        <div className="display" style={{ fontSize: 20, margin: "16px 0", lineHeight: 1.4 }}>"{current.fix || "Generating optimized content..."}"</div>
        <div className="muted" style={{ fontSize: 13, color: "var(--accent)", opacity: 0.8 }}>
          This fix includes high-volume keywords and an achievement-based structure to improve your search visibility.
        </div>
      </Card>

      <div className="between">
        <button className="btn btn-ghost" onClick={() => setStep(step + 1)}>Skip</button>
        <div className="row" style={{ gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => {}}>Edit</button>
          <button className="btn btn-accent" onClick={() => setStep(step + 1)}>Accept & Next</button>
        </div>
      </div>
    </div>
  );
};

// --- SCREEN: GENERIC SECTION DETAIL ---

const SectionDetail = ({ component, profile, onBack }) => {
  return (
    <div className="stack" style={{ maxWidth: 800, margin: "0 auto", gap: 24 }}>
      <SectionHeader title={component.name} subtitle={component.issues.length > 0 ? "Let's fix these issues." : "Your section is looking strong."} onBack={onBack} />
      
      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Analysis Results</div>
          <Card padding={24}>
            <div className="stack" style={{ gap: 12 }}>
              {component.issues.map((issue, i) => (
                <div key={i} className="center" style={{ gap: 12, color: "var(--bad)" }}>
                  <Icon name="x" size={16} />
                  <div style={{ fontSize: 14 }}>{issue}</div>
                </div>
              ))}
              {component.issues.length === 0 && (
                <div className="center" style={{ gap: 12, color: "var(--good)" }}>
                  <Icon name="check" size={16} />
                  <div style={{ fontSize: 14 }}>No issues found! Great job.</div>
                </div>
              )}
            </div>
          </Card>

          <div className="label">AI Recommendations</div>
          <Card padding={24} style={{ background: "var(--accent-soft)", border: "none" }}>
            <div className="stack" style={{ gap: 16 }}>
              <div className="display" style={{ fontSize: 18 }}>{component.quick_fix || "Analyzing for better suggestions..."}</div>
              <div className="muted" style={{ fontSize: 13 }}>Applying this change will likely increase your visibility by ~15% in this category.</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-accent btn-sm">Accept Fix</button>
                <button className="btn btn-ghost btn-sm">Edit</button>
              </div>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="label">Pro Tips</div>
          <Card padding={16}>
            <ul style={{ paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
              <li>LinkedIn's algorithm favors profiles with {component.name} sections that are 100% complete.</li>
              <li>Use keywords that are common in SDE-2 job descriptions.</li>
              <li>Aim for at least 3-5 high-quality entries in this section.</li>
            </ul>
          </Card>
          
          <Card padding={16} style={{ background: "var(--surface-2)" }}>
            <div className="center" style={{ gap: 8, color: "var(--ink-3)" }}>
              <Icon name="link" size={14} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>External Resources</div>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 12 }}>
              <a href="https://www.linkedin.com/help/linkedin" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>LinkedIn Help Center</a>
              <a href="https://business.linkedin.com/talent-solutions/blog/linkedin-best-practices" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>Profile Best Practices</a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LinkedInOptimizer;
